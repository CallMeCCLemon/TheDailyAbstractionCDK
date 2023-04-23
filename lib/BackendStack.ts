import * as cdk from "aws-cdk-lib";
import * as s3 from 'aws-cdk-lib/aws-s3';
import {Construct} from "constructs";


interface BackendStackProps extends cdk.StackProps {

}

export class BackendStack extends cdk.Stack {
  public lambdaSourceBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    this.lambdaSourceBucket = new s3.Bucket(this, 'lambda-source-bucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
    });
  }
}