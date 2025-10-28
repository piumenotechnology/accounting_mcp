import { google } from 'googleapis';
import { withAutoRetry } from './google-connection.js';

export async function sendEmail(userId, emailData) {
  try {
    const { to, subject, body, cc, bcc, html, replyTo } = emailData;

    // Validate required fields
    if (!to || !Array.isArray(to) || to.length === 0) {
      return {
        success: false,
        error: 'At least one recipient email address is required'
      };
    }

    if (!subject || !subject.trim()) {
      return {
        success: false,
        error: 'Email subject is required'
      };
    }

    if (!body || !body.trim()) {
      return {
        success: false,
        error: 'Email body is required'
      };
    }

    // Validate email addresses
    const allEmails = [...to, ...(cc || []), ...(bcc || [])];
    for (const email of allEmails) {
      if (!isValidEmail(email)) {
        return {
          success: false,
          error: `Invalid email address: ${email}`
        };
      }
    }

    console.log(`📧 Sending email for user: ${userId}`);
    console.log(`   To: ${to.join(', ')}`);
    console.log(`   Subject: ${subject}`);

    return await withAutoRetry(userId, async (auth) => {
      const gmail = google.gmail({ version: 'v1', auth });

      // Compose MIME message
      const mimeMessage = composeMimeMessage({
        to,
        cc,
        bcc,
        subject,
        body,
        html,
        replyTo
      });

      // Encode to base64
      const encodedMessage = Buffer.from(mimeMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send email via Gmail API
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          threadId: replyTo || undefined // Reply to thread if specified
        }
      });

      console.log(`✅ Email sent successfully. Message ID: ${response.data.id}`);

      return {
        success: true,
        messageId: response.data.id,
        threadId: response.data.threadId,
        message: `Email sent successfully to ${to.join(', ')}`
      };
    });

  } catch (error) {
    console.error('❌ Email sending error:', error.message);

    if (error.code === 'NOT_CONNECTED' || error.code === 'NO_REFRESH' || error.code === 'REFRESH_FAILED') {
      return {
        success: false,
        error: 'Gmail not connected. Please reconnect your Google account.'
      };
    }

    // Check for quota errors
    if (error.message && error.message.includes('quota')) {
      return {
        success: false,
        error: 'Gmail daily sending limit reached. Please try again tomorrow.'
      };
    }

    return {
      success: false,
      error: `Failed to send email: ${error.message}`
    };
  }
}

function composeMimeMessage({ to, cc, bcc, subject, body, html, replyTo }) {
  const boundary = '----=_Part_0_' + Date.now();
  const lines = [];

  // Headers
  lines.push(`To: ${to.join(', ')}`);
  
  if (cc && cc.length > 0) {
    lines.push(`Cc: ${cc.join(', ')}`);
  }
  
  if (bcc && bcc.length > 0) {
    lines.push(`Bcc: ${bcc.join(', ')}`);
  }
  
  lines.push(`Subject: ${subject}`);
  lines.push('MIME-Version: 1.0');

  if (replyTo) {
    lines.push(`In-Reply-To: ${replyTo}`);
    lines.push(`References: ${replyTo}`);
  }

  // Content type
  if (html) {
    lines.push(`Content-Type: text/html; charset=UTF-8`);
    lines.push('Content-Transfer-Encoding: 7bit');
    lines.push('');
    lines.push(body);
  } else {
    lines.push(`Content-Type: text/plain; charset=UTF-8`);
    lines.push('Content-Transfer-Encoding: 7bit');
    lines.push('');
    lines.push(body);
  }

  return lines.join('\r\n');
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export async function getGmailProfile(userId) {
  try {
    return await withAutoRetry(userId, async (auth) => {
      const gmail = google.gmail({ version: 'v1', auth });

      const response = await gmail.users.getProfile({
        userId: 'me'
      });

      return {
        success: true,
        emailAddress: response.data.emailAddress,
        messagesTotal: response.data.messagesTotal,
        threadsTotal: response.data.threadsTotal
      };
    });
  } catch (error) {
    console.error('❌ Error getting Gmail profile:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function searchEmails(userId, query, maxResults = 10) {
  try {
    return await withAutoRetry(userId, async (auth) => {
      const gmail = google.gmail({ version: 'v1', auth });

      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: maxResults
      });

      const messages = response.data.messages || [];

      return {
        success: true,
        messages: messages.map(msg => ({
          id: msg.id,
          threadId: msg.threadId
        })),
        count: messages.length
      };
    });
  } catch (error) {
    console.error('❌ Error searching emails:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}