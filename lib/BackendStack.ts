import * as cdk from "aws-cdk-lib";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apig from 'aws-cdk-lib/aws-apigateway';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import {Construct} from "constructs";
import {API_DEFINITION_KEY, API_DOMAIN_CERTIFICATE_ARN, HOSTED_ZONE_NAME, LAMBDA_OUTPUT_KEY} from "./constants";


interface BackendStackProps extends cdk.StackProps {

}

export class BackendStack extends cdk.Stack {
  public lambdaSourceBucket: s3.IBucket;
  public lambdaFunction: lambda.IFunction;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    this.lambdaSourceBucket = new s3.Bucket(this, 'lambda-source-bucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
    });

    this.lambdaFunction = new lambda.Function(this, 'backend-lambda-function', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'TestLambda/index.handler',
      code: lambda.Code.fromBucket(this.lambdaSourceBucket, LAMBDA_OUTPUT_KEY),
      timeout: cdk.Duration.minutes(1),
      memorySize: 128,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    const apiGatewayCert = acm.Certificate.fromCertificateArn(this, 'api-domain-cert', API_DOMAIN_CERTIFICATE_ARN);
    const assetDefinition = apig.AssetApiDefinition.fromBucket(this.lambdaSourceBucket, API_DEFINITION_KEY);

    // const apiGateway = new apig.LambdaRestApi(this, 'backend-api-gateway', {
    //   handler: this.lambdaFunction,
    //   proxy: true,
    //   deploy: true,
    //   retainDeployments: true,
    //   domainName: {
    //     domainName: `api.${HOSTED_ZONE_NAME}`,
    //     certificate: apiGatewayCert,
    //   },
    //   integrationOptions: {
    //     proxy: true,
    //
    //   }
    // });
  }
}