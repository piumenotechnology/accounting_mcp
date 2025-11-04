// src/utils/model-selector.js - WITH SEARCH DETECTION (GROK FOR SEARCH)
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

    // Search keywords (for web search queries)
    this.searchKeywords = [
      'search', 'look up', 'find information', 'search for',
      'google', 'what is', 'who is', 'when did', 'where is',
      'latest', 'recent', 'current', 'news', 'trending',
      'images of', 'pictures of', 'photos of',
      'how to', 'tutorial', 'learn about', 'explain', 'tell me about'
    ];
    
    // Default models
    this.defaultModel = 'claude';   // Claude for general queries
    this.googleModel = 'gemini';    // Gemini for Google services
    this.searchModel = 'grock';     // Grok for search queries 🔍
  }
  
  selectModel(message) {
    const messageLower = message.toLowerCase();
    
    // 🔍 PRIORITY 1: Check for search queries FIRST
    // (Before checking Google keywords, since some overlap like "search")
    const isSearchQuery = this.searchKeywords.some(keyword =>
      messageLower.includes(keyword)
    );
    
    if (isSearchQuery) {
      console.log(`🔍 Search query detected → Using ${this.searchModel}`);
      return this.searchModel;
    }
    
    // Check if message contains any Google service keywords
    const isGoogleRelated = this.googleKeywords.some(keyword => 
      messageLower.includes(keyword)
    );
    
    if (isGoogleRelated) {
      console.log(`🎯 Google-related query detected → Using ${this.googleModel}`);
      return this.googleModel;
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
    
    // 🔍 PRIORITY 1: Check search queries first
    if (this.isSearchQuery(message)) {
      return {
        model: this.searchModel,
        reason: 'Search query detected (web search, information lookup)',
        keywords: this.searchKeywords.filter(k => messageLower.includes(k))
      };
    }
    
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
    
    return {
      model: this.defaultModel,
      reason: 'General query (coding, analysis, conversation)',
      keywords: []
    };
  }
}

// Example usage:
// const selector = new ModelSelector();
// const model = selector.selectModel("Search for latest AI news"); // → grock 🔍
// const model = selector.selectModel("Send email to John"); // → gemini
// const model = selector.selectModel("Explain quantum physics"); // → claude
// const model = selector.selectModel("Find gyms near me"); // → gemini (Maps)