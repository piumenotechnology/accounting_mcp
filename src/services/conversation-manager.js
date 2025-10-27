class ConversationManager {
  constructor() {
    // In-memory storage (replace with database for production)
    this.conversations = new Map();
  }
  
  /**
   * Get conversation history for a user
   */
  getHistory(userId, conversationId = 'default') {
    const key = `${userId}:${conversationId}`;
    return this.conversations.get(key) || [];
  }
  
  /**
   * Add message to conversation history
   */
  addMessage(userId, message, conversationId = 'default') {
    const key = `${userId}:${conversationId}`;
    const history = this.getHistory(userId, conversationId);
    history.push(message);
    
    // Keep last 20 messages to avoid token limits
    if (history.length > 20) {
      history.shift();
    }
    
    this.conversations.set(key, history);
  }
  
  /**
   * Clear conversation history
   */
  clearHistory(userId, conversationId = 'default') {
    const key = `${userId}:${conversationId}`;
    this.conversations.delete(key);
  }
  
  /**
   * Get all conversation IDs for a user
   */
  getConversationIds(userId) {
    const ids = [];
    for (const key of this.conversations.keys()) {
      if (key.startsWith(`${userId}:`)) {
        ids.push(key.split(':')[1]);
      }
    }
    return ids;
  }
}

export default new ConversationManager();