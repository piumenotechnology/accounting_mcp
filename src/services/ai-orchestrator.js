// src/services/ai-orchestrator.js - REFACTORED VERSION
import { openRouterClient, models, isConfigured } from '../config/ai-clients.js';
import { ModelSelector } from '../utils/model-selector.js';
import MCPClient from './mcp-client.js';
import { getTimezoneFromCoordinates, getCurrentTimeInTimezone } from './timezone-service.js';

// Modular imports
import { SystemPromptBuilder } from './prompts/system-prompt-builder.js';
import { ToolConfig } from './config/tool-config.js';
import { ConversationManager } from './utils/conversation-manager.js';
import { ToolExecutor } from './utils/tool-executor.js';

class AIOrchestrator {
  constructor() {
    this.mcpClient = new MCPClient();
    this.modelSelector = new ModelSelector();
    this.client = openRouterClient;
    this.promptBuilder = new SystemPromptBuilder();
    this.toolExecutor = new ToolExecutor(this.mcpClient);
  }
  
  /**
   * Main entry point for processing messages
   */
  async processMessage(
    message, 
    user_id, 
    requestedModel = null, 
    conversationHistory = [], 
    user_location = null, 
    user_name
  ) {
    // Validate inputs
    this._validateInputs(user_id);
    
    // Select model
    const selectedModel = this._selectModel(message, requestedModel);
    const modelConfig = this._getModelConfig(selectedModel);
    
    // Log processing info
    this._logProcessingInfo(modelConfig, user_id, conversationHistory, user_location);
    
    // Initialize MCP tools
    await this.mcpClient.connect();
    const mcpTools = await this.mcpClient.listTools();
    const tools = this._convertMCPToolsToOpenAI(mcpTools);
    
    // Process with OpenRouter
    return await this.processWithOpenRouter(
      message, 
      user_id, 
      modelConfig.id, 
      tools, 
      conversationHistory,
      user_location,
      user_name
    );
  }
  
  /**
   * Process message with OpenRouter API
   */
  async processWithOpenRouter(
    message, 
    user_id, 
    modelId, 
    tools, 
    conversationHistory = [], 
    user_location = null, 
    user_name
  ) {
    // Build context
    const context = this._buildContext(user_location, user_name);
    
    // Build system message using modular prompt builder
    const systemMessage = this.promptBuilder.build(context);
    
    // Build messages array
    let messages = ConversationManager.buildMessages(
      systemMessage,
      message,
      conversationHistory
    );
    
    // Execute tool loop
    const result = await this._executeToolLoop(
      messages,
      modelId,
      tools,
      user_id,
      user_location
    );
    
    return result;
  }

  /**
   * Main tool execution loop
   */
  async _executeToolLoop(messages, modelId, tools, user_id, user_location) {
    let toolsCalled = [];
    let toolResults = [];
    const maxIterations = 10;
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`🔄 Iteration ${iteration + 1}`);
      
      // Call OpenRouter API
      const response = await this.client.chat.completions.create({
        model: modelId,
        messages: messages,
        tools: tools,
        tool_choice: 'auto'
      });
      
      const choice = response.choices[0];
      console.log(`🤖 Finish reason: ${choice.finish_reason}`);
      
      // Check if we're done
      if (this._isComplete(choice)) {
        return this._buildFinalResponse(
          choice,
          response,
          toolsCalled,
          toolResults,
          modelId
        );
      }
      
      // Handle tool calls
      if (this._hasToolCalls(choice)) {
        const continueLoop = await this._handleToolCall(
          choice,
          messages,
          toolsCalled,
          toolResults,
          user_id,
          user_location
        );
        
        if (continueLoop) {
          continue;
        }
      }
      
