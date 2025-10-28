import { sendEmail } from '../../services/gmail-email.js';

export async function sendEmailTool({ 
  userId, 
  to, 
  subject, 
  body, 
  cc, 
  bcc, 
  html, 
  replyTo 
}) {
  try {
    console.error(`📧 Email tool called for user: ${userId}`);
    
    if (!userId) {
      throw new Error('userId is required');
    }

    // Validate inputs
    if (!to || !Array.isArray(to)) {
      return {
        success: false,
        error: 'Recipient email addresses (to) must be an array'
      };
    }

    if (to.length === 0) {
      return {
        success: false,
        error: 'At least one recipient email address is required'
      };
    }

    if (!subject || typeof subject !== 'string') {
      return {
        success: false,
        error: 'Email subject is required and must be a string'
      };
    }

    if (!body || typeof body !== 'string') {
      return {
        success: false,
        error: 'Email body is required and must be a string'
      };
    }

    // Send email
    const result = await sendEmail(userId, {
      to,
      subject,
      body,
      cc: cc || [],
      bcc: bcc || [],
      html: html || false,
      replyTo: replyTo || null
    });

    // Format response for AI
    if (result.success) {
      console.error(`✅ Email sent successfully to: ${to.join(', ')}`);
      
      return {
        success: true,
        messageId: result.messageId,
        recipients: {
          to: to,
          cc: cc || [],
          bcc: bcc || []
        },
        message: result.message
      };
    } else {
      console.error(`❌ Email failed: ${result.error}`);
      return {
        success: false,
        error: result.error
      };
    }

  } catch (error) {
    console.error('❌ Email tool error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}