import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import * as codeCommit from 'aws-cdk-lib/aws-codecommit';
import * as chatbot from "aws-cdk-lib/aws-chatbot";
import {CHATBOT_SLACK_CONFIGURATION_ARN} from "./constants";
import {RepositoryNotifyOnOptions} from "aws-cdk-lib/aws-codecommit/lib/repository";

interface RepositoriesStackProps extends cdk.StackProps {

}

export class RepositoriesStack extends cdk.Stack {
  public websiteSourceRepo: codeCommit.IRepository;
  public websiteInfrastructureRepo: codeCommit.IRepository;

  constructor(parent: Construct, id: string, props: RepositoriesStackProps) {
    super(parent, id, props);

    this.websiteSourceRepo = new codeCommit.Repository(this, 'BlogWebsiteRepo', {
      repositoryName: 'BlogWebsiteAssets',
      description: 'Repository for blog react application',
    });
    this.addRepositoryNotifications(this.websiteSourceRepo, 'BlogWebsiteRepo');

    this.websiteInfrastructureRepo = new codeCommit.Repository(this, 'BlogInfrastructureRepo', {
      repositoryName: 'BlogCDK',
      description: "CDK Managed infrastructure repository for the Blog project",
    });
    this.addRepositoryNotifications(this.websiteInfrastructureRepo, 'BlogInfrastructureRepo');
  }

  /**
   * Adds notifications for a given repository any time a PR action occurs.
   *
   * @param repository The repository to add notifications to.
   * @param repositoryName The plain text name for the repository for ID organization. This is unable to use the
   *   {@link repository.repositoryName} attribute due to some issue with being unable to resolve the value during
   *   synthesis.
   */
  addRepositoryNotifications(repository: codeCommit.IRepository, repositoryName: string) {
    const configuration = chatbot.SlackChannelConfiguration.fromSlackChannelConfigurationArn(this, `${repositoryName}-slack-configuration`, CHATBOT_SLACK_CONFIGURATION_ARN)

    const notifyOnOptions: RepositoryNotifyOnOptions = {
      enabled: true,
      events: [
        codeCommit.RepositoryNotificationEvents.PULL_REQUEST_CREATED,
        codeCommit.RepositoryNotificationEvents.PULL_REQUEST_COMMENT,
        codeCommit.RepositoryNotificationEvents.PULL_REQUEST_SOURCE_UPDATED,
        codeCommit.RepositoryNotificationEvents.PULL_REQUEST_STATUS_CHANGED,
        codeCommit.RepositoryNotificationEvents.PULL_REQUEST_MERGED,
      ]
    };

    repository.notifyOn(`${repositoryName}-PR-notifications`, configuration, notifyOnOptions);
  }
}