      break;
    }
    
    return this._buildMaxIterationsResponse(toolsCalled, toolResults, modelId);
  }

  /**
   * Handle a single tool call
   */
  async _handleToolCall(
    choice, 
    messages, 
    toolsCalled, 
    toolResults, 
    user_id, 
    user_location
  ) {
    const toolCall = choice.message.tool_calls[0];
    const toolName = toolCall.function.name;
    
    toolsCalled.push(toolName);
    
    // Parse and inject parameters
    let functionArgs = ToolExecutor.parseArguments(
      toolCall.function.arguments,
      toolName
    );
    
    functionArgs = ToolConfig.injectParameters(
      toolName,
      functionArgs,
      { user_id, user_location }
    );
    
    // Execute tool
    const toolResult = await this.toolExecutor.execute({
      function: {
        name: toolName,
        arguments: JSON.stringify(functionArgs)
      }
    });
    
    // Store results
    ToolExecutor.storeResult(toolResults, toolName, toolResult);
    
    // Update conversation
    ConversationManager.addAssistantMessage(messages, choice.message);
    ConversationManager.addToolResult(messages, toolCall.id, toolResult);
    
    return true; // Continue loop
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Validate required inputs
   */
  _validateInputs(user_id) {
    if (!isConfigured) {
      throw new Error('OpenRouter API key not configured');
    }
    
    if (!user_id) {
      throw new Error('user_id is required');
    }
  }

  /**
   * Select appropriate model
   */
  _selectModel(message, requestedModel) {
    if (requestedModel) {
      console.log(`🎯 Using user-requested model: ${requestedModel}`);
      return requestedModel;
    }
    
    const selectedModel = this.modelSelector.selectModel(message);
    const reasoning = this.modelSelector.getModelReasoning(message);
    
    console.log(`🤖 Auto-selected: ${selectedModel}`);
    console.log(`   Reason: ${reasoning.reason}`);
    
    if (reasoning.keywords.length > 0) {
      console.log(`   Keywords detected: ${reasoning.keywords.join(', ')}`);
    }
    
    return selectedModel;
  }

  /**
   * Get model configuration
   */
  _getModelConfig(modelName) {
    const config = models[modelName];
    if (!config) {
      throw new Error(`Unknown model: ${modelName}`);
    }
    return config;
  }

  /**
   * Log processing information
   */
  _logProcessingInfo(modelConfig, user_id, conversationHistory, user_location) {
    console.log(`📡 Using model: ${modelConfig.name} (${modelConfig.id})`);
    console.log(`   User: ${user_id}`);
    console.log(`💬 Conversation history: ${conversationHistory.length} messages`);
    
    if (user_location) {
      console.log(`📍 Location: ${user_location.lat}, ${user_location.lng}`);
    }
  }

  /**
   * Convert MCP tools to OpenAI format
   */
  _convertMCPToolsToOpenAI(mcpTools) {
    console.log('🔧 Available tools:', mcpTools.tools.map(t => t.name));
    
    return mcpTools.tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
  }

  /**
   * Build context for prompt builder
   */
  _buildContext(user_location, user_name) {
    // Detect timezone
    let timezone = 'Asia/Makassar';
    let locationInfo = '';
    
    if (user_location && user_location.lat && user_location.lng) {
      timezone = getTimezoneFromCoordinates(user_location.lat, user_location.lng);
      locationInfo = `\nUser coordinates: ${user_location.lat}, ${user_location.lng}`;
    }

    // Get current time
    const timeInfo = getCurrentTimeInTimezone(timezone);
    
    return {
      user_location,
      timezone,
      timeInfo,
      user_name,
      locationInfo
    };
  }

  /**
   * Check if response is complete
   */
  _isComplete(choice) {
    return choice.finish_reason === 'stop' || !choice.message.tool_calls;
  }

  /**
   * Check if choice has tool calls
   */
  _hasToolCalls(choice) {
    return choice.finish_reason === 'tool_calls' && choice.message.tool_calls;
  }

  /**
   * Build final successful response
   */
  _buildFinalResponse(choice, response, toolsCalled, toolResults, modelId) {
    return {
      message: choice.message.content,
      toolsCalled: toolsCalled,
      toolResults: toolResults,
      model: modelId,
      usage: response.usage
    };
  }

  /**
   * Build max iterations response
   */
  _buildMaxIterationsResponse(toolsCalled, toolResults, modelId) {
    return {
      message: 'Max iterations reached',
      toolsCalled: toolsCalled,
      toolResults: toolResults,
      model: modelId
    };
  }
}

export default AIOrchestrator;