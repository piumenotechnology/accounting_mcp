// // export default AIOrchestrator;

// import OpenAI from 'openai';
// import MCPClient from './mcp-client.js';
// import dotenv from 'dotenv';
// dotenv.config();

// class OpenRouterOrchestrator {
//   constructor(apiKey = process.env.OPENROUTER_API_KEY) {
//     if (!apiKey) {
//       throw new Error('OPENROUTER_API_KEY is required');
//     }
    
//     this.client = new OpenAI({
//       apiKey: apiKey,
//       baseURL: 'https://openrouter.ai/api/v1',
//       defaultHeaders: {
//         'HTTP-Referer': process.env.OPENROUTER_REFERER || 'http://localhost:3000',
//         'X-Title': process.env.OPENROUTER_APP_NAME || 'MCP OpenRouter Connector'
//       }
//     });
    
//     this.mcpClient = new MCPClient();
//     this.defaultModel = 'anthropic/claude-3.5-sonnet';
//   }
  
//   async processMessage(message, modelId = null) {
//     const model = modelId || this.defaultModel;
    
//     // Connect to MCP and get tools
//     await this.mcpClient.connect();
//     const mcpTools = await this.mcpClient.listTools();
    
//     console.log('🔧 Available MCP tools:', mcpTools.tools.map(t => t.name));
    
//     // Convert MCP tools to OpenAI function format
//     const tools = mcpTools.tools.map(tool => ({
//       type: 'function',
//       function: {
//         name: tool.name,
//         description: tool.description,
//         parameters: tool.inputSchema
//       }
//     }));
    
//     let messages = [{ role: 'user', content: message }];
//     let toolsCalled = [];
//     let maxIterations = 5;
    
//     console.log(`🎯 Using model: ${model}`);
    
//     for (let iteration = 0; iteration < maxIterations; iteration++) {
//       console.log(`🔄 Iteration ${iteration + 1}/${maxIterations}`);
      
//       const response = await this.client.chat.completions.create({
//         model: model,
//         messages: messages,
//         tools: tools,
//         tool_choice: 'auto'
//       });
      
//       const choice = response.choices[0];
//       console.log('🤖 Finish reason:', choice.finish_reason);
      
//       // Handle completion without tool calls
//       if (choice.finish_reason === 'stop' || !choice.message.tool_calls) {
//         console.log('✅ Conversation complete');
//         return {
//           message: choice.message.content,
//           toolsCalled: toolsCalled,
//           model: model,
//           iterations: iteration + 1
//         };
//       }
      
//       // Handle tool calls
//       if (choice.message.tool_calls) {
//         for (const toolCall of choice.message.tool_calls) {
//           console.log(`⚡ Calling tool: ${toolCall.function.name}`);
//           toolsCalled.push(toolCall.function.name);
          
//           const functionArgs = JSON.parse(toolCall.function.arguments);
//           console.log(`   Arguments:`, functionArgs);
          
//           // Call the MCP tool
//           const toolResult = await this.mcpClient.callTool({
//             name: toolCall.function.name,
//             arguments: functionArgs
//           });
          
//           console.log(`   Result:`, toolResult.content);
          
//           // Add assistant message with tool call
//           messages.push(choice.message);
          
//           // Add tool response
//           messages.push({
//             role: 'tool',
//             tool_call_id: toolCall.id,
//             content: JSON.stringify(toolResult.content)
//           });
//         }
        
//         continue;
//       }
      
//       break;
//     }
    
//     console.log('⚠️ Max iterations reached');
//     return {
//       message: 'Max iterations reached without completion',
//       toolsCalled: toolsCalled,
//       model: model,
//       iterations: maxIterations
//     };
//   }
  
//   async close() {
//     await this.mcpClient.close();
//   }
// }

// export default OpenRouterOrchestrator;

import OpenAI from 'openai';
import MCPClient from './mcp-client.js';
import { DatabaseService } from './database.service.js';

