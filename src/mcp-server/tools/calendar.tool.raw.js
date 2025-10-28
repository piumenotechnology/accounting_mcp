import { google } from 'googleapis';
import { withAutoRetry, isGoogleStillConnected } from '../../services/google-connection.js';

// In-memory store for pending calendar events (in production, use Redis or database)
const pendingCalendarEvents = new Map();

/**
 * Prepare a calendar event for creation (requires user confirmation)
 */
export async function prepareCalendarEventTool({ 
  userId,
  summary, 
  description = '', 
  startDateTime, 
  endDateTime,
  timeZone = 'Asia/Makassar',
  attendees = []
}) {
  try {
    // Generate a unique confirmation ID
    const confirmationId = `calendar_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store event details for confirmation
    const eventData = {
      userId,
      summary,
      description,
      startDateTime,
      endDateTime,
      timeZone,
      attendees: Array.isArray(attendees) ? attendees : (attendees ? [attendees] : []),
      createdAt: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000) // Expires in 5 minutes
    };
    
    pendingCalendarEvents.set(confirmationId, eventData);
    
    // Clean up expired events
    cleanupExpiredCalendarEvents();
    
    // Format datetime for display
    const formatDateTime = (dt) => {
      const date = new Date(dt);
      return date.toLocaleString('en-US', { 
        dateStyle: 'full', 
        timeStyle: 'short',
        timeZone: timeZone 
      });
    };
    
    return {
      success: true,
      requiresConfirmation: true,
      confirmationId: confirmationId,
      preview: {
        summary: summary,
        description: description || 'No description',
        start: formatDateTime(startDateTime),
        end: formatDateTime(endDateTime),
        timeZone: timeZone,
        attendees: eventData.attendees.length > 0 ? eventData.attendees.join(', ') : 'None'
      },
      message: `📅 Calendar event prepared and ready to create. Please confirm:\n\n` +
               `Title: ${summary}\n` +
               `Start: ${formatDateTime(startDateTime)}\n` +
               `End: ${formatDateTime(endDateTime)}\n` +
               `Time Zone: ${timeZone}\n` +
               (description ? `Description: ${description}\n` : '') +
               (eventData.attendees.length > 0 ? `Attendees: ${eventData.attendees.join(', ')}\n` : '') +
               `\nReply with "yes", "confirm", or "create" to create this event.\n` +
               `Reply with "no" or "cancel" to cancel.`,
      expiresIn: '5 minutes'
    };
  } catch (error) {
    throw new Error(`Failed to prepare calendar event: ${error.message}`);
  }
}

/**
 * Confirm and create a prepared calendar event
 */
export async function confirmCreateCalendarEventTool({ userId, confirmationId, confirmed }) {
  try {
    // Get pending event
    const eventData = pendingCalendarEvents.get(confirmationId);
    
    if (!eventData) {
      return {
        success: false,
        error: 'Calendar event not found or has expired. Please prepare a new event.',
        code: 'EVENT_EXPIRED'
      };
    }
    
    // Verify userId matches
    if (eventData.userId !== userId) {
      return {
        success: false,
        error: 'Unauthorized: This event belongs to a different user.',
        code: 'UNAUTHORIZED'
      };
    }
    
    // Check if expired
    if (Date.now() > eventData.expiresAt) {
      pendingCalendarEvents.delete(confirmationId);
      return {
        success: false,
        error: 'Event confirmation has expired. Please prepare a new event.',
        code: 'EVENT_EXPIRED'
      };
    }
    
    // If not confirmed, cancel
    if (!confirmed) {
      pendingCalendarEvents.delete(confirmationId);
      return {
        success: true,
        cancelled: true,
        message: '❌ Calendar event creation cancelled.'
      };
    }
    
    // Create the event
    const result = await withAutoRetry(userId, async (auth) => {
      const calendar = google.calendar({ version: 'v3', auth });

      const event = {
        summary: eventData.summary,
        description: eventData.description,
        start: { dateTime: eventData.startDateTime, timeZone: eventData.timeZone },
        end: { dateTime: eventData.endDateTime, timeZone: eventData.timeZone },
        attendees: eventData.attendees.map(email => ({ email })),
        reminders: { useDefault: true }
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        sendUpdates: 'all'
      });

      return {
        success: true,
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
        summary: response.data.summary,
        start: response.data.start.dateTime,
        end: response.data.end.dateTime
      };
    });
    
    // Remove from pending after successful creation
    pendingCalendarEvents.delete(confirmationId);
    
    return {
      ...result,
      message: `✅ Calendar event "${result.summary}" created successfully!`
    };
    
  } catch (error) {
    if (error.code === 'NOT_CONNECTED' || error.code === 'NO_REFRESH' || error.code === 'REFRESH_FAILED') {
      throw new Error(`Google Calendar not connected: ${error.message}`);
    }
    throw new Error(`Calendar API error: ${error.message}`);
  }
}

/**
 * Clean up expired pending calendar events
 */
function cleanupExpiredCalendarEvents() {
  const now = Date.now();
  for (const [id, event] of pendingCalendarEvents.entries()) {
    if (now > event.expiresAt) {
      pendingCalendarEvents.delete(id);
    }
  }
}

/**
 * List calendar events (no confirmation needed - read-only)
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
 * Prepare calendar event update (requires user confirmation)
 */
export async function prepareUpdateCalendarEventTool({
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
    // Fetch current event details first
    const currentEvent = await withAutoRetry(userId, async (auth) => {
      const calendar = google.calendar({ version: 'v3', auth });
      const response = await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId
      });
      return response.data;
    });

    // Generate a unique confirmation ID
    const confirmationId = `calendar_update_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store update details for confirmation
    const updateData = {
      userId,
      eventId,
      summary,
      description,
      startDateTime,
      endDateTime,
      timeZone,
      attendees: Array.isArray(attendees) ? attendees : (attendees ? [attendees] : []),
      currentEvent: {
        summary: currentEvent.summary,
        start: currentEvent.start.dateTime || currentEvent.start.date,
        end: currentEvent.end.dateTime || currentEvent.end.date
      },
      createdAt: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000)
    };
    
    pendingCalendarEvents.set(confirmationId, updateData);
    cleanupExpiredCalendarEvents();
    
    const formatDateTime = (dt) => {
      const date = new Date(dt);
      return date.toLocaleString('en-US', { 
        dateStyle: 'full', 
        timeStyle: 'short',
        timeZone: timeZone 
      });
    };
    
    return {
      success: true,
      requiresConfirmation: true,
      confirmationId: confirmationId,
      preview: {
        changes: {
          summary: { old: currentEvent.summary, new: summary },
          start: { old: formatDateTime(updateData.currentEvent.start), new: formatDateTime(startDateTime) },
          end: { old: formatDateTime(updateData.currentEvent.end), new: formatDateTime(endDateTime) }
        }
      },
      message: `📅 Calendar event update prepared. Please confirm:\n\n` +
               `Current: "${currentEvent.summary}"\n` +
               `New: "${summary}"\n\n` +
               `New Start: ${formatDateTime(startDateTime)}\n` +
               `New End: ${formatDateTime(endDateTime)}\n` +
               `\nReply with "yes", "confirm", or "update" to update this event.\n` +
               `Reply with "no" or "cancel" to cancel.`,
      expiresIn: '5 minutes'
    };
  } catch (error) {
    if (error.code === 'NOT_CONNECTED' || error.code === 'NO_REFRESH' || error.code === 'REFRESH_FAILED') {
      throw new Error(`Google Calendar not connected: ${error.message}`);
    }
    throw new Error(`Calendar API error: ${error.message}`);
  }
}

