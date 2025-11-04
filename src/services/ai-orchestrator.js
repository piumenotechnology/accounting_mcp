// src/services/ai-orchestrator.js - SIMPLIFIED: Let AI decide tools
import { openRouterClient, models, isConfigured } from '../config/ai-clients.js';
import { ModelSelector } from '../utils/model-selector.js';
import MCPClient from './mcp-client.js';
import { getTimezoneFromCoordinates, getCurrentTimeInTimezone } from './timezone-service.js';
import { pool } from '../config/db.js';

class AIOrchestrator {
  constructor() {
    this.mcpClient = new MCPClient();
    this.modelSelector = new ModelSelector();
    this.client = openRouterClient;
    this.schemaCache = new Map();
  }

  getSchemaFromCache(user_id, schema_name) {
    const key = `${user_id}:${schema_name}`;
    const cached = this.schemaCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      console.log(`📦 Using cached schema: ${schema_name}`);
      return cached.data;
    }
    
    return null;
  }

  cacheSchema(user_id, schema_name, data) {
    const key = `${user_id}:${schema_name}`;
    this.schemaCache.set(key, {
      data,
      timestamp: Date.now()
    });
    console.log(`💾 Cached schema: ${schema_name}`);
  }

  async fetchSchemaStructure(user_id, schema_name) {
    const accessCheck = await pool.query(
      'SELECT user_has_schema_access($1, $2) as has_access',
      [user_id, schema_name]
    );
    
    if (!accessCheck.rows[0].has_access) {
      return null;
    }
    
    const structure = await pool.query(`
      SELECT 
        t.table_name,
        json_agg(
          json_build_object(
            'name', c.column_name,
            'type', c.data_type,
            'nullable', c.is_nullable = 'YES'
          ) ORDER BY c.ordinal_position
        ) as columns
      FROM information_schema.tables t
      JOIN information_schema.columns c 
        ON t.table_name = c.table_name 
        AND t.table_schema = c.table_schema
      WHERE t.table_schema = $1
        AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name
      ORDER BY t.table_name
    `, [schema_name]);
    
    return structure.rows;
  }

  async getDatabaseContext(user_id) {
    try {
      const schemasResult = await pool.query(
        'SELECT * FROM get_user_schemas($1)',
        [user_id]
      );
      
      const schemas = schemasResult.rows;
      
      if (schemas.length === 0) {
        return null;
      }
      
      const structures = {};
      
      for (const schema of schemas) {
        const cachedStructure = this.getSchemaFromCache(user_id, schema.schema_name);
        
        if (cachedStructure) {
          structures[schema.schema_name] = cachedStructure;
        } else {
          const structure = await this.fetchSchemaStructure(user_id, schema.schema_name);
          if (structure) {
            structures[schema.schema_name] = structure;
            this.cacheSchema(user_id, schema.schema_name, structure);
          }
        }
      }
      
      return {
        schemas,
        structures
      };
      
    } catch (error) {
      console.error('❌ Failed to get database context:', error);
      return null;
    }
  }

  /**
   * Build a minimal, context-aware system message
   * Only includes what's relevant based on actual data availability
   */
  async buildSystemMessage(user_id, user_name, user_location, timezone, timeInfo) {
    let systemContent = `Current date and time:
- Date: ${timeInfo.localDate}
- Time: ${timeInfo.localTime}
- Timezone: ${timezone}

User: ${user_name}

You are a helpful AI assistant with access to various tools.
Use tools when needed to provide accurate, helpful responses.`;

    // Only add location context if user has location
    if (user_location && user_location.lat && user_location.lng) {
      systemContent += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER LOCATION AVAILABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Location: ${user_location.lat}, ${user_location.lng}

For location-based queries, use these coordinates automatically.
Don't ask "where are you?" - the location is provided above.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }

    // Only add database context if user has database access
    const dbContext = await this.getDatabaseContext(user_id);
    if (dbContext && dbContext.schemas.length > 0) {
      systemContent += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATABASE ACCESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You have access to the following databases:

`;
      
      for (const schema of dbContext.schemas) {
        const structure = dbContext.structures[schema.schema_name];
        systemContent += `\n**${schema.schema_name}** (${schema.client_name})\n`;
        
        if (structure) {
          for (const table of structure) {
            systemContent += `  • ${table.table_name}\n`;
            let columnsArray = table.columns;
            if (typeof columnsArray === 'string') {
              try {
                columnsArray = JSON.parse(columnsArray);
              } catch (e) {
                columnsArray = [];
              }
            }
            const cols = columnsArray.map(c => c.name).join(', ');
            systemContent += `    Columns: ${cols}\n`;
          }
        }
      }
      
      systemContent += `
For payment queries: Use payment_xero table with SUM(total)
For itemized details: Use bank_transaction table
Always use parameterized queries with ILIKE for name matching.`;
    }

    // Add essential tool usage guidelines
    systemContent += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOOL USAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EMAILS & CALENDAR:
- Before sending emails or creating events: Show preview, wait for confirmation
- For multiple contacts: Show numbered list, wait for selection
- Sign emails with: "Best regards, ${user_name}"

MAPS & LOCATION:
- Use specific queries: "fitness center gym" not just "gym"
- Location is automatically provided for location tools

SEARCH:
- Use web_search for internet queries
- Use news_search for recent news
- Use video_search for tutorials

READ-ONLY tools (no confirmation needed):
- search_contact, list_calendar_events, weather, get_directions, web_search

Choose the right tools based on the user's question.`;

    return systemContent;
  }
  
  async processMessage(message, user_id, requestedModel = null, conversationHistory = [], user_location = null, user_name) {
    if (!isConfigured) {
      throw new Error('OpenRouter API key not configured');
    }
    
    if (!user_id) {
      throw new Error('user_id is required');
    }
    
    // Step 1: Determine which model to use
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
    console.log(`   User: ${user_id}`);
    console.log(`💬 Conversation history: ${conversationHistory.length} messages`);
    if (user_location) {
      console.log(`📍 Location: ${user_location.lat}, ${user_location.lng}`);
    }
    
    // Step 2: Get MCP tools - ALL OF THEM
    await this.mcpClient.connect();
    const mcpTools = await this.mcpClient.listTools();
    
    console.log('🔧 Available tools:', mcpTools.tools.map(t => t.name));
    
    // Step 3: Convert MCP tools to OpenAI format - PASS ALL TOOLS
    const tools = mcpTools.tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
    
    // Step 4: Process with OpenRouter
    return await this.processWithOpenRouter(
      message, 
      user_id, 
      modelConfig.id, 
      tools, // Pass ALL tools - let AI decide!
      conversationHistory,
      user_location,
      user_name
    );
  }
  
  async processWithOpenRouter(message, user_id, modelId, tools, conversationHistory = [], user_location = null, user_name) {
    // Detect timezone from user location
    let timezone = 'Asia/Makassar';
    
    if (user_location && user_location.lat && user_location.lng) {
      timezone = getTimezoneFromCoordinates(user_location.lat, user_location.lng);
    }

    const timeInfo = getCurrentTimeInTimezone(timezone);
    
    // Build minimal, context-aware system message
    const systemContent = await this.buildSystemMessage(
      user_id, 
      user_name, 
      user_location, 
      timezone, 
      timeInfo
    );
    
    const estimatedTokens = Math.ceil(systemContent.length / 4);
    console.log(`📝 System prompt: ${systemContent.length} chars (~${estimatedTokens} tokens)`);
    
    // Build system message
    const systemMessage = {
      role: 'system',
      content: systemContent
    };
    
    // Build messages array with history
    let messages;
    
    if (conversationHistory.length > 0) {
      messages = [systemMessage, ...conversationHistory];
      console.log(`📚 Using ${conversationHistory.length} messages from history`);
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
        tools: tools, // ALL tools available - AI decides which to use!
        tool_choice: 'auto' // Let AI decide
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
        ];
        
        if (toolsRequiringUserId.includes(toolCall.function.name)) {
          functionArgs.user_id = user_id;
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