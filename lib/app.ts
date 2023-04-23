import * as cdk from 'aws-cdk-lib';
import {BlogStack} from "./BlogStack";
import {PipelineStack} from "./PipelineStack";
import {UserPoolStack} from "./UserPoolStack";
import {AWS_ACCOUNT_ID, DEFAULT_REGION} from "./constants";
import {BackendStack} from "./BackendStack";

const app = new cdk.App({
});

const env = {
  account: AWS_ACCOUNT_ID,
  region: DEFAULT_REGION
}

const blogStack = new BlogStack(app, 'blog-stack', {
  env: env
});

const userPoolStack = new UserPoolStack(app, 'user-pool-stack', {
  rootHostedZone: blogStack.topLevelHostedZone
});
userPoolStack.addDependency(blogStack);

const backendStack = new BackendStack(app, 'backend-stack', {
  env: env
})

const pipelineStack = new PipelineStack(app, 'pipeline-stack', {
  env: env,
  websiteAssetsS3Bucket: blogStack.websiteAssetsS3Bucket,
  lambdasS3Bucket: backendStack.lambdaSourceBucket,
});

app.synth();