import twilio from 'twilio';
import axios from 'axios';
import logger from './logger';
import { ApiError } from '../middlewares/error.middleware';

/**
 * Get a configured Twilio client
 * @returns Twilio client
 */
const getTwilioClient = (): ReturnType<typeof twilio> => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken) {
    throw new ApiError(500, 'Twilio credentials are not configured properly');
  }
  
  return twilio(accountSid, authToken);
};

/**
 * Send a text message using Twilio
 * @param toNumber - Recipient phone number
 * @param messageBody - Message content
 * @param fromNumber - Sender phone number
 * @returns - Message SID
 */
const sendTextMessage = async (toNumber: string, messageBody: string, fromNumber: string): Promise<string> => {
  try {
    const twilioClient = getTwilioClient();
    const message = await twilioClient.messages.create({
      body: messageBody,
      from: fromNumber,
      to: toNumber,
    });
    
    logger.info(`Message sent! Message SID: ${message.sid}`);
    return message.sid;
  } catch (error: any) {
    logger.error(`Error sending text message: ${error.message}`);
    throw new ApiError(500, 'Failed to send text message');
  }
};

/**
 * Get caller's phone number from call SID
 * @param callSid - Call SID
 * @returns - Caller's phone number
 */
const getCallerNumber = async (callSid: string): Promise<string> => {
  try {
    const twilioClient = getTwilioClient();
    const call = await twilioClient.calls(callSid).fetch();
    
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    
    // Check if the caller is the Twilio number
    if (call.to === twilioNumber) {
      return call.from;
    } else {
      return call.to;
    }
  } catch (error: any) {
    logger.error(`Error getting caller number: ${error.message}`);
    throw new ApiError(500, 'Failed to retrieve caller number');
  }
};

/**
 * Transfer an ongoing call to a different number
 * @param callSid - Call SID
 * @param newPhoneNumber - Phone number to transfer to
 */
const transferCall = async (callSid: string, newPhoneNumber: string): Promise<void> => {
  try {
    const twilioClient = getTwilioClient();
    const twimlResponse = `<Response><Dial>${newPhoneNumber}</Dial></Response>`;
    
    await twilioClient.calls(callSid).update({ twiml: twimlResponse });
    logger.info(`Call transferred to ${newPhoneNumber} with Call SID: ${callSid}`);
  } catch (error: any) {
    logger.error(`Error transferring call: ${error.message}`);
    throw new ApiError(500, 'Failed to transfer call');
  }
};

/**
 * End an ongoing call
 * @param callSid - Call SID
 */
const endCall = async (callSid: string): Promise<void> => {
  try {
    const twilioClient = getTwilioClient();
    await twilioClient.calls(callSid).update({ status: 'completed' });
    logger.info(`Call with SID ${callSid} has been ended`);
  } catch (error: any) {
    logger.error(`Error ending call: ${error.message}`);
    throw new ApiError(500, 'Failed to end call');
  }
};

/**
 * Schedule a call by sending a calendar link
 * @param phoneNumber - Phone number to send scheduling link to
 * @returns - Message SID
 */
const scheduleCall = async (phoneNumber: string): Promise<string> => {
  try {
    logger.info(`Scheduling call for ${phoneNumber}`);
    const message = `Please schedule a call with Harvey at ${process.env.CALENDLY_URL}`;
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    
    if (!twilioNumber) {
      throw new ApiError(500, 'Twilio phone number is not configured properly');
    }
    
    return await sendTextMessage(phoneNumber, message, twilioNumber);
  } catch (error: any) {
    logger.error(`Error scheduling call: ${error.message}`);
    throw new ApiError(500, 'Failed to schedule call');
  }
};

export {
  getTwilioClient,
  sendTextMessage,
  getCallerNumber,
  transferCall,
  endCall,
  scheduleCall,
};