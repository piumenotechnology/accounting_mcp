import { 
  openaiClient, 
  openRouterClient, 
  isOpenAIConfigured, 
  isOpenRouterConfigured,
  openaiModels,
  openRouterModels 
} from '../config/ai-clients.js';
import { ModelSelector } from '../utils/model-selector.js';
import MCPClient from './mcp-client.js';
import ConversationManager from './conversation-manager.js';

class AIOrchestrator {
  constructor() {
    this.mcpClient = new MCPClient();
    this.modelSelector = new ModelSelector();
    this.conversationManager = new ConversationManager();
  }
  
  async processMessage(message, user_id, requestedModel = null, provider = 'openai', conversation_id = 'default') {
    if (!user_id) {
      throw new Error('user_id is required');
    }
    
    if (!conversation_id) {
      throw new Error('conversation_id is required');
    }
    
    // Determine provider and validate configuration
    if (provider === 'openai' && !isOpenAIConfigured) {
      if (isOpenRouterConfigured) {
        console.log('⚠️ OpenAI not configured, falling back to OpenRouter');
        provider = 'openrouter';
      } else {
        throw new Error('No AI provider configured. Set OPENAI_API_KEY or OPENROUTER_API_KEY');
      }
    }
    
    if (provider === 'openrouter' && !isOpenRouterConfigured) {
      if (isOpenAIConfigured) {
        console.log('⚠️ OpenRouter not configured, falling back to OpenAI');
        provider = 'openai';
      } else {
        throw new Error('No AI provider configured. Set OPENAI_API_KEY or OPENROUTER_API_KEY');
      }
    }
    
    // Select client and models based on provider
    const client = provider === 'openai' ? openaiClient : openRouterClient;
    const models = provider === 'openai' ? openaiModels : openRouterModels;
    
    // Determine which model to use
    const selectedModel = requestedModel || this.getDefaultModel(provider);
    const modelConfig = models[selectedModel];
    
    if (!modelConfig) {
      throw new Error(`Unknown model: ${selectedModel} for provider: ${provider}`);
    }
    
    console.log(`🎯 Provider: ${provider.toUpperCase()}`);
    console.log(`🎯 Model: ${modelConfig.name} (${modelConfig.id})`);
    console.log(`   User: ${user_id}`);
    console.log(`   Conversation: ${conversation_id}`);
    
    // Get or create conversation
    await this.conversationManager.getOrCreateConversation(conversation_id, user_id);
    
    // Get conversation history
    const history = await this.conversationManager.getConversationHistory(conversation_id);
    console.log(`📚 Loaded ${history.length} messages from history`);
    
    // Check for pending confirmation
    const pendingConfirmation = await this.conversationManager.getPendingConfirmation(conversation_id, user_id);
    
    // Detect if user is responding to confirmation
    const isConfirmationResponse = this.detectConfirmationResponse(message);
    
    if (pendingConfirmation && isConfirmationResponse) {
      console.log(`🔔 Detected confirmation response for: ${pendingConfirmation.confirmationType}`);
      
      // User is responding to a confirmation
      const confirmed = this.isPositiveResponse(message);
      
      // Add user message to history
      await this.conversationManager.addMessage(conversation_id, 'user', message);
      
      // Get MCP tools
      await this.mcpClient.connect();
      const mcpTools = await this.mcpClient.listTools();
      const tools = mcpTools.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }
      }));
      
      // Process confirmation with full history
      const result = await this.processWithConfirmation(
        history,
        message,
        user_id,
        client,
        modelConfig.id,
        tools,
        provider,
        conversation_id,
        pendingConfirmation,
        confirmed
      );
      
      // Clear pending confirmation after processing
      await this.conversationManager.clearPendingConfirmation(conversation_id, user_id);
      
      return result;
    }
    
    // Add user message to history
    await this.conversationManager.addMessage(conversation_id, 'user', message);
    
    // Get MCP tools
    await this.mcpClient.connect();
    const mcpTools = await this.mcpClient.listTools();
    
    console.log('🔧 Available tools:', mcpTools.tools.map(t => t.name));
    
    // Convert MCP tools to OpenAI format
    const tools = mcpTools.tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
    
    // Process with conversation history
    return await this.processWithProvider(
      history,
      message,
      user_id,
      client,
      modelConfig.id,
      tools,
      provider,
      conversation_id
    );
  }
  
  getDefaultModel(provider) {
    if (provider === 'openai') {
      return 'gpt-4o-mini';
    } else {
      return 'claude-3.5-sonnet';
    }
  }
  
  detectConfirmationResponse(message) {
    const lowerMessage = message.toLowerCase().trim();
    const confirmationKeywords = [
      'yes', 'no', 'confirm', 'cancel', 'send', 'create', 'update', 'delete',
      'ok', 'sure', 'go ahead', 'do it', 'proceed', 'abort', 'stop', 'nevermind'
    ];
    
    // Check if message is short and contains confirmation keywords
    const words = lowerMessage.split(/\s+/);
    if (words.length <= 5) {
      return confirmationKeywords.some(keyword => lowerMessage.includes(keyword));
    }
    
    return false;
  }
  
  isPositiveResponse(message) {
    const lowerMessage = message.toLowerCase().trim();
    const positive = ['yes', 'confirm', 'send', 'create', 'update', 'delete', 'ok', 'sure', 'go ahead', 'do it', 'proceed'];
    const negative = ['no', 'cancel', 'stop', 'abort', 'nevermind', 'don\'t'];
    
    // Check for negative first (more specific)
    if (negative.some(word => lowerMessage.includes(word))) {
      return false;
    }
    
    // Then check for positive
    if (positive.some(word => lowerMessage.includes(word))) {
      return true;
    }
    
    // Default to false if unclear
    return false;
  }
  
  async processWithConfirmation(history, message, user_id, client, modelId, tools, provider, conversation_id, pendingConfirmation, confirmed) {
    console.log(`✅ Processing confirmation: ${confirmed ? 'CONFIRMED' : 'CANCELLED'}`);
    
    // Build messages array from history + new message
    let messages = [...history];
    
    // Call the appropriate confirm tool
    const confirmToolName = this.getConfirmToolName(pendingConfirmation.confirmationType);
    
    if (!confirmToolName) {
      throw new Error(`Unknown confirmation type: ${pendingConfirmation.confirmationType}`);
    }
    
    // Inject user_id for tools that require it
    const functionArgs = {
      confirmationId: pendingConfirmation.confirmationId,
      confirmed: confirmed,
      user_id: user_id
    };
    
    console.log(`⚡ Calling confirmation tool: ${confirmToolName}`);
    
    // Execute tool via MCP
    const toolResult = await this.mcpClient.callTool({
      name: confirmToolName,
      arguments: functionArgs
    });
    
    console.log(`✅ Confirmation result:`, toolResult.content[0].text.substring(0, 100) + '...');
    
    // Create a synthetic assistant message explaining what happened
    const resultText = JSON.parse(toolResult.content[0].text);
    const assistantMessage = resultText.message || (confirmed ? 'Action confirmed and completed.' : 'Action cancelled.');
    
    // Add assistant response to history
    await this.conversationManager.addMessage(conversation_id, 'assistant', assistantMessage);
    
    return {
      message: assistantMessage,
      toolsCalled: [confirmToolName],
      model: modelId,
      provider: provider,
      confirmed: confirmed,
      confirmationType: pendingConfirmation.confirmationType
    };
  }
  
  getConfirmToolName(confirmationType) {
    const mapping = {
      'email': 'confirm_send_email',
      'calendar_create': 'confirm_create_calendar_event',
      'calendar_update': 'confirm_update_calendar_event',
      'calendar_delete': 'confirm_delete_calendar_event'
    };
    
    return mapping[confirmationType];
  }
  
  async processWithProvider(history, message, user_id, client, modelId, tools, provider, conversation_id) {
    // Build messages array from history
    let messages = [...history];
    let toolsCalled = [];
    let maxIterations = 5;
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`🔄 Iteration ${iteration + 1}`);
      
      const response = await client.chat.completions.create({
        model: modelId,
        messages: messages,
        tools: tools,
        tool_choice: 'auto'
      });
      
      const choice = response.choices[0];
      console.log(`🤖 Finish reason: ${choice.finish_reason}`);
      
      // No tool calls - return final answer
      if (choice.finish_reason === 'stop' || !choice.message.tool_calls) {
        // Save assistant response to database
        await this.conversationManager.addMessage(
          conversation_id,
          'assistant',
          choice.message.content
        );
        
        return {
          message: choice.message.content,
          toolsCalled: toolsCalled,
          model: modelId,
          provider: provider,
          usage: response.usage
        };
      }
      
      // Handle tool calls
      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
        const toolCall = choice.message.tool_calls[0];
        
        console.log(`⚡ Calling tool: ${toolCall.function.name}`);
        toolsCalled.push(toolCall.function.name);
        
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        // Inject user_id for tools that require it
        const toolsRequiringUserId = [
          'prepare_calendar_event',
          'confirm_create_calendar_event',
          'list_calendar_events', 
          'prepare_update_calendar_event',
          'confirm_update_calendar_event',
          'prepare_delete_calendar_event',
          'confirm_delete_calendar_event',
          'check_google_connection',
          'prepare_email',
          'confirm_send_email',
          'search_emails'
        ];
        
        if (toolsRequiringUserId.includes(toolCall.function.name)) {
          functionArgs.user_id = user_id;
        }
        
        // Execute tool via MCP
        const toolResult = await this.mcpClient.callTool({
          name: toolCall.function.name,
          arguments: functionArgs
        });
        
        console.log(`✅ Tool result:`, toolResult.content[0].text.substring(0, 100) + '...');
        
        // Check if this is a prepare tool that needs confirmation
        if (toolCall.function.name.startsWith('prepare_')) {
          const resultData = JSON.parse(toolResult.content[0].text);
          
          if (resultData.requiresConfirmation && resultData.confirmationId) {
            // Store pending confirmation in database
            const confirmationType = this.getConfirmationType(toolCall.function.name);
            await this.conversationManager.storePendingConfirmation(
              conversation_id,
              user_id,
              confirmationType,
              resultData.confirmationId,
              resultData.preview || resultData
            );
            
            console.log(`💾 Stored pending confirmation: ${confirmationType}`);
          }
        }
        
        // Add assistant message with tool call
        messages.push(choice.message);
        
        // Save tool call to database
        await this.conversationManager.addMessage(
          conversation_id,
          'assistant',
          '',
          { tool_calls: choice.message.tool_calls }
        );
        
        // Add tool result
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult.content)
        });
        
        // Save tool result to database
        await this.conversationManager.addMessage(
          conversation_id,
          'tool',
          JSON.stringify(toolResult.content),
          { tool_call_id: toolCall.id }
        );
        
        continue;
      }
      
      break;
    }
    
    return {
      message: 'Max iterations reached',
      toolsCalled: toolsCalled,
      model: modelId,
      provider: provider
    };
  }
  
  getConfirmationType(prepareToolName) {
    const mapping = {
      'prepare_email': 'email',
      'prepare_calendar_event': 'calendar_create',
      'prepare_update_calendar_event': 'calendar_update',
      'prepare_delete_calendar_event': 'calendar_delete'
    };
    
    return mapping[prepareToolName] || 'unknown';
  }
}

export default AIOrchestrator;