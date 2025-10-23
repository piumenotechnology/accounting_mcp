/**
 * Determines which AI model to use based on the message content
 */
export class ModelSelector {
  
  selectModel(message) {
    const lowerMessage = message.toLowerCase();
    
    // // Use Claude for complex reasoning, analysis, coding
    // if (this.containsKeywords(lowerMessage, [
    //   'analyze', 'complex', 'reasoning', 'explain', 'code', 
    //   'programming', 'debug', 'algorithm', 'logic'
    // ])) {
    //   return 'claude';
    // }
    
    // // Use GPT-4 for creative writing, general conversation
    // if (this.containsKeywords(lowerMessage, [
    //   'write', 'creative', 'story', 'poem', 'essay', 
    //   'article', 'blog', 'imagine'
    // ])) {
    //   return 'openai';
    // }
    
    // // Use Gemini for quick tasks, simple queries (cheaper)
    // if (this.containsKeywords(lowerMessage, [
    //   'count', 'calculate', 'simple', 'quick', 'what is',
    //   'how many', 'list', 'summarize'
    // ])) {
    //   return 'gemini';
    // }
    
    // Default to Gemini (cheapest)
    return 'openai';
  }
  
  containsKeywords(text, keywords) {
    return keywords.some(keyword => text.includes(keyword));
  }
  
  getModelInfo(modelName) {
    const models = {
      claude: {
        name: 'Claude Sonnet 4.5',
        strengths: 'Complex reasoning, analysis, coding',
        cost: '$$$'
      },
      openai: {
        name: 'GPT-4o-mini',
        strengths: 'Creative writing, general conversation',
        cost: '$$'
      },
      gemini: {
        name: 'Gemini Pro',
        strengths: 'Quick tasks, cost-effective',
        cost: '$'
      }
    };
    
    return models[modelName];
  }
}