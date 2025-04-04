import WebSocket from 'ws';
import { getEventsForToday } from '../utils/google.utils';
import { transferCall, getCallerNumber, endCall, scheduleCall } from '../utils/twilio.utils';
import logger from '../utils/logger';
import { updateCallStatus, CallStatus } from '../controllers/call.controller';

interface CallState {
  callSid: string | null;
  streamSid: string | null;
  linkSent: boolean;
}

interface TwilioStartData {
  callSid?: string;
}

interface TwilioMessage {
  event: string;
  streamSid?: string;
  start?: TwilioStartData;
  media?: {
    payload: string;
  };
}

interface OpenAIResponse {
  type: string;
  delta?: string;
  name?: string;
}

/**
 * Set up the WebSocket handlers
 * @param wss - WebSocket server instance
 */
const setupWebSocketHandlers = (wss: WebSocket.Server): void => {
  wss.on('connection', async (websocket: WebSocket) => {
    logger.info('WebSocket connection established');
    
    const state: CallState = {
      callSid: null,
      streamSid: null,
      linkSent: false
    };
    
    try {
      // Connect to OpenAI Realtime API
      const openaiWs = await connectToOpenAI();
      
      // Send session update with system prompt
      await sendSessionUpdate(openaiWs);
      
      // Set up the communication between Twilio and OpenAI
      setupTwilioToOpenAIBridge(websocket, openaiWs, state);
      
      websocket.on('close', () => {
        logger.info('WebSocket connection closed');
        openaiWs.close();
        updateCallStatus(CallStatus.NO_CURRENT_CALL);
      });
      
      websocket.on('error', (error) => {
        logger.error(`WebSocket error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        openaiWs.close();
        updateCallStatus(CallStatus.NO_CURRENT_CALL);
      });
    } catch (error: any) {
      logger.error(`Error in WebSocket connection: ${error.message}`);
      websocket.close();
      updateCallStatus(CallStatus.NO_CURRENT_CALL);
    }
  });
};

/**
 * Connect to OpenAI Realtime API
 * @returns Promise for OpenAI WebSocket connection
 */
const connectToOpenAI = async (): Promise<WebSocket> => {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      throw new Error('Missing OpenAI API key');
    }
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
        {
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'OpenAI-Beta': 'realtime=v1',
          },
        }
      );
      
      ws.on('open', () => {
        logger.info('Connected to OpenAI Realtime API');
        resolve(ws);
      });
      
      ws.on('error', (error: any) => {
        logger.error(`OpenAI WebSocket error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        reject(error);
      });
    });
  } catch (error: any) {
    logger.error(`Failed to connect to OpenAI: ${error.message}`);
    throw error;
  }
};

/**
 * Send session update to OpenAI WebSocket
 * @param openaiWs - OpenAI WebSocket connection
 */
const sendSessionUpdate = async (openaiWs: WebSocket): Promise<void> => {
  try {
    const events = await getEventsForToday();
    
    const systemPrompt = `
      You are a personal assistant named Inari, with the personality and mannerisms of Inari from Suits. Inari's personality traits include:
      Intelligent and Perceptive: Inari possesses an exceptional ability to read people and situations, often anticipating needs and outcomes before others do. Her insights are invaluable to the firm and its clients.
      Confident and Assertive: She exudes confidence and isn't afraid to speak her mind, even in challenging situations. Inari stands her ground and advocates for what she believes is right.
      Witty and Charismatic: Known for her sharp wit and sense of humor, she brings levity to tense situations and is well-liked by her colleagues.
      Empathetic and Loyal: Inari is deeply caring and goes to great lengths to support those she values, especially Harvey Specter. Her loyalty is unwavering, and she often serves as the emotional backbone for her friends and coworkers.
      Professional and Resourceful: Highly skilled in her role, Inari is indispensable to the firm's operations. She is organized, efficient, and knows the inner workings of the legal world, even without being a lawyer herself.
      
      Your task is to be a personal assistant to Harvey Specter and NOT the firm. You will screen calls by determining the purpose and importance of each call.
      Categorize the importance as 'none', 'some', or 'very'. Be efficient and direct in your communication, just like Inari would be.
      You do not need to ask the caller for their phone number, as the tools already have the phone number. Be as concise as possible in your responses.
      
      If you suspect the caller is a spammer or scammer, respond with a witty or dismissive comment, then use the hang_up tool to end the call immediately.
      If the call is not important, politely ask the caller to schedule a call with Harvey by using the schedule_call tool, which will send them a scheduling link.
      
      If the call is 'some' importance, then use the following events information to check Harvey's schedule for today and if he's free, transfer the call to Harvey using the transfer_call tool. Otherwise, just ask the caller to schedule a call at the link you're sending them and then use the schedule_call tool, insisting that he's busy right now.
      If the caller asks when Harvey is free next, tell them the specific time the current event ends. ${events}
      
      If the call is important, transfer the call to Harvey using the transfer_call tool. Only transfer the call if it's very important or from a family member, otherwise just ask the caller to schedule a call at the link you're sending them and then use the schedule_call tool.
      
      Always end the call with a brief, natural-sounding sign-off that fits the context of the conversation. Vary your sign-offs to sound more human-like. After the sign-off, use the appropriate tool (hang_up, schedule_call, or transfer_call) to end the interaction.
    `;
    
    const sessionUpdate = {
      type: 'session.update',
      session: {
        turn_detection: { type: 'server_vad' },
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        voice: 'alloy',
        instructions: systemPrompt,
        modalities: ['text', 'audio'],
        temperature: 0.7,
        tools: [
          {
            type: 'function',
            name: 'transfer_call',
            description: 'Transfers an ongoing call to Harvey\'s phone number.',
          },
          {
            type: 'function',
            name: 'schedule_call',
            description: 'Schedules a call by sending a scheduling link to the provided phone number.',
          },
          {
            type: 'function',
            name: 'hang_up',
            description: 'Ends the current call.',
          },
        ],
        tool_choice: 'auto',
      },
    };
    
    await new Promise<void>((resolve, reject) => {
      openaiWs.send(JSON.stringify(sessionUpdate), (error) => {
        if (error) {
          logger.error(`Error sending session update: ${error instanceof Error ? error.message : 'Unknown error'}`);
          reject(error);
        } else {
          resolve();
        }
      });
    });
    
    logger.info('Session update sent to OpenAI');
  } catch (error: any) {
    logger.error(`Error in sendSessionUpdate: ${error.message}`);
    throw error;
  }
};

/**
 * Set up the bridge between Twilio and OpenAI
 * @param twilioWs - Twilio WebSocket connection
 * @param openaiWs - OpenAI WebSocket connection
 * @param state - State object to track call information
 */
const setupTwilioToOpenAIBridge = (twilioWs: WebSocket, openaiWs: WebSocket, state: CallState): void => {
  // Handle messages from Twilio
  twilioWs.on('message', async (message: WebSocket.Data) => {
    try {
      const data = JSON.parse(message.toString()) as TwilioMessage;
      
      if (data.event === 'start') {
        state.streamSid = data.streamSid || null;
        state.callSid = data.start?.callSid || null;
        logger.info(`Call started with SID: ${state.callSid}`);
      } else if (data.event === 'media' && data.media?.payload) {
        // Send audio to OpenAI
        const audioAppend = {
          type: 'input_audio_buffer.append',
          audio: data.media.payload,
        };
        openaiWs.send(JSON.stringify(audioAppend));
      }
    } catch (error: any) {
      logger.error(`Error handling Twilio message: ${error.message}`);
    }
  });

  // Handle messages from OpenAI
  openaiWs.on('message', async (message: WebSocket.Data) => {
    try {
      const response = JSON.parse(message.toString()) as OpenAIResponse;
      const harveyPhoneNumber = process.env.HARVEY_PHONE_NUMBER;
      
      // Handle audio responses from OpenAI
      if (response.type === 'response.audio.delta' && response.delta) {
        const audioDelta = {
          event: 'media',
          streamSid: state.streamSid,
          media: { payload: response.delta },
        };
        twilioWs.send(JSON.stringify(audioDelta));
      }
      
      // Handle function calls from OpenAI
      else if (response.type === 'response.function_call_arguments.done') {
        const functionName = response.name;
        
        // Wait a short time to allow final audio to be sent
        setTimeout(async () => {
          try {
            if (!functionName) {
              logger.warn('Function name is missing in the response');
              return;
            }
            
            switch (functionName) {
              case 'transfer_call':
                if (state.callSid) {
                  updateCallStatus(CallStatus.TRANSFERRED);
                  if (!harveyPhoneNumber) {
                    logger.error('Harvey\'s phone number is not configured');
                    break;
                  }
                  logger.info(`Transferring call ${state.callSid} to ${harveyPhoneNumber}`);
                  await transferCall(state.callSid, harveyPhoneNumber);
                }
                break;
                
              case 'schedule_call':
                if (state.callSid && !state.linkSent && state.callSid) {
                  updateCallStatus(CallStatus.SCHEDULED);
                  const phoneNumber = await getCallerNumber(state.callSid);
                  await scheduleCall(phoneNumber);
                  logger.info(`Scheduling link sent to ${phoneNumber}`);
                  state.linkSent = true;
                }
                break;
                
              case 'hang_up':
                if (state.callSid) {
                  updateCallStatus(CallStatus.NO_CURRENT_CALL);
                  await endCall(state.callSid);
                }
                break;
                
              default:
                logger.warn(`Unknown function call: ${functionName}`);
            }
          } catch (error: any) {
            logger.error(`Error executing function ${functionName}: ${error.message}`);
          }
        }, 5000); // 5 second delay
      }
    } catch (error: any) {
      logger.error(`Error handling OpenAI message: ${error.message}`);
      updateCallStatus(CallStatus.NO_CURRENT_CALL);
    }
  });
};

export default setupWebSocketHandlers;