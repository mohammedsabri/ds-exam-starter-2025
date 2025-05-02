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
    
    // Grant table permissions to all lambdas that need it
    table.grantReadWriteData(question1Fn);
  }
}