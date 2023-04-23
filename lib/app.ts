import * as cdk from 'aws-cdk-lib';
import {BlogStack} from "./BlogStack";
import {PipelineStack} from "./PipelineStack";
import {RepositoriesStack} from "./RepositoriesStack";
import {UserPoolStack} from "./UserPoolStack";

const AWS_ACCOUNT_ID = '139054167618';
const DEFAULT_REGION = 'ap-northeast-1';

const app = new cdk.App({
});

const env = {
  account: AWS_ACCOUNT_ID,
  region: DEFAULT_REGION
}

const repositoriesStack = new RepositoriesStack(app, 'repositories-stack', {
  env: env
})

const pipelineStack = new PipelineStack(app, 'pipeline-stack', {
  env: env,
  websiteSourceRepo: repositoriesStack.websiteSourceRepo,
  websiteInfrastructureRepo: repositoriesStack.websiteInfrastructureRepo,
});

const blogStack = new BlogStack(app, 'blog-stack', {
  websiteAssetsS3Bucket: pipelineStack.websiteAssetsS3Bucket,
  originAccessIdentity: pipelineStack.originAccessIdentity,
  env: env
});

const userPoolStack = new UserPoolStack(app, 'user-pool-stack', {
  rootHostedZone: blogStack.topLevelHostedZone
});
userPoolStack.addDependency(blogStack);

app.synth();