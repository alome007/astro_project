import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import { OAuth2Client } from 'google-auth-library';
import logger from './logger';
import { ApiError } from '../middlewares/error.middleware';

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
const TOKEN_PATH = path.join(__dirname, '../../token.json');
const CREDENTIALS_PATH = path.join(__dirname, '../../credentials.json');

interface GoogleCredentials {
  installed?: {
    client_secret: string;
    client_id: string;
    redirect_uris: string[];
  };
  web?: {
    client_secret: string;
    client_id: string;
    redirect_uris: string[];
  };
}

interface TokenData {
  refresh_token?: string;
  expiry_date?: number;
  [key: string]: any;
}

/**
 * Get and refresh Google API credentials
 * @returns Promise for OAuth2Client
 */
const getCredentials = async (): Promise<OAuth2Client> => {
  try {
    let credentials: GoogleCredentials;
    try {
      credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    } catch (error) {
      throw new ApiError(500, 'Error loading Google credentials file');
    }

    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web || { client_secret: '', client_id: '', redirect_uris: [''] };
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token
    let token: TokenData;
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        oAuth2Client.setCredentials(token);

        // Refresh token if expired
        if (token.expiry_date && token.expiry_date < Date.now() && token.refresh_token) {
          const { credentials } = await oAuth2Client.refreshAccessToken();
          oAuth2Client.setCredentials(credentials);
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials));
        }

        return oAuth2Client;
      }
    } catch (error: any) {
      logger.error(`Error with token: ${error.message}`);
      // Continue to get new token
    }

    // We need a new token
    throw new ApiError(401, 'Google Calendar authentication required');
  } catch (error) {
    logger.error(`Error in getCredentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
};

/**
 * Get events from Google Calendar for today
 * @param calendarId - Calendar ID (default: primary)
 * @returns - Events as a formatted string
 */
const getEventsForToday = async (calendarId = 'primary'): Promise<string> => {
  try {
    const auth = await getCredentials();
    const calendar = google.calendar({ version: 'v3', auth });
    
    // Get the local timezone (using New York as default based on original code)
    const localTz = 'America/New_York';
    
    const today = moment().tz(localTz).startOf('day');
    const todayEnd = moment().tz(localTz).endOf('day');
    
    const startDateTime = today.toISOString();
    const endDateTime = todayEnd.toISOString();
    
    const response = await calendar.events.list({
      calendarId,
      timeMin: startDateTime,
      timeMax: endDateTime,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    const events = response.data.items || [];
    
    const currentTime = moment().tz(localTz);
    let eventsString = `The current date and time is ${currentTime.format('YYYY-MM-DD HH:mm')} ${localTz}\n`;
    
    if (events.length) {
      for (const event of events) {
        const start = event.start?.dateTime ? moment(event.start.dateTime).tz(localTz) : moment(event.start?.date).tz(localTz);
        const end = event.end?.dateTime ? moment(event.end.dateTime).tz(localTz) : moment(event.end?.date).tz(localTz);
        
        eventsString += `${event.summary} from ${start.format('YYYY-MM-DD HH:mm')} to ${end.format('YYYY-MM-DD HH:mm')}\n`;
      }
    } else {
      eventsString += 'No events for today.\n';
    }
    
    logger.info('Retrieved calendar events successfully');
    return eventsString;
  } catch (error: any) {
    logger.error(`Error retrieving calendar events: ${error.message}`);
    return 'Unable to retrieve calendar events.';
  }
};

export {
  getCredentials,
  getEventsForToday,
};