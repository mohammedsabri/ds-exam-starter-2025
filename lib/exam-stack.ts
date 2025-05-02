import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { generateBatch } from "../shared/util";
import { movieCrew } from "../seed/movies";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";

export class ExamStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    
    // Question 1 - Serverless REST API
    // A table that stores data about a movie's crew, i.e. director, camera operators, etc.
    const table = new dynamodb.Table(this, "MoviesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "role", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "ExamTable",
    });

    const question1Fn = new lambdanode.NodejsFunction(this, "Question1Fn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/question1.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: table.tableName,
        REGION: "eu-west-1",
      },
    });

    // Add Lambda for handling crew API requests
    const crewLambda = new lambdanode.NodejsFunction(this, "CrewLambdaFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/crewHandler.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: table.tableName,
        REGION: "eu-west-1",
      },
    });

    // Grant permissions for the Lambda to read from the DynamoDB table
    table.grantReadData(crewLambda);

    new custom.AwsCustomResource(this, "moviesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [table.tableName]: generateBatch(movieCrew),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [table.tableArn],
      }),
    });

    const api = new apig.RestApi(this, "ExamAPI", {
      description: "Exam api",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    // Create the crew API resource and endpoints
    const crewResource = api.root.addResource("crew");
    const roleResource = crewResource.addResource("{role}");
    const moviesResource = roleResource.addResource("movies");
    const movieIdResource = moviesResource.addResource("{movieId}");
    
    // PART B: Updated to explicitly configure the verbose query parameter
    movieIdResource.addMethod(
      "GET",
      new apig.LambdaIntegration(crewLambda, {
        requestTemplates: { "application/json": '{ "statusCode": "200" }' }
      }),
      {
        requestParameters: {
          "method.request.querystring.verbose": false, // Make verbose parameter optional
        },
        // Document the API to show it accepts a verbose parameter
        methodResponses: [
          {
            statusCode: "200",
            responseModels: {
              "application/json": apig.Model.EMPTY_MODEL,
            },
            responseParameters: {
              "method.response.header.Content-Type": true,
              "method.response.header.Access-Control-Allow-Origin": true,
            },
          },
          {
            statusCode: "400",
            responseModels: {
              "application/json": apig.Model.ERROR_MODEL,
            },
          },
          {
            statusCode: "404",
            responseModels: {
              "application/json": apig.Model.ERROR_MODEL,
            },
          },
        ],
      }
    );

    // Add other API endpoints and resources as needed...
    const anEndpoint = api.root.addResource("patha");

// ==================================
    // Question 2 - Event-Driven architecture




    const bucket = new s3.Bucket(this, "exam-bucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
    });

     // Create SNS Topics
    const topic1 = new sns.Topic(this, "Topic1", {
      displayName: "Topic 1",
      topicName: "exam-topic-1",
    });

    const topic2 = new sns.Topic(this, "Topic2", {
      displayName: "Topic 2",
      topicName: "exam-topic-2",
    });

        // Create SQS Queues
        const queueA = new sqs.Queue(this, "QueueA", {
          queueName: "exam-queue-a",
          visibilityTimeout: cdk.Duration.seconds(30),
        });
        const queueB = new sqs.Queue(this, "QueueB", {
          queueName: "exam-queue-b",
          visibilityTimeout: cdk.Duration.seconds(30),
        });
    
    // const queueB = new sqs.Queue(this, "QueueB", {
    //   receiveMessageWaitTime: cdk.Duration.seconds(5),
    // });

    // const queueA = new sqs.Queue(this, "queueA", {
    //   receiveMessageWaitTime: cdk.Duration.seconds(5),
    // });
    
    const lambdaXFn = new lambdanode.NodejsFunction(this, "LambdaXFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/lambdaX.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        REGION: "eu-west-1",
      },
    });

    const lambdaYFn = new lambdanode.NodejsFunction(this, "LambdaYFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/lambdaY.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        REGION: "eu-west-1",
      },
    });
    // Connect SNS Topics to SQS Queues
    // For now, basic connections. We'll add filtering in Part B
    topic1.addSubscription(new subs.SqsSubscription(queueA));
    topic2.addSubscription(new subs.SqsSubscription(queueB));
    
    // Connect SQS Queues to Lambda functions
    lambdaXFn.addEventSource(new events.SqsEventSource(queueA));
    lambdaYFn.addEventSource(new events.SqsEventSource(queueB));

    // Grant permissions for Lambda A to publish to Topic 2
    topic2.grantPublish(lambdaXFn); 

    // Output the Topic ARN for use with the AWS CLI
    new cdk.CfnOutput(this, "Topic1Arn", {
      value: topic1.topicArn,
      description: "The ARN of Topic 1",
      exportName: "ExamTopic1Arn",
    });
    
    
  }
    
 
  }

