import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as cfOrigin from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53targets from "aws-cdk-lib/aws-route53-targets";
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import {HOSTED_ZONE_ID, HOSTED_ZONE_NAME, TOP_LEVEL_DOMAIN_CERTIFICATE_ARN} from "./constants";

interface PersonalBlogStackProps extends cdk.StackProps {
  websiteAssetsS3Bucket: s3.IBucket;
  originAccessIdentity: cf.OriginAccessIdentity;
}

export class BlogStack extends cdk.Stack {

  public topLevelHostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: PersonalBlogStackProps) {
    super(scope, id, props);

    this.topLevelHostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'TopLevelHostedZone', {
      zoneName: HOSTED_ZONE_NAME,
      hostedZoneId: HOSTED_ZONE_ID
    });

    const domainCertificate = acm.Certificate.fromCertificateArn(this, 'domain-certificate', TOP_LEVEL_DOMAIN_CERTIFICATE_ARN);

    const distribution = new cf.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: new cfOrigin.S3Origin(props.websiteAssetsS3Bucket, {
          originAccessIdentity: props.originAccessIdentity
        }),
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      domainNames: [
        HOSTED_ZONE_NAME
      ],
      certificate: domainCertificate,
    });

    new route53.ARecord(this, 'WebsiteAliasRecord', {
      target: route53.RecordTarget.fromAlias(new route53targets.CloudFrontTarget(distribution)),
      zone: this.topLevelHostedZone,
      ttl: cdk.Duration.hours(1)
    });
  }
}
