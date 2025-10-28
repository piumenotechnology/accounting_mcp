// import { google } from 'googleapis';
// import {withAutoRetry, isGoogleStillConnected } from '../../services/google-connection.js';

// //Create a Google Calendar event
// export async function createCalendarEventTool({ 
//   userId,
//   summary, 
//   description = '', 
//   startDateTime, 
//   endDateTime,
//   timeZone = 'Asia/Makassar', // This will now come from AI
//   attendees = []
// }) {
//   try {
//     return await withAutoRetry(userId, async (auth) => {
//       const calendar = google.calendar({ version: 'v3', auth });

//       console.log(`📅 Creating calendar event in timezone: ${timeZone}`);

//       const event = {
//         summary,
//         description,
//         start: { dateTime: startDateTime, timeZone },
//         end: { dateTime: endDateTime, timeZone },
//         attendees: attendees.map(email => ({ email })),
//         reminders: { useDefault: true }
//       };

//       const response = await calendar.events.insert({
//         calendarId: 'primary',
//         resource: event,
//         sendUpdates: 'all'
//       });

//       return {
//         success: true,
//         eventId: response.data.id,
//         htmlLink: response.data.htmlLink,
//         summary: response.data.summary,
//         start: response.data.start.dateTime,
//         end: response.data.end.dateTime,
//         timezone: timeZone,
//         message: `Event "${summary}" created successfully in ${timeZone}!`
//       };
//     });
//   } catch (error) {
//     if (error.code === 'NOT_CONNECTED' || error.code === 'NO_REFRESH' || error.code === 'REFRESH_FAILED') {
//       throw new Error(`Google Calendar not connected: ${error.message}`);
//     }
//     throw new Error(`Calendar API error: ${error.message}`);
//   }
// }
// //List upcoming calendar events
// export async function listCalendarEventsTool({ 
//   userId,
//   maxResults = 10,
//   timeMin = new Date().toISOString()
// }) {
//   try {
//     return await withAutoRetry(userId, async (auth) => {
//       const calendar = google.calendar({ version: 'v3', auth });

//       const response = await calendar.events.list({
//         calendarId: 'primary',
//         timeMin,
//         maxResults,
//         singleEvents: true,
//         orderBy: 'startTime'
//       });

//       const events = response.data.items || [];

//       return {
//         success: true,
//         events: events.map(event => ({
//           id: event.id,
//           summary: event.summary,
//           description: event.description,
//           start: event.start.dateTime || event.start.date,
//           end: event.end.dateTime || event.end.date,
//           htmlLink: event.htmlLink,
//           attendees: event.attendees?.map(a => a.email) || []
//         })),
//         count: events.length,
//         message: events.length === 0 ? 'No upcoming events found.' : `Found ${events.length} events`
//       };
//     });
//   } catch (error) {
//     if (error.code === 'NOT_CONNECTED' || error.code === 'NO_REFRESH' || error.code === 'REFRESH_FAILED') {
//       throw new Error(`Google Calendar not connected: ${error.message}`);
//     }
//     throw new Error(`Calendar API error: ${error.message}`);
//   }
// }

// //Update calendar event
// export async function updateCalendarEventTool({
//   userId,
//   eventId,
//   summary,
//   description,
//   startDateTime,
//   endDateTime,
//   timeZone = 'Asia/Makassar',
//   attendees = []
// }) {
//   try {
//     return await withAutoRetry(userId, async (auth) => {
//       const calendar = google.calendar({ version: 'v3', auth });

//       const event = {
//         summary,
//         description,
//         start: { dateTime: startDateTime, timeZone },
//         end: { dateTime: endDateTime, timeZone },
//         attendees: attendees.map(email => ({ email }))
//       };

//       const response = await calendar.events.update({
//         calendarId: 'primary',
//         eventId,
//         resource: event,
//         sendUpdates: 'all'
//       });

//       return {
//         success: true,
//         eventId: response.data.id,
//         htmlLink: response.data.htmlLink,
//         message: `Event updated successfully!`
//       };
//     });
//   } catch (error) {
//     if (error.code === 'NOT_CONNECTED' || error.code === 'NO_REFRESH' || error.code === 'REFRESH_FAILED') {
//       throw new Error(`Google Calendar not connected: ${error.message}`);
//     }
//     throw new Error(`Calendar API error: ${error.message}`);
//   }
// }

// //Delete calendar event
// export async function deleteCalendarEventTool({ userId, eventId }) {
//   try {
//     return await withAutoRetry(userId, async (auth) => {
//       const calendar = google.calendar({ version: 'v3', auth });

//       await calendar.events.delete({
//         calendarId: 'primary',
//         eventId,
//         sendUpdates: 'all'
//       });

//       return {
//         success: true,
//         eventId,
//         message: `Event deleted successfully!`
//       };
//     });
//   } catch (error) {
//     if (error.code === 'NOT_CONNECTED' || error.code === 'NO_REFRESH' || error.code === 'REFRESH_FAILED') {
//       throw new Error(`Google Calendar not connected: ${error.message}`);
//     }
//     throw new Error(`Calendar API error: ${error.message}`);
//   }
// }

