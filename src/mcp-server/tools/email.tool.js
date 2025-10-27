import { google } from 'googleapis';
import { withAutoRetry } from '../../services/google-connection.js'; // Adjust path to match your project

// In-memory store for pending emails (in production, use Redis or database)
const pendingEmails = new Map();

/**
 * Prepare an email for sending (requires user confirmation)
 * This creates a draft that needs to be confirmed before sending
 */
export async function prepareEmailTool({ userId, to, subject, body, cc = [], bcc = [] }) {
  try {
    // Generate a unique confirmation ID
    const confirmationId = `email_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store email details for confirmation
    const emailData = {
      userId,
      to: Array.isArray(to) ? to : [to],
      subject,
      body,
      cc: Array.isArray(cc) ? cc : (cc ? [cc] : []),
      bcc: Array.isArray(bcc) ? bcc : (bcc ? [bcc] : []),
      createdAt: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000) // Expires in 5 minutes
    };
    
    pendingEmails.set(confirmationId, emailData);
    
    // Clean up expired emails
    cleanupExpiredEmails();
    
    return {
      success: true,
      requiresConfirmation: true,
      confirmationId: confirmationId,
      preview: {
        to: emailData.to.join(', '),
        cc: emailData.cc.length > 0 ? emailData.cc.join(', ') : 'None',
        bcc: emailData.bcc.length > 0 ? emailData.bcc.join(', ') : 'None',
        subject: subject,
        body: body.length > 200 ? body.substring(0, 200) + '...' : body
      },
      message: `📧 Email prepared and ready to send. Please confirm:\n\n` +
               `To: ${emailData.to.join(', ')}\n` +
               (emailData.cc.length > 0 ? `CC: ${emailData.cc.join(', ')}\n` : '') +
               (emailData.bcc.length > 0 ? `BCC: ${emailData.bcc.join(', ')}\n` : '') +
               `Subject: ${subject}\n\n` +
               `${body.substring(0, 300)}${body.length > 300 ? '...' : ''}\n\n` +
               `Reply with "yes", "confirm", or "send" to send this email.\n` +
               `Reply with "no" or "cancel" to cancel.`,
      expiresIn: '5 minutes'
    };
  } catch (error) {
    throw new Error(`Failed to prepare email: ${error.message}`);
  }
}

/**
 * Confirm and send a prepared email
 */
export async function confirmSendEmailTool({ userId, confirmationId, confirmed }) {
  try {
    // Get pending email
    const emailData = pendingEmails.get(confirmationId);
    
    if (!emailData) {
      return {
        success: false,
        error: 'Email not found or has expired. Please prepare a new email.',
        code: 'EMAIL_EXPIRED'
      };
    }
    
    // Verify userId matches
    if (emailData.userId !== userId) {
      return {
        success: false,
        error: 'Unauthorized: This email belongs to a different user.',
        code: 'UNAUTHORIZED'
      };
    }
    
    // Check if expired
    if (Date.now() > emailData.expiresAt) {
      pendingEmails.delete(confirmationId);
      return {
        success: false,
        error: 'Email confirmation has expired. Please prepare a new email.',
        code: 'EMAIL_EXPIRED'
      };
    }
    
    // If not confirmed, cancel
    if (!confirmed) {
      pendingEmails.delete(confirmationId);
      return {
        success: true,
        cancelled: true,
        message: '❌ Email sending cancelled.'
      };
    }
    
    // Send the email
    const result = await withAutoRetry(userId, async (auth) => {
      const gmail = google.gmail({ version: 'v1', auth });

      // Create email message
      const email = [
        `To: ${emailData.to.join(', ')}`,
        emailData.cc.length > 0 ? `Cc: ${emailData.cc.join(', ')}` : '',
        emailData.bcc.length > 0 ? `Bcc: ${emailData.bcc.join(', ')}` : '',
        `Subject: ${emailData.subject}`,
        '',
        emailData.body
      ].filter(line => line).join('\r\n');

      // Encode email in base64url format
      const encodedMessage = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send the email
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      return {
        success: true,
        messageId: response.data.id,
        threadId: response.data.threadId,
        to: emailData.to.join(', '),
        subject: emailData.subject
      };
    });
    
    // Remove from pending after successful send
    pendingEmails.delete(confirmationId);
    
    return {
      ...result,
      message: `✅ Email sent successfully to ${result.to}!`
    };
    
  } catch (error) {
    if (error.code === 'NOT_CONNECTED' || error.code === 'NO_REFRESH' || error.code === 'REFRESH_FAILED') {
      throw new Error(`Gmail not connected: ${error.message}`);
    }
    throw new Error(`Gmail API error: ${error.message}`);
  }
}

/**
 * Clean up expired pending emails
 */
function cleanupExpiredEmails() {
  const now = Date.now();
  for (const [id, email] of pendingEmails.entries()) {
    if (now > email.expiresAt) {
      pendingEmails.delete(id);
    }
  }
}

/**
 * Search emails in Gmail
 */
export async function searchEmailsTool({ userId, query, maxResults = 10 }) {
  try {
    return await withAutoRetry(userId, async (auth) => {
      const gmail = google.gmail({ version: 'v1', auth });

      // Search for messages
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: maxResults
      });

      if (!response.data.messages || response.data.messages.length === 0) {
        return {
          success: true,
          messages: [],
          count: 0,
          message: 'No emails found matching the query'
        };
      }

      // Get full message details for each result
      const messages = await Promise.all(
        response.data.messages.map(async (msg) => {
          const details = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date']
          });

          const headers = details.data.payload.headers;
          const getHeader = (name) => headers.find(h => h.name === name)?.value || '';

          return {
            id: details.data.id,
            threadId: details.data.threadId,
            from: getHeader('From'),
            to: getHeader('To'),
            subject: getHeader('Subject'),
            date: getHeader('Date'),
            snippet: details.data.snippet
          };
        })
      );

      return {
        success: true,
        messages: messages,
        count: messages.length,
        resultSizeEstimate: response.data.resultSizeEstimate
      };
    });
  } catch (error) {
    if (error.code === 'NOT_CONNECTED' || error.code === 'NO_REFRESH' || error.code === 'REFRESH_FAILED') {
      throw new Error(`Gmail not connected: ${error.message}`);
    }
    throw new Error(`Gmail API error: ${error.message}`);
  }
}
