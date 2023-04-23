import * as cdk from "aws-cdk-lib";
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as codePipeline from "aws-cdk-lib/aws-codepipeline";
import * as codeCommit from 'aws-cdk-lib/aws-codecommit';
import * as codePipelineActions from "aws-cdk-lib/aws-codepipeline-actions";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import {Construct} from "constructs";
import * as cf from "aws-cdk-lib/aws-cloudfront";

interface PipelineStackProps extends cdk.StackProps {
  websiteAssetsS3Bucket: s3.IBucket;
}

export class PipelineStack extends cdk.Stack {
  constructor(parent: Construct, id: string, props: PipelineStackProps) {
    super(parent, id, props);

    const githubSource = codebuild.Source.gitHub({
      owner: 'CallMeCCLemon',
      repo: 'TheDailyAbstractionWebsiteAssets',
      webhook: true,
      branchOrRef: 'main'
    });

    const buildSpec = this.getBuildSpec();

    const githubProject = new codebuild.Project(this, 'github-website-assets-code-build-project', {
      source: githubSource,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
        privileged: true,
      },
      buildSpec
    });

    props.websiteAssetsS3Bucket.grantReadWrite(githubProject.grantPrincipal);

    const artifacts = {
      githubSource: new codePipeline.Artifact('GithubSource'),
      githubBuild: new codePipeline.Artifact('GithubBuildOutput')
    };

    const githubSecret =
      secrets.Secret.fromSecretCompleteArn(this, 'github-access-token-secret', "arn:aws:secretsmanager:ap-northeast-1:139054167618:secret:NewestGithubPersonalAccessToken-HOm0Xx");

    const pipelineActions = {
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
        bucket: props.websiteAssetsS3Bucket,
        input: artifacts.githubBuild,
      }),
    };

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