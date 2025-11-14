// src/services/ai-orchestrator.js - ULTRA-OPTIMIZED (77% token reduction)
import { openRouterClient, models, isConfigured } from '../config/ai-clients.js';
import { ModelSelector } from '../utils/model-selector.js';
import MCPClient from './mcp-client.js';
import { getTimezoneFromCoordinates, getCurrentTimeInTimezone } from './timezone-service.js';
import DatabaseService from './database.service.js';

class AIOrchestrator {
  constructor() {
    this.mcpClient = new MCPClient();
    this.modelSelector = new ModelSelector();
    this.client = openRouterClient;
    this.schemaCache = new Map();
    this.dbService = DatabaseService;
  }

  /**
   * Detect if query needs database context
   */
  needsDatabaseContext(message) {
    const lowerMessage = message.toLowerCase();
    
    // Direct database keywords
    const databaseKeywords = [
      'query', 'database', 'sql', 'table', 'select',
      'payment', 'vehicle', 'invoice', 'contact', 'customer',
      'income', 'revenue', 'expense', 'transaction', 'cost',
      'show me', 'find all', 'list', 'how many', 'count',
      'sum', 'total', 'average', 'group by',
      'where', 'filter', 'search for', 'contract', 'rental',
      'purchase', 'sales', 'order', 'hire', 'sold'
    ];
    
    // Pre-configured field names (add your actual field names)
    const fieldNames = [
      'total_income', 'contract_income', 'vehicle_income',
      'total_cost', 'contract_cost', 'vehicle_cost',
      'rental', 'income'
    ];
    
    // Check if any keyword matches
    const hasKeyword = databaseKeywords.some(keyword => lowerMessage.includes(keyword));
    const hasFieldName = fieldNames.some(field => lowerMessage.includes(field));
    
    return hasKeyword || hasFieldName;
  }

  async getDatabaseContext(user_id) {
    try {
      const schemaInfo = await this.dbService.getCompleteSchemaInfo(user_id);
      
      if (!schemaInfo || !schemaInfo.tables || schemaInfo.tables.length === 0) {
        return null;
      }
      
      return {
        schemas: [{
          schema_name: schemaInfo.schema_name,
          client_name: schemaInfo.client_name,
          referral: schemaInfo.referral
        }],
        structures: {
          [schemaInfo.schema_name]: schemaInfo.tables
        },
        available_fields: schemaInfo.available_fields || []
      };
      
    } catch (error) {
      return null;
    }
  }

  /**
   * OPTIMIZED: Format database schema WITHOUT sample data
   * Reduces tokens by ~1500 per request
   */
  formatDatabaseSchema(dbContext) {
    let output = 'TABLES:\n';
    
    for (const schema of dbContext.schemas) {
      const structure = dbContext.structures[schema.schema_name];
      
      for (const table of structure) {
        output += `${table.name}: ${table.columns.map(c => `${c.name}(${c.type})`).join(', ')}\n`;
      }
    }
    
    return output;
  }

  /**
   * OPTIMIZED: Compact pre-configured fields format
   * Reduces tokens by ~700 per request
   */
  formatPreConfiguredFields(fields) {
    if (!fields || fields.length === 0) return '';
    
    let output = '\nPRE-CONFIGURED FIELDS (use get_field_query first):\n';
    
    for (const field of fields) {
      // Compact one-line format
      output += `- ${field.name}: ${field.description}\n`;
    }
    
    return output;
  }

