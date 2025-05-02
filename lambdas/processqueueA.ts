
import { SQSEvent, SQSHandler } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const sns = new AWS.SNS();
const TOPIC_ARN = process.env.TOPIC_ARN || '';

export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log('Processing messages in Queue A');
  
  for (const record of event.Records) {
    try {
      const messageBody = JSON.parse(record.body);
      const userMessage = JSON.parse(messageBody.Message); // Extract the actual message
      
      console.log('Processing message:', JSON.stringify(userMessage));
      
      // Process the message as needed for Queue A
      
      // Forward the message to Topic 2
      await sns.publish({
        TopicArn: TOPIC_ARN,
        Message: JSON.stringify(userMessage),
      }).promise();
      
      console.log('Message forwarded to Topic 2');
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }
};