import * as cdk from "aws-cdk-lib";
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as codePipeline from "aws-cdk-lib/aws-codepipeline";
import * as codeCommit from 'aws-cdk-lib/aws-codecommit';
import * as codePipelineActions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codeCommitActions from "aws-cdk-lib/aws-codepipeline-actions";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
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

    const githubSource = codebuild.Source.gitHub({
      owner: 'CallMeCCLemon',
      repo: 'TheDailyAbstractionWebsiteAssets',
      webhook: true,
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

    const githubProject = new codebuild.Project(this, 'github-website-assets-code-build-project', {
      source: githubSource,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
        privileged: true,
      },
      buildSpec
    });

    this.websiteAssetsS3Bucket.grantReadWrite(project.grantPrincipal);
    this.websiteAssetsS3Bucket.grantReadWrite(githubProject.grantPrincipal);

    const artifacts = {
      source: new codePipeline.Artifact('Source'),
      githubSource: new codePipeline.Artifact('GithubSource'),
      build: new codePipeline.Artifact('BuildOutput'),
      githubBuild: new codePipeline.Artifact('GithubBuildOutput')
    };

    const githubSecret =
      secrets.Secret.fromSecretCompleteArn(this, 'github-access-token-secret', "arn:aws:secretsmanager:ap-northeast-1:139054167618:secret:NewestGithubPersonalAccessToken-HOm0Xx");

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

      githubSource: new codePipelineActions.GitHubSourceAction({
        actionName: "Github",
        output: artifacts.githubSource,
        owner: 'CallMeCCLemon',
        repo: 'TheDailyAbstractionWebsiteAssets',
        branch: 'main',
        trigger: codePipelineActions.GitHubTrigger.WEBHOOK,
        oauthToken: githubSecret.secretValue
      }),
      githubBuild: new codePipelineActions.CodeBuildAction({
        actionName: 'GithubCodeBuild',
        project: githubProject,
        input: artifacts.githubSource,
        outputs: [artifacts.githubBuild],
      }),
      githubDeploy: new codePipelineActions.S3DeployAction({
        actionName: 'GithubS3Deploy',
        bucket: this.websiteAssetsS3Bucket,
        input: artifacts.githubBuild,
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

    const githubPipeline = new codePipeline.Pipeline(this, 'github-deploy-pipeline', {
      pipelineName: `github-website-deploy-pipeline`,
      stages: [
        {stageName: 'GithubSource', actions: [pipelineActions.githubSource]},
        {stageName: 'GithubBuild', actions: [pipelineActions.githubBuild]},
        {stageName: 'GithubDeploy', actions: [pipelineActions.githubDeploy]},
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