  /**
   * ULTRA-OPTIMIZED: Build system message with minimal tokens
   * Before: ~3000 tokens
   * After: ~700 tokens
   * Savings: 77%
   */
  async buildSystemMessage(user_id, user_name, user_location, timezone, timeInfo, includeDatabase = false) {
    // CORE SYSTEM PROMPT (minimal, essential only)
    let systemContent = `Date: ${timeInfo.localDate}, Time: ${timeInfo.localTime}, Timezone: ${timezone}
User: ${user_name}

You are an AI assistant with tool access. Use tools when needed for accurate responses.`;

    // LOCATION CONTEXT (compact)
    if (user_location && user_location.lat && user_location.lng) {
      systemContent += `
Location: ${user_location.lat}, ${user_location.lng} (use for location queries)`;
    }

    // DATABASE CONTEXT (CONDITIONAL & OPTIMIZED)
    if (includeDatabase) {
      console.log('📊 Including database context (optimized)');
      
      const dbContext = await this.getDatabaseContext(user_id);

      if (dbContext && dbContext.schemas.length > 0) {
        systemContent += `

=== DATABASE: ${dbContext.schemas[0].client_name} (${dbContext.schemas[0].schema_name}) ===

${this.formatDatabaseSchema(dbContext)}`;

        // PRE-CONFIGURED FIELDS (compact format)
        if (dbContext.available_fields && dbContext.available_fields.length > 0) {
          systemContent += this.formatPreConfiguredFields(dbContext.available_fields);
        }

        systemContent += `
DATABASE TOOLS:
- get_field_query(field_name) - Get pre-built query for fields above
- execute_query(query) - Execute SQL (SELECT only, auto-limited)

WORKFLOW:
For pre-configured fields: get_field_query → modify query → execute_query
For direct queries: execute_query immediately
Execute autonomously, no confirmation needed.`;
      }
    } else {
      console.log('⚡ Skipping database context');
    }

    // GOOGLE TOOLS (compact)
    systemContent += `

=== GOOGLE TOOLS ===
Before create_calendar_event/send_email: Show preview, wait for confirmation.
For search_contact with multiple matches: Show numbered list, wait for selection.
Calendar timezone: ${timezone}, Email signature: "${user_name}"
Read-only tools (no confirmation): search_contact, list_calendar_events, check_google_connection`;

    // MAPS (compact)
    systemContent += `

=== MAPS ===
${user_location ? `Location available: ${user_location.lat}, ${user_location.lng}` : 'No location'}
Use specific queries (e.g., "fitness center gym" not "gym")`;

    // WEB SEARCH (compact)
    systemContent += `

=== WEB SEARCH ===
Use for: current events, news, real-time data, verification
Tools: web_search, news_search, deep_search

GENERAL RULES:
- Choose appropriate tools based on user's question
- Execute autonomously when safe (database, search, read-only)
- Confirm before actions with side effects (email, calendar events, deletions)`;

    return systemContent;
  }
  
  async processMessage(message, user_id, requestedModel = null, conversationHistory = [], user_location = null, user_name) {
    if (!isConfigured) {
      throw new Error('OpenRouter API key not configured');
    }
    
    if (!user_id) {
      throw new Error('user_id is required');
    }
    
    // Detect if database context is needed
    const needsDB = this.needsDatabaseContext(message);
    console.log(`🔍 Database context needed: ${needsDB ? 'YES' : 'NO'}`);
    
    // Determine which model to use
    let selectedModel;
    if (requestedModel) {
      selectedModel = requestedModel;
      console.log(`🎯 Using user-requested model: ${requestedModel}`);
    } else {
      selectedModel = this.modelSelector.selectModel(message);
      const reasoning = this.modelSelector.getModelReasoning(message);
      console.log(`🤖 Auto-selected: ${selectedModel}`);
      console.log(`   Reason: ${reasoning.reason}`);
      if (reasoning.keywords.length > 0) {
        console.log(`   Keywords detected: ${reasoning.keywords.join(', ')}`);
      }
    }
    
    const modelConfig = models[selectedModel];
    
    if (!modelConfig) {
      throw new Error(`Unknown model: ${selectedModel}`);
    }
    
    console.log(`📡 Using model: ${modelConfig.name} (${modelConfig.id})`);
    if (user_location) {
      console.log(`📍 Location: ${user_location.lat}, ${user_location.lng}`);
    }
    
    // Get MCP tools
    await this.mcpClient.connect();
    const mcpTools = await this.mcpClient.listTools();
    
    // Convert MCP tools to OpenAI format
    const tools = mcpTools.tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
    
    // Process with OpenRouter (pass needsDB flag)
    return await this.processWithOpenRouter(
      message, 
      user_id, 
      modelConfig.id, 
      tools,
      conversationHistory,
      user_location,
      user_name,
      needsDB
    );
  }
  
