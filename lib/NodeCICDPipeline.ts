import {Construct} from "constructs";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codePipeline from "aws-cdk-lib/aws-codepipeline";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import * as codePipelineActions from "aws-cdk-lib/aws-codepipeline-actions";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib";
import {StageProps} from "aws-cdk-lib/aws-codepipeline/lib/pipeline";

interface NodeCICDPipelineProps {
  githubRepositoryName: string;
  githubRepositoryOwner: string;
  targetBranchName: string;
  githubSecret: secrets.ISecret;
  deploymentBucket: s3.IBucket;
  extractZipBeforeDeploying: boolean;
  outputObjectKey?: string;
  buildSpec?: codebuild.BuildSpec;
  apiBuildSpec?: codebuild.BuildSpec;
}

export class NodeCICDPipeline extends Construct {
  constructor(parent: Construct, id: string, props: NodeCICDPipelineProps) {
    super(parent, id);

    const githubSource = codebuild.Source.gitHub({
      owner: props.githubRepositoryOwner,
      repo: props.githubRepositoryName,
      webhook: true,
      branchOrRef: props.targetBranchName
    });

    // Set the build spec to the default for codebuild if none is provided.
    const buildSpec = props.buildSpec ?? this.getBuildSpec();

    const githubProject = new codebuild.Project(this, `${props.githubRepositoryName}-build-project`, {
      source: githubSource,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
        privileged: true,
        computeType: codebuild.ComputeType.SMALL,
      },
      timeout: cdk.Duration.minutes(30),
      buildSpec
    });

    props.deploymentBucket.grantReadWrite(githubProject.grantPrincipal);

    const artifacts = {
      source: new codePipeline.Artifact(`${props.githubRepositoryName}Source`),
      buildOutput: new codePipeline.Artifact(`${props.githubRepositoryName}BuildOutput`),
      apiBuildOutput: new codePipeline.Artifact(`${props.githubRepositoryName}ApiBuildOutput`),
    };

    const pipelineActions = {
      githubSource: new codePipelineActions.GitHubSourceAction({
        actionName: "Github",
        output: artifacts.source,
        owner: props.githubRepositoryOwner,
        repo: props.githubRepositoryName,
        branch: props.targetBranchName,
        trigger: codePipelineActions.GitHubTrigger.WEBHOOK,
        oauthToken: props.githubSecret.secretValue
      }),
      githubBuild: new codePipelineActions.CodeBuildAction({
        actionName: 'Build',
        project: githubProject,
        input: artifacts.source,
        outputs: [artifacts.buildOutput],
      }),
      githubDeploy: new codePipelineActions.S3DeployAction({
        actionName: 'Deploy',
        bucket: props.deploymentBucket,
        input: artifacts.buildOutput,
        extract: props.extractZipBeforeDeploying,
        objectKey: props.outputObjectKey
      }),
    };

    let buildActions = [
      pipelineActions.githubBuild
    ];

    let deployActions = [
      pipelineActions.githubDeploy
    ]

    if (props.apiBuildSpec) {
      const apiBuildProject = new codebuild.Project(this, `${props.githubRepositoryName}-api-build-project`, {
        source: githubSource,
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
          privileged: true,
          computeType: codebuild.ComputeType.SMALL,
        },
        timeout: cdk.Duration.minutes(30),
        buildSpec: props.apiBuildSpec
      });

      buildActions.push(
        new codePipelineActions.CodeBuildAction({
          actionName: 'ApiBuild',
          project: apiBuildProject,
          input: artifacts.source,
          outputs: [artifacts.apiBuildOutput],
        })
      );

      deployActions.push(
        new codePipelineActions.S3DeployAction({
          actionName: 'ApiDeploy',
          bucket: props.deploymentBucket,
          input: artifacts.apiBuildOutput,
          extract: true,
        })
      );
    }

    let pipelineStages: StageProps[] = [
      {stageName: 'Github', actions: [pipelineActions.githubSource]},
      {stageName: 'Build', actions: buildActions},
      {stageName: 'Deploy', actions: deployActions},
    ];

    const githubPipeline = new codePipeline.Pipeline(this, `${props.githubRepositoryName}-deployment-pipeline`, {
      pipelineName: `${props.githubRepositoryName}-deployment-pipeline`,
      stages: pipelineStages,
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