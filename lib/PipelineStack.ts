import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import {Construct} from "constructs";
import {NodeCICDPipeline} from "./NodeCICDPipeline";

interface PipelineStackProps extends cdk.StackProps {
  websiteAssetsS3Bucket: s3.IBucket;
  lambdasS3Bucket: s3.IBucket;
}

export class PipelineStack extends cdk.Stack {
  constructor(parent: Construct, id: string, props: PipelineStackProps) {
    super(parent, id, props);

    const githubSecret =
      secrets.Secret.fromSecretCompleteArn(this, 'github-access-token-secret', "arn:aws:secretsmanager:ap-northeast-1:139054167618:secret:NewestGithubPersonalAccessToken-HOm0Xx");

    const websiteAssetsPipeline = new NodeCICDPipeline(this, 'website-assets-pipeline', {
      githubRepositoryOwner: 'CallMeCCLemon',
      githubRepositoryName: 'TheDailyAbstractionWebsiteAssets',
      targetBranchName: 'main',
      githubSecret: githubSecret,
      deploymentBucket: props.websiteAssetsS3Bucket
    });

    const lambdaDeploymentPipeline = new NodeCICDPipeline(this, 'lambda-assets-pipeline', {
      githubRepositoryOwner: 'CallMeCCLemon',
      githubRepositoryName: 'TheDailyAbstractionLambdas',
      targetBranchName: 'main',
      githubSecret: githubSecret,
      deploymentBucket: props.lambdasS3Bucket
    });
  }
}