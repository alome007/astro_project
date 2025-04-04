import { Request, Response, NextFunction } from 'express';
import { getTwilioClient } from '../utils/twilio.utils';
import logger from '../utils/logger';
import { ApiError } from '../middlewares/error.middleware';

// Enum for call status
enum CallStatus {
  NO_CURRENT_CALL = 'no current call',
  IN_PROGRESS = 'in progress',
  TRANSFERRED = 'transferred',
  SCHEDULED = 'scheduled',
}

// Global variable to track call status
let currentCallStatus = CallStatus.NO_CURRENT_CALL;

/**
 * Trigger an outbound call
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 * @returns Promise<void>
 */
const triggerOutboundCall = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { phone_number } = req.body;

    if (!phone_number) {
      throw new ApiError(400, 'Phone number is required');
    }

    const twilioClient = getTwilioClient();
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    const streamUrl = process.env.STREAM_URL;

    if (!twilioPhoneNumber || !streamUrl) {
      throw new ApiError(500, 'Missing required environment variables');
    }

    const twimlResponse = `<Response>
      <Connect>
        <Stream url="${streamUrl}">
        </Stream>
      </Connect>
      <Pause length='1'/>
    </Response>`;

    const call = await twilioClient.calls.create({
      twiml: twimlResponse,
      to: phone_number,
      from: twilioPhoneNumber,
    });

    currentCallStatus = CallStatus.IN_PROGRESS;
    logger.info(`Call initiated! Call SID: ${call.sid}`);

    res.status(200).json({
      message: `Call initiated! Call SID: ${call.sid}`,
      twilio_call_sid: call.sid,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get the current call status
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 * @returns Promise<void>
 */
const getCallStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    logger.debug(`Current call status: ${currentCallStatus}`);
    
    res.status(200).json({
      call_status: currentCallStatus,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle an inbound call from Twilio
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 * @returns Promise<void>
 */
const handleInboundCall = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const streamUrl = process.env.STREAM_URL;
    
    if (!streamUrl) {
      throw new ApiError(500, 'Missing required environment variable: STREAM_URL');
    }
    
    const callSid = req.body.CallSid;
    const fromNumber = req.body.From;
    const toNumber = req.body.To;
    
    logger.info(`Incoming call from ${fromNumber} to ${toNumber} with Call SID: ${callSid}`);
    
    // Generate TwiML response to handle the call
    const twimlResponse = `<Response>
      <Connect>
        <Stream url="${streamUrl}">
        </Stream>
      </Connect>
    </Response>`;
    
    currentCallStatus = CallStatus.IN_PROGRESS;
    
    // Return TwiML response
    res.set('Content-Type', 'application/xml');
    res.status(200).send(twimlResponse);
  } catch (error) {
    next(error);
  }
};

/**
 * Update the current call status
 * @param status - New call status
 */
const updateCallStatus = (status: CallStatus): void => {
  currentCallStatus = status;
  logger.info(`Call status updated to: ${status}`);
};

export {
  triggerOutboundCall,
  getCallStatus,
  handleInboundCall,
  updateCallStatus,
  CallStatus,
};