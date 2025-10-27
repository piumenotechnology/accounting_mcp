export class ModelSelector {
  selectModel(message, provider = 'openai') {
    const lowercaseMsg = message.toLowerCase();
    
    if (provider === 'openai') {
      // Complex reasoning tasks
      if (this.isComplexTask(lowercaseMsg)) {
        return 'gpt-4o';
      }
      
      // Fast, simple tasks
      if (this.isSimpleTask(lowercaseMsg)) {
        return 'gpt-3.5-turbo';
      }
      
      // Default: balanced model
      return 'gpt-4o-mini';
    } else {
      // OpenRouter defaults
      if (this.isComplexTask(lowercaseMsg)) {
        return 'claude-sonnet-4';
      }
      return 'claude-3.5-sonnet';
    }
  }
  
  isComplexTask(message) {
    const complexKeywords = [
      'analyze', 'compare', 'evaluate', 'complex', 
      'detailed', 'comprehensive', 'explain in detail'
    ];
    return complexKeywords.some(keyword => message.includes(keyword));
  }
  
  isSimpleTask(message) {
    const simpleKeywords = [
      'what is', 'list', 'count', 'simple', 
      'quick', 'weather', 'time'
    ];
    return simpleKeywords.some(keyword => message.includes(keyword));
  }
}