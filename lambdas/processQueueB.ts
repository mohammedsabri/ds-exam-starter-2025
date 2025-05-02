import { SQSEvent, SQSHandler } from 'aws-lambda';

export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log('Processing messages in Queue B');
  
  for (const record of event.Records) {
    try {
      const messageBody = JSON.parse(record.body);
      const userMessage = JSON.parse(messageBody.Message); // Extract the actual message
      
      console.log('Processing message missing email:', JSON.stringify(userMessage));
      
      // Process the message as needed for Queue B
      // This queue handles messages with missing email property
      
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }
};