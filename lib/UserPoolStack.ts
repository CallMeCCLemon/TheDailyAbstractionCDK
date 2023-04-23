import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53targets from "aws-cdk-lib/aws-route53-targets";
import {Construct} from "constructs";
import {AUTH_DOMAIN_CERTIFICATE_ARN, HOSTED_ZONE_NAME} from "./constants";

interface UserPoolStackProps extends cdk.StackProps {
  rootHostedZone: route53.IHostedZone;
}

export class UserPoolStack extends cdk.Stack {
  public userPool: cognito.IUserPool;

  constructor(scope: Construct, id: string, props: UserPoolStackProps) {
    super(scope, id, props);
    this.userPool = new cognito.UserPool(this, 'user-pool', {
      userPoolName: 'standardUserPool',
      selfSignUpEnabled: true,
      userVerification: {
        emailSubject: 'Verify your email for TheDailyAbstraction',
        emailBody: 'Thanks for signing up for TheDailyAbstraction. Your verification code is {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      signInAliases: {
        username: true,
        email: true
      },
      autoVerify: {
        email: true
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
        birthdate: {
          required: true,
          mutable: false,
        }
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      email: cognito.UserPoolEmail.withCognito('no-reply@thedailyabstraction.com'),
    });

    const client = this.userPool.addClient('Client', {
      oAuth: {
        flows: {
          implicitCodeGrant: true,
        },
        callbackUrls: [
          `https://${HOSTED_ZONE_NAME}/`,
        ],
        logoutUrls: [
          `https://${HOSTED_ZONE_NAME}/`
        ]
      },
    });

    const domain = this.userPool.addDomain('Domain', {
      customDomain: {
        domainName: `auth.${HOSTED_ZONE_NAME}`,
        certificate: acm.Certificate.fromCertificateArn(this, 'auth-domain-cert', AUTH_DOMAIN_CERTIFICATE_ARN),
      },
    });

    domain.signInUrl(client, {
      redirectUri: `https://${HOSTED_ZONE_NAME}/`
    });

    new route53.ARecord(this, 'LoginAliasRecord', {
      target: route53.RecordTarget.fromAlias(new route53targets.UserPoolDomainTarget(domain)),
      zone: props.rootHostedZone,
      ttl: cdk.Duration.hours(1),
      recordName: 'auth'
    });
  }
}