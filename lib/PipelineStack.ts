import * as cdk from "aws-cdk-lib";
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as codePipeline from "aws-cdk-lib/aws-codepipeline";
import * as codeCommit from 'aws-cdk-lib/aws-codecommit';
import * as codePipelineActions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codeCommitActions from "aws-cdk-lib/aws-codepipeline-actions";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import {Construct} from "constructs";

interface PipelineStackProps extends cdk.StackProps {
  websiteSourceRepo: codeCommit.IRepository;
  websiteInfrastructureRepo: codeCommit.IRepository;
}

export class PipelineStack extends cdk.Stack {
  public websiteAssetsS3Bucket: s3.Bucket;
  public originAccessIdentity: cf.OriginAccessIdentity;

  constructor(parent: Construct, id: string, props: PipelineStackProps) {
    super(parent, id, props);

    this.websiteAssetsS3Bucket = new s3.Bucket(this, 'blog-website-assets-bucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
    });

    this.originAccessIdentity = new cf.OriginAccessIdentity(this, 'OriginAccessIdentity');
    this.websiteAssetsS3Bucket.grantRead(this.originAccessIdentity);

    const source = codebuild.Source.codeCommit({
      repository: props.websiteSourceRepo,
      branchOrRef: 'main'
    });

    const buildSpec = this.getBuildSpec();
    const project = new codebuild.Project(this, 'blog-website-assets-code-build-project', {
      source,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
        privileged: true,
      },
      buildSpec
    });

    this.websiteAssetsS3Bucket.grantReadWrite(project.grantPrincipal);

    const artifacts = {
      source: new codePipeline.Artifact('Source'),
      build: new codePipeline.Artifact('BuildOutput')
    };

    const pipelineActions = {
      source: new codePipelineActions.CodeCommitSourceAction({
        actionName: "CodeCommit",
        output: artifacts.source,
        repository: props.websiteSourceRepo,
        trigger: codeCommitActions.CodeCommitTrigger.EVENTS,
        branch: 'main',
      }),
      build: new codePipelineActions.CodeBuildAction({
        actionName: 'CodeBuild',
        project,
        input: artifacts.source,
        outputs: [artifacts.build],
      }),
      deploy: new codePipelineActions.S3DeployAction({
        actionName: 'S3Deploy',
        bucket: this.websiteAssetsS3Bucket,
        input: artifacts.build,
      }),
    };

    const pipeline = new codePipeline.Pipeline(this, 'blog-deploy-pipeline', {
      pipelineName: `blog-website-deploy-pipeline`,
      stages: [
        {stageName: 'Source', actions: [pipelineActions.source]},
        {stageName: 'Build', actions: [pipelineActions.build]},
        {stageName: 'Deploy', actions: [pipelineActions.deploy]},
      ],
    });
  }

  private getBuildSpec() {
    return codebuild.BuildSpec.fromObject({
      version: '0.2',
      env: {
        shell: 'bash'
      },
      phases: {
        pre_build: {
          commands: [
            'echo Build started on `date`',
            'aws --version',
            'node --version',
            'npm install',
          ],
        },
        build: {
          commands: [
            'npm run build',
          ],
        },
        post_build: {
          commands: [
            'echo Build completed on `date`',
          ]
        }
      },
      artifacts: {
        ['base-directory']: 'build',
        files: ['**/*']
      },
      cache: {
        paths: ['node_modules/**/*']
      }
    })
  }
}