/**
 * Confirm calendar event update
 */
export async function confirmUpdateCalendarEventTool({ userId, confirmationId, confirmed }) {
  try {
    const updateData = pendingCalendarEvents.get(confirmationId);
    
    if (!updateData) {
      return {
        success: false,
        error: 'Calendar update not found or has expired.',
        code: 'EVENT_EXPIRED'
      };
    }
    
    if (updateData.userId !== userId) {
      return {
        success: false,
        error: 'Unauthorized: This update belongs to a different user.',
        code: 'UNAUTHORIZED'
      };
    }
    
    if (Date.now() > updateData.expiresAt) {
      pendingCalendarEvents.delete(confirmationId);
      return {
        success: false,
        error: 'Update confirmation has expired.',
        code: 'EVENT_EXPIRED'
      };
    }
    
    if (!confirmed) {
      pendingCalendarEvents.delete(confirmationId);
      return {
        success: true,
        cancelled: true,
        message: '❌ Calendar event update cancelled.'
      };
    }
    
    // Update the event
    const result = await withAutoRetry(userId, async (auth) => {
      const calendar = google.calendar({ version: 'v3', auth });

      const event = {
        summary: updateData.summary,
        description: updateData.description,
        start: { dateTime: updateData.startDateTime, timeZone: updateData.timeZone },
        end: { dateTime: updateData.endDateTime, timeZone: updateData.timeZone },
        attendees: updateData.attendees.map(email => ({ email }))
      };

      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: updateData.eventId,
        resource: event,
        sendUpdates: 'all'
      });

      return {
        success: true,
        eventId: response.data.id,
        htmlLink: response.data.htmlLink
      };
    });
    
    pendingCalendarEvents.delete(confirmationId);
    
    return {
      ...result,
      message: `✅ Calendar event updated successfully!`
    };
  } catch (error) {
    if (error.code === 'NOT_CONNECTED' || error.code === 'NO_REFRESH' || error.code === 'REFRESH_FAILED') {
      throw new Error(`Google Calendar not connected: ${error.message}`);
    }
    throw new Error(`Calendar API error: ${error.message}`);
  }
}

