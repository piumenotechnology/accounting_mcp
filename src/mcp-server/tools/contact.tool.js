import { searchContactInGmail } from '../../services/gmail-contact-search.js';

export async function searchContactTool({ userId, name }) {
  try {
    console.error(`🔍 Contact search tool called for: "${name}"`);
    
    if (!userId) {
      throw new Error('userId is required');
    }

    if (!name || typeof name !== 'string') {
      return {
        success: false,
        error: 'Name parameter is required and must be a string'
      };
    }

    // Search Gmail for contact
    const result = await searchContactInGmail(userId, name.trim());

    // Format response for AI
    if (result.success && result.match) {
      // Single match found
      return {
        success: true,
        email: result.match.email,
        displayName: result.match.displayName,
        confidence: result.match.confidence,
        metadata: result.match.metadata,
        message: `Found contact: ${result.match.displayName} (${result.match.email})`
      };
    } else if (result.success && result.matches) {
      // Multiple matches found
      return {
        success: true,
        matches: result.matches.map(match => ({
          email: match.email,
          displayName: match.displayName,
          confidence: match.confidence,
          lastContact: match.metadata.lastContact,
          emailCount: match.metadata.emailCount
        })),
        message: result.message || `Found ${result.matches.length} potential matches`
      };
    } else {
      // No match found
      return {
        success: false,
        error: result.error || 'Contact not found',
        suggestion: result.suggestion
      };
    }

  } catch (error) {
    console.error('❌ Contact search tool error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}