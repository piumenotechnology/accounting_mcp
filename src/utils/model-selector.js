// src/utils/model-selector.js - WITH SEARCH DETECTION
export class ModelSelector {
  constructor() {
    // Keywords that indicate Google service usage
    this.googleKeywords = [
      // Gmail
      'email', 'gmail', 'mail', 'send', 'inbox', 'message',
      
      // Calendar
      'calendar', 'meeting', 'schedule', 'appointment', 'event',
      'tomorrow', 'next week', 'book', 'reschedule',
      
      // Maps
      'direction', 'distance', 'map', 'location', 'place', 
      'restaurant', 'hotel', 'gym', 'coffee', 'near me',
      'how far', 'how long', 'route', 'navigate', 'address',
      'find', 'search for', 'where is', 'show me',
      
      // Contacts
      'contact', 'phone number', 'address book',
      
      // Drive (future)
      'drive', 'document', 'sheet', 'file'
    ];

    // 🆕 Search keywords (for general web search)
    this.searchKeywords = [
      'search', 'look up', 'find information',
      'google', 'what is', 'who is', 'when did',
      'latest', 'recent', 'current', 'news',
      'images of', 'pictures of', 'photos of', 'videos of',
      'how to', 'tutorial', 'learn about', 'explain'
    ];
    
    // Default models
    this.defaultModel = 'claude';  // Claude for general queries
    this.googleModel = 'gemini';   // Gemini for Google services
  }
  
  selectModel(message) {
    const messageLower = message.toLowerCase();
    
    // Check if message contains any Google-related keywords
    const isGoogleRelated = this.googleKeywords.some(keyword => 
      messageLower.includes(keyword)
    );

    // 🆕 Check if message contains search-related keywords
    // Note: Search tools work with any model, but we prioritize Google for Google services
    const isSearchQuery = this.searchKeywords.some(keyword =>
      messageLower.includes(keyword)
    );
    
    if (isGoogleRelated) {
      console.log(`🎯 Google-related query detected → Using ${this.googleModel}`);
      return this.googleModel;
    }

    // 🆕 For pure search queries (no Google services), use default model
    if (isSearchQuery) {
      console.log(`🎯 Search query detected → Using ${this.defaultModel}`);
      return this.defaultModel;
    }
    
    console.log(`🎯 General query → Using ${this.defaultModel}`);
    return this.defaultModel;
  }
  
  isMapsQuery(message) {
    const mapsKeywords = [
      'direction', 'distance', 'map', 'location', 'place',
      'restaurant', 'hotel', 'gym', 'coffee', 'near me',
      'how far', 'how long', 'route', 'navigate', 'find'
    ];
    
    const messageLower = message.toLowerCase();
    return mapsKeywords.some(keyword => messageLower.includes(keyword));
  }
  
  isGmailQuery(message) {
    const gmailKeywords = ['email', 'gmail', 'mail', 'send', 'inbox'];
    const messageLower = message.toLowerCase();
    return gmailKeywords.some(keyword => messageLower.includes(keyword));
  }
  
  isCalendarQuery(message) {
    const calendarKeywords = [
      'calendar', 'meeting', 'schedule', 'appointment', 
      'event', 'book', 'tomorrow'
    ];
    const messageLower = message.toLowerCase();
    return calendarKeywords.some(keyword => messageLower.includes(keyword));
  }

  // 🆕 Search query detection
  isSearchQuery(message) {
    const messageLower = message.toLowerCase();
    return this.searchKeywords.some(keyword => messageLower.includes(keyword));
  }
  
  getModelReasoning(message) {
    const messageLower = message.toLowerCase();
    
    if (this.isMapsQuery(message)) {
      return {
        model: this.googleModel,
        reason: 'Maps-related query (directions, places, location)',
        keywords: this.googleKeywords.filter(k => messageLower.includes(k))
      };
    }
    
    if (this.isGmailQuery(message)) {
      return {
        model: this.googleModel,
        reason: 'Gmail-related query (email, send, inbox)',
        keywords: this.googleKeywords.filter(k => messageLower.includes(k))
      };
    }
    
    if (this.isCalendarQuery(message)) {
      return {
        model: this.googleModel,
        reason: 'Calendar-related query (meeting, schedule, event)',
        keywords: this.googleKeywords.filter(k => messageLower.includes(k))
      };
    }

    // 🆕 Search queries
    if (this.isSearchQuery(message)) {
      return {
        model: this.defaultModel,
        reason: 'Search query (look up, find information, current events)',
        keywords: this.searchKeywords.filter(k => messageLower.includes(k))
      };
    }
    
    return {
      model: this.defaultModel,
      reason: 'General query (coding, analysis, conversation)',
      keywords: []
    };
  }
}

// Example usage:
// const selector = new ModelSelector();
// const model = selector.selectModel("Send email to John"); // → gemini
// const model = selector.selectModel("Search for latest AI news"); // → claude (with search tools)
// const model = selector.selectModel("Explain quantum physics"); // → claude
// const model = selector.selectModel("Find gyms near me"); // → gemini (Maps)