/**
 * Prepare calendar event deletion (requires user confirmation)
 */
export async function prepareDeleteCalendarEventTool({ userId, eventId }) {
  try {
    // Fetch event details first
    const eventDetails = await withAutoRetry(userId, async (auth) => {
      const calendar = google.calendar({ version: 'v3', auth });
      const response = await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId
      });
      return response.data;
    });

    const confirmationId = `calendar_delete_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const deleteData = {
      userId,
      eventId,
      eventDetails: {
        summary: eventDetails.summary,
        start: eventDetails.start.dateTime || eventDetails.start.date,
        end: eventDetails.end.dateTime || eventDetails.end.date,
        description: eventDetails.description
      },
      createdAt: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000)
    };
    
    pendingCalendarEvents.set(confirmationId, deleteData);
    cleanupExpiredCalendarEvents();
    
    return {
      success: true,
      requiresConfirmation: true,
      confirmationId: confirmationId,
      preview: {
        summary: eventDetails.summary,
        start: eventDetails.start.dateTime || eventDetails.start.date,
        end: eventDetails.end.dateTime || eventDetails.end.date
      },
      message: `⚠️ You are about to delete this calendar event:\n\n` +
               `"${eventDetails.summary}"\n` +
               `Start: ${new Date(deleteData.eventDetails.start).toLocaleString()}\n\n` +
               `Reply with "yes", "confirm", or "delete" to delete this event.\n` +
               `Reply with "no" or "cancel" to cancel.`,
      expiresIn: '5 minutes'
    };
  } catch (error) {
    if (error.code === 'NOT_CONNECTED' || error.code === 'NO_REFRESH' || error.code === 'REFRESH_FAILED') {
      throw new Error(`Google Calendar not connected: ${error.message}`);
    }
    throw new Error(`Calendar API error: ${error.message}`);
  }
}

/**
 * Confirm calendar event deletion
 */
export async function confirmDeleteCalendarEventTool({ userId, confirmationId, confirmed }) {
  try {
    const deleteData = pendingCalendarEvents.get(confirmationId);
    
    if (!deleteData) {
      return {
        success: false,
        error: 'Calendar deletion not found or has expired.',
        code: 'EVENT_EXPIRED'
      };
    }
    
    if (deleteData.userId !== userId) {
      return {
        success: false,
        error: 'Unauthorized: This deletion belongs to a different user.',
        code: 'UNAUTHORIZED'
      };
    }
    
    if (Date.now() > deleteData.expiresAt) {
      pendingCalendarEvents.delete(confirmationId);
      return {
        success: false,
        error: 'Deletion confirmation has expired.',
        code: 'EVENT_EXPIRED'
      };
    }
    
    if (!confirmed) {
      pendingCalendarEvents.delete(confirmationId);
      return {
        success: true,
        cancelled: true,
        message: '❌ Calendar event deletion cancelled.'
      };
    }
    
    // Delete the event
    await withAutoRetry(userId, async (auth) => {
      const calendar = google.calendar({ version: 'v3', auth });
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: deleteData.eventId,
        sendUpdates: 'all'
      });
    });
    
    pendingCalendarEvents.delete(confirmationId);
    
    return {
      success: true,
      eventId: deleteData.eventId,
      message: `✅ Calendar event "${deleteData.eventDetails.summary}" deleted successfully!`
    };
  } catch (error) {
    if (error.code === 'NOT_CONNECTED' || error.code === 'NO_REFRESH' || error.code === 'REFRESH_FAILED') {
      throw new Error(`Google Calendar not connected: ${error.message}`);
    }
    throw new Error(`Calendar API error: ${error.message}`);
  }
}

/**
 * Check Google Calendar connection (no confirmation needed)
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
