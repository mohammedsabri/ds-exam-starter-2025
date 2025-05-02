import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const TABLE_NAME = process.env.TABLE_NAME || '';
const REGION = process.env.REGION || 'eu-west-1';

AWS.config.update({ region: REGION });

const dynamoDB = new AWS.DynamoDB.DocumentClient();

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Extract path parameters
    const role = event.pathParameters?.role;
    const movieId = event.pathParameters?.movieId;
    
    // Extract verbose query parameter (PART B addition)
    const verbose = event.queryStringParameters?.verbose === 'true';

    if (!role || !movieId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Missing required path parameters' })
      };
    }

    // Convert movieId to number (as our DynamoDB table has movieId as a NUMBER type)
    const movieIdNum = parseInt(movieId);
    
    if (isNaN(movieIdNum)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Invalid movieId format' })
      };
    }

    // PART B: Check if verbose mode is requested
    if (verbose) {
      // Get ALL crew members for the movie when verbose=true
      const params = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'movieId = :movieId',
        ExpressionAttributeValues: {
          ':movieId': movieIdNum
        }
      };

      const result = await dynamoDB.query(params).promise();
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          movieId: movieIdNum,
          crew: result.Items
        })
      };
    } else {
      // Original Part A: Get only the specific crew member by role
      const params = {
        TableName: TABLE_NAME,
        Key: {
          'movieId': movieIdNum,
          'role': role
        }
      };

      const result = await dynamoDB.get(params).promise();
      
      if (!result.Item) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ 
            message: `No crew member with role '${role}' found for movie ${movieIdNum}` 
          })
        };
      }

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result.Item)
      };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
}