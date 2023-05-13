import * as codebuild from "aws-cdk-lib/aws-codebuild";

export const LAMBDA_PACKAGE_BUILD_SPEC = codebuild.BuildSpec.fromObject({
  version: '0.2',
  env: {
    shell: 'bash'
  },
  phases: {
    pre_build: {
      commands: [
        'echo Build started on `date`',
        'aws --version',
        'gradle --version',
        'node --version',
        'npm install',
      ],
    },
    build: {
      commands: [
        './gradlew build',
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
    // ['base-directory']: 'build',
    files: [
      'build/**/*',
      'server/codegen/build/smithyprojections/codegen/apigateway/openapi/TheDailyAbstractionGateway.openapi.json'
    ]
  },
  cache: {
    paths: ['node_modules/**/*']
  }
});

export const SMITHY_MODEL_BUILD_SPEC = codebuild.BuildSpec.fromObject({
  version: '0.2',
  env: {
    shell: 'bash'
  },
  phases: {
    pre_build: {
      commands: [
        'echo Build started on `date`',
        'aws --version',
        'gradle --version',
      ],
    },
    build: {
      commands: [
        './gradlew build',
      ],
    },
    post_build: {
      commands: [
        'echo Build completed on `date`',
      ]
    }
  },
  artifacts: {
    // ['base-directory']: 'build',
    'discard-paths': true,
    files: [
      'server/codegen/build/smithyprojections/codegen/apigateway/openapi/*'
    ]
  },
  cache: {
  }
});