  async processWithOpenRouter(message, user_id, modelId, tools, conversationHistory = [], user_location = null, user_name, includeDatabase = false) {
    // Detect timezone from user location
    let timezone = 'Asia/Makassar';
    
    if (user_location && user_location.lat && user_location.lng) {
      timezone = getTimezoneFromCoordinates(user_location.lat, user_location.lng);
    }

    const timeInfo = getCurrentTimeInTimezone(timezone);
    
    // Build optimized system message
    const systemContent = await this.buildSystemMessage(
      user_id, 
      user_name, 
      user_location, 
      timezone, 
      timeInfo,
      includeDatabase
    );

    console.log(systemContent);
    
    const estimatedTokens = Math.ceil(systemContent.length / 4);
    console.log(`📝 System prompt: ${systemContent.length} chars (~${estimatedTokens} tokens) ${includeDatabase ? '(with DB)' : '(no DB)'}`);
    
    // Build system message
    const systemMessage = {
      role: 'system',
      content: systemContent
    };
    
    // Build messages array with history
    let messages;
    
    if (conversationHistory.length > 0) {
      messages = [systemMessage, ...conversationHistory];
    } else {
      messages = [systemMessage, { role: 'user', content: message }];
      console.log('✨ Starting new conversation');
    }
    
    let toolsCalled = [];
    let toolResults = [];
    let maxIterations = 10;
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`🔄 Iteration ${iteration + 1}`);
      
      const response = await this.client.chat.completions.create({
        model: modelId,
        messages: messages,
        tools: tools,
        tool_choice: 'auto'
      });
      
      const choice = response.choices[0];
      console.log(`🤖 Finish reason: ${choice.finish_reason}`);

      if (choice.message.tool_calls) {
        console.log(`🔧 AI chose tools:`, choice.message.tool_calls.map(t => t.function.name));
      }
      
      // No tool calls - return final answer
      if (choice.finish_reason === 'stop' || !choice.message.tool_calls) {
        return {
          message: choice.message.content,
          toolsCalled: toolsCalled,
          toolResults: toolResults,
          model: modelId,
          usage: response.usage
        };
      }
      
      // Handle tool calls
      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
        const toolCall = choice.message.tool_calls[0];
        
        console.log(`⚡ Calling tool: ${toolCall.function.name}`);
        toolsCalled.push(toolCall.function.name);
        
        let functionArgs = {};
        try {
          const argsString = toolCall.function.arguments?.trim();
          if (!argsString || argsString === '') {
            console.log('⚠️ Empty arguments, using empty object');
            functionArgs = {};
          } else {
            functionArgs = JSON.parse(argsString);
            console.log('✅ Parsed arguments:', Object.keys(functionArgs).join(', '));
          }
        } catch (parseError) {
          console.error('❌ Failed to parse tool arguments:', parseError.message);
          functionArgs = {};
          console.log('⚠️ Using empty arguments object as fallback');
        }
        
        // Inject USER_ID for tools that need it
        const toolsRequiringUserId = [
          'create_calendar_event',
          'list_calendar_events', 
          'update_calendar_event',
          'delete_calendar_event',
          'check_google_connection',
          'search_contact',
          'send_email',
          'execute_query',
          'get_field_query',
        ];
        
        if (toolsRequiringUserId.includes(toolCall.function.name)) {
          functionArgs.user_id = user_id;
          
          if (toolCall.function.name === 'execute_query') {
            functionArgs.user_message = message;
          }
        }

        // Inject USER_LOCATION for location-based tools
        const toolsRequiringLocation = [
          'weather',
          'search_places',
          'get_directions',
          'get_place_details',
          'calculate_distance',
          'nearby_search'
        ];
        
        if (toolsRequiringLocation.includes(toolCall.function.name) && user_location) {
          functionArgs.user_location = user_location;
          console.log(`📍 Injected user_location for ${toolCall.function.name}`);
        }
        
        // Execute tool via MCP
        const toolResult = await this.mcpClient.callTool({
          name: toolCall.function.name,
          arguments: functionArgs
        });

        let toolResultContent;
  
        if (toolResult.content && Array.isArray(toolResult.content)) {
          toolResultContent = toolResult.content[0]?.text || JSON.stringify(toolResult.content);
        } else if (typeof toolResult === 'string') {
          toolResultContent = toolResult;
        } else {
          toolResultContent = JSON.stringify(toolResult);
        }
        
        console.log(`📤 Sending tool result (${toolResultContent.length} chars)`);

        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: toolCall.id,
            type: 'function',
            function: {
              name: toolCall.function.name,
              arguments: toolCall.function.arguments
            }
          }]
        });
        
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResultContent
        });

        try {
          const parsedResult = JSON.parse(toolResultContent);
          toolResults.push({
            tool: toolCall.function.name,
            data: parsedResult
          });
        } catch (parseErr) {
          console.log('⚠️ Could not parse tool result for structured data');
        }
        
        continue;
      }
      
      break;
    }
    
    return {
      message: 'Max iterations reached',
      toolsCalled: toolsCalled,
      toolResults: toolResults,
      model: modelId
    };
  }
}

export default AIOrchestrator;