class DataAnalysisOrchestrator {
  constructor(apiKey = process.env.OPENROUTER_API_KEY) {
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is required');
    }
    
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_REFERER || 'http://localhost:3000',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'Data Analysis AI'
      }
    });
    
    this.mcpClient = new MCPClient();
    this.dbService = new DatabaseService();
    this.defaultModel = 'anthropic/claude-3.5-sonnet';
  }
  
  /**
   * Build system prompt with user's schema context
   */
  async buildSystemPrompt(userId) {
    try {
      // Get complete schema info (tables, columns, available fields)
      const schemaInfo = await this.dbService.getCompleteSchemaInfo(userId);
      
      const systemPrompt = `You are a data analyst AI assistant with access to a PostgreSQL database.

# CRITICAL: USER ID
Your assigned user ID is: "${userId}"

IMPORTANT: When calling ANY tool that requires a userId parameter, you MUST use exactly: "${userId}"
DO NOT use any other userId. DO NOT try to guess or infer a different userId.

# USER CONTEXT
- User ID: ${userId}
- Client: ${schemaInfo.client_name}
- Schema: ${schemaInfo.schema_name}
- Referral: ${schemaInfo.referral}

# AVAILABLE DATABASE TABLES
${schemaInfo.tables.map(table => `
## Table: ${table.name}
Columns: ${table.columns.map(c => `${c.name} (${c.type})`).join(', ')}
`).join('\n')}

# AVAILABLE FIELDS (Pre-configured queries)
${schemaInfo.available_fields.length > 0 ? schemaInfo.available_fields.map(field => `
- **${field.name}**: ${field.description}
  Source: ${field.source_table}
`).join('\n') : 'No pre-configured fields available. Build queries directly using the tables above.'}

# YOUR CAPABILITIES
You have access to the following tools:

1. **execute_query**: Execute a SQL SELECT query on the database
   - ALWAYS use userId: "${userId}"
   - Example: {"userId": "${userId}", "query": "SELECT * FROM table_name"}

2. **get_field_query**: Get pre-built query for a specific field (if available)
   - ALWAYS use userId: "${userId}"
   - Example: {"userId": "${userId}", "fieldName": "total_sales"}

# HOW TO ANSWER QUESTIONS

## Step 1: Understand the Question
- Identify what data the user is asking for
- Determine which tables contain this data

## Step 2: Check if Pre-configured Field Exists
- Look at the "AVAILABLE FIELDS" section above
- If the question matches a field name, use get_field_query
- If not, build a custom SQL query

## Step 3: Build SQL Query
When building queries:
- Only use SELECT statements
- Reference tables from the AVAILABLE DATABASE TABLES section
- Use proper SQL syntax for PostgreSQL
- Use appropriate JOINs if querying multiple tables
- Add WHERE clauses for filtering
- Use GROUP BY for aggregations

## Step 4: Execute Query
- Call execute_query with userId="${userId}" and your SQL
- The system will automatically add LIMIT for safety
- Handle errors gracefully

## Step 5: Analyze and Present Results
- Interpret the query results
- Present data clearly
- Add context and insights
- If results are empty, explain why

# IMPORTANT RULES
1. **ALWAYS use userId="${userId}" in tool calls** - This is critical!
2. NEVER use DROP, DELETE, INSERT, UPDATE, ALTER, or TRUNCATE
3. Only SELECT queries are allowed
4. If a query fails, explain the error and try a corrected version
5. When uncertain about schema, refer to the tables listed above

# EXAMPLE QUERIES

User asks: "Show me all data from customers"
→ execute_query(userId="${userId}", query="SELECT * FROM customers")

User asks: "What's the total amount in January 2025?"
→ execute_query(userId="${userId}", query="SELECT SUM(amount) FROM orders WHERE date >= '2025-01-01' AND date <= '2025-01-31'")

User asks: "Show me total sales" (and total_sales is in AVAILABLE FIELDS)
→ get_field_query(userId="${userId}", fieldName="total_sales")
→ Then execute_query(userId="${userId}", query=<returned query>)

Remember: You're helping users understand their data. Be conversational, helpful, and always use the correct userId!`;

      return systemPrompt;
    } catch (error) {
      throw new Error(`Failed to build system prompt: ${error.message}`);
    }
  }
  
  /**
   * Process user question with schema context
   * ENFORCES correct userId in all tool calls
   */
  async analyzeData(userId, userQuestion, modelId = null) {
    const model = modelId || this.defaultModel;
    
    try {
      console.log(`\n📊 Data Analysis Request`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Question: "${userQuestion}"`);
      console.log(`   Model: ${model}`);
      
      // Build system prompt with user's schema
      const systemPrompt = await this.buildSystemPrompt(userId);
      
      // Connect to MCP and get tools
      await this.mcpClient.connect();
      const mcpTools = await this.mcpClient.listTools();
      
      console.log(`🔧 Available tools: ${mcpTools.tools.map(t => t.name).join(', ')}`);
      
      // Convert MCP tools to OpenAI function format
      const tools = mcpTools.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }
      }));
      
      // Initialize conversation with system prompt and user question
      let messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuestion }
      ];
      
      let toolsCalled = [];
      let maxIterations = 10;
      
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        console.log(`🔄 Iteration ${iteration + 1}/${maxIterations}`);
        
        const response = await this.client.chat.completions.create({
          model: model,
          messages: messages,
          tools: tools,
          tool_choice: 'auto'
        });
        
        const choice = response.choices[0];
        console.log(`   Finish reason: ${choice.finish_reason}`);
        
        // Handle completion without tool calls
        if (choice.finish_reason === 'stop' || !choice.message.tool_calls) {
          console.log('✅ Analysis complete\n');
          return {
            success: true,
            answer: choice.message.content,
            toolsCalled: toolsCalled,
            model: model,
            iterations: iteration + 1,
            userId: userId,
            usage: response.usage
          };
        }
        
        // Handle tool calls
        if (choice.message.tool_calls) {
          // Add assistant message to history
          messages.push(choice.message);
          
          for (const toolCall of choice.message.tool_calls) {
            const toolName = toolCall.function.name;
            let toolArgs = JSON.parse(toolCall.function.arguments);
            
            console.log(`⚡ Calling tool: ${toolName}`);
            console.log(`   Arguments:`, toolArgs);
            
            // CRITICAL FIX: Force correct userId for database tools
            if (['execute_query', 'get_field_query'].includes(toolName)) {
              if (toolArgs.userId !== userId) {
                console.log(`   ⚠️  Wrong userId detected: "${toolArgs.userId}" → Correcting to "${userId}"`);
                toolArgs.userId = userId;
              }
            }
            
            toolsCalled.push({
              tool: toolName,
              args: toolArgs
            });
            
            // Call the MCP tool with corrected userId
            const toolResult = await this.mcpClient.callTool({
              name: toolName,
              arguments: toolArgs
            });
            
            console.log(`   Result: ${JSON.stringify(toolResult.content).substring(0, 200)}...`);
            
            // Add tool response to messages
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult.content)
            });
          }
          
          continue;
        }
        
        break;
      }
      
      console.log('⚠️ Max iterations reached\n');
      return {
        success: false,
        answer: 'Analysis reached maximum iterations without completion. Please try rephrasing your question.',
        toolsCalled: toolsCalled,
        model: model,
        iterations: maxIterations,
        userId: userId
      };
      
    } catch (error) {
      console.error('❌ Analysis error:', error.message);
      throw error;
    }
  }
  
  /**
   * Quick query - for direct SQL execution without AI analysis
   */
  async executeDirectQuery(userId, query, limit = 100) {
    try {
      console.log(`⚡ Direct query execution for user ${userId}`);
      return await this.dbService.executeQuery(userId, query, limit);
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get schema info - useful for debugging or showing user their schema
   */
  async getSchemaInfo(userId) {
    try {
      return await this.dbService.getCompleteSchemaInfo(userId);
    } catch (error) {
      throw error;
    }
  }
  
  async close() {
    await this.mcpClient.close();
    await this.dbService.close();
  }
}

export default DataAnalysisOrchestrator;