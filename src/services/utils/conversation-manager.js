// src/services/utils/conversation-manager.js
/**
 * Conversation Manager
 * Handles message building and history management
 */

export class ConversationManager {
  /**
   * Build messages array with system message and history
   */
  static buildMessages(systemMessage, userMessage, conversationHistory = []) {
    if (conversationHistory.length > 0) {
      console.log(`📚 Using ${conversationHistory.length} messages from history`);
      return [systemMessage, ...conversationHistory];
    }

    console.log('✨ Starting new conversation');
    return [systemMessage, { role: 'user', content: userMessage }];
  }

  /**
   * Add assistant message with tool call to history
   */
  static addAssistantMessage(messages, assistantMessage) {
    messages.push(assistantMessage);
    return messages;
  }

  /**
   * Add tool result to history
   */
  static addToolResult(messages, toolCallId, toolResult) {
    messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: JSON.stringify(toolResult.content)
    });
    return messages;
  }

  /**
   * Log conversation statistics
   */
  static logStats(conversationHistory, toolsCalled) {
    console.log(`💬 Conversation history: ${conversationHistory.length} messages`);
    console.log(`🔧 Tools called: ${toolsCalled.length}`);
    if (toolsCalled.length > 0) {
      console.log(`   Tools used: ${toolsCalled.join(', ')}`);
    }
  }
}