// //Check Google connection
// export async function checkGoogleConnectionTool({ userId }) {
//   try {
//     const connected = await isGoogleStillConnected(userId);
//     return {
//       connected,
//       message: connected 
//         ? 'Google Auth is connected and ready.'
//         : 'Google Auth is not connected. Please reconnect.'
//     };
//   } catch (error) {
//     return {
//       connected: false,
//       message: error.message
//     };
//   }
// }

import { google } from 'googleapis';
import { withAutoRetry, isGoogleStillConnected } from '../../services/google-connection.js'; // ← Your actual file

/**
 * Create a Google Calendar event
 */
export async function createCalendarEventTool({ 
  userId,
  summary, 
  description = '', 
  startDateTime, 
  endDateTime,
  timeZone = 'Asia/Makassar',
  attendees = []
}) {
  try {
    console.log('📅 Creating calendar event for user:', userId);
    console.log('   Summary:', summary);
    console.log('   Start:', startDateTime);
    console.log('   End:', endDateTime);
    console.log('   TimeZone:', timeZone);
    console.log('   Attendees:', attendees);
    
    return await withAutoRetry(userId, async (auth) => {
      console.log('✅ Auth obtained, creating calendar client...');
      
      const calendar = google.calendar({ version: 'v3', auth });

      const event = {
        summary,
        description,
        start: { dateTime: startDateTime, timeZone },
        end: { dateTime: endDateTime, timeZone },
        attendees: attendees.map(email => ({ email })),
        reminders: { useDefault: true }
      };

      console.log('📤 Inserting event into Google Calendar...');
      const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        sendUpdates: 'all'
      });

      console.log('✅ Event created successfully:', response.data.id);

      return {
        success: true,
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
        summary: response.data.summary,
        start: response.data.start.dateTime,
        end: response.data.end.dateTime,
        timezone: timeZone,
        message: `Event "${summary}" created successfully in ${timeZone}!`
      };
    });
  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Calendar Tool Error');
    console.error('   Error message:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Error response:', error.response?.data);
    console.error('   Full error:', error);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (error.code === 'NOT_CONNECTED' || error.code === 'NO_REFRESH' || error.code === 'REFRESH_FAILED') {
      throw new Error(`Google Calendar not connected: ${error.message}`);
    }
    throw new Error(`Calendar API error: ${error.message}`);
  }
}

/**
 * List upcoming calendar events
 */
export async function listCalendarEventsTool({ 
  userId,
  maxResults = 10,
  timeMin = new Date().toISOString()
}) {
  try {
    return await withAutoRetry(userId, async (auth) => {
      const calendar = google.calendar({ version: 'v3', auth });

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events = response.data.items || [];

      return {
        success: true,
        events: events.map(event => ({
          id: event.id,
          summary: event.summary,
          description: event.description,
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date,
          htmlLink: event.htmlLink,
          attendees: event.attendees?.map(a => a.email) || []
        })),
        count: events.length,
        message: events.length === 0 ? 'No upcoming events found.' : `Found ${events.length} events`
      };
    });
  } catch (error) {
    if (error.code === 'NOT_CONNECTED' || error.code === 'NO_REFRESH' || error.code === 'REFRESH_FAILED') {
      throw new Error(`Google Calendar not connected: ${error.message}`);
    }
    throw new Error(`Calendar API error: ${error.message}`);
  }
}

/**
 * Update calendar event
 */
export async function updateCalendarEventTool({
  userId,
  eventId,
  summary,
  description,
  startDateTime,
  endDateTime,
  timeZone = 'Asia/Makassar',
  attendees = []
}) {
  try {
    return await withAutoRetry(userId, async (auth) => {
      const calendar = google.calendar({ version: 'v3', auth });

      const event = {
        summary,
        description,
        start: { dateTime: startDateTime, timeZone },
        end: { dateTime: endDateTime, timeZone },
        attendees: attendees.map(email => ({ email }))
      };

      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId,
        resource: event,
        sendUpdates: 'all'
      });

      return {
        success: true,
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
        message: `Event updated successfully!`
      };
    });
  } catch (error) {
    if (error.code === 'NOT_CONNECTED' || error.code === 'NO_REFRESH' || error.code === 'REFRESH_FAILED') {
      throw new Error(`Google Calendar not connected: ${error.message}`);
    }
    throw new Error(`Calendar API error: ${error.message}`);
  }
}

/**
 * Delete calendar event
 */
export async function deleteCalendarEventTool({ userId, eventId }) {
  try {
    return await withAutoRetry(userId, async (auth) => {
      const calendar = google.calendar({ version: 'v3', auth });

      await calendar.events.delete({
        calendarId: 'primary',
        eventId,
        sendUpdates: 'all'
      });

      return {
        success: true,
        eventId,
        message: `Event deleted successfully!`
      };
    });
  } catch (error) {
    if (error.code === 'NOT_CONNECTED' || error.code === 'NO_REFRESH' || error.code === 'REFRESH_FAILED') {
      throw new Error(`Google Calendar not connected: ${error.message}`);
    }
    throw new Error(`Calendar API error: ${error.message}`);
  }
}

/**
 * Check Google connection
 */
export async function checkGoogleConnectionTool({ userId }) {
  try {
    const connected = await isGoogleStillConnected(userId);
    return {
      connected,
      message: connected 
        ? 'Google Calendar is connected and ready.'
        : 'Google Calendar is not connected. Please reconnect.'
    };
  } catch (error) {
    return {
      connected: false,
      message: error.message
    };
  }
}