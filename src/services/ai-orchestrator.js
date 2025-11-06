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
   * Build smart system prompt with SAMPLE DATA for AI reasoning
   * This is the key to intelligent table selection!
   */
  async buildSystemPrompt(userId) {
    try {
      // Get complete schema info
      const schemaInfo = await this.dbService.getCompleteSchemaInfo(userId);
      
      // Get sample data from all tables (this is the magic!)
      const samples = await this.dbService.getTableSamples(userId, 3);
      
      const systemPrompt = `You are a data analyst AI assistant with access to a PostgreSQL database.

# CRITICAL: USER ID
Your assigned user ID is: "${userId}"

IMPORTANT: When calling ANY tool that requires a userId parameter, you MUST use exactly: "${userId}"

# USER CONTEXT
- User ID: ${userId}
- Client: ${schemaInfo.client_name}
- Schema: ${schemaInfo.schema_name}
- Referral: ${schemaInfo.referral}

# AVAILABLE DATABASE TABLES WITH SAMPLE DATA

${schemaInfo.tables.map(table => {
  const sampleData = samples[table.name] || [];
  return `
## Table: ${table.name}

Columns: ${table.columns.map(c => `${c.name} (${c.type})`).join(', ')}

Sample Data (first 3 rows to help you understand what's in this table):
${sampleData.length > 0 ? JSON.stringify(sampleData, null, 2) : 'No sample data available'}

${this.analyzeTablePurpose(table.name, table.columns, sampleData)}
`;
}).join('\n')}

${schemaInfo.available_fields.length > 0 ? `
# AVAILABLE PRE-CONFIGURED FIELDS
${schemaInfo.available_fields.map(field => `
- **${field.name}**: ${field.description}
  Source Table: ${field.source_table}
`).join('\n')}
` : ''}

# YOUR CAPABILITIES

You have access to these tools:

1. **execute_query**: Execute a SQL SELECT query
   - ALWAYS use userId: "${userId}"
   
2. **get_field_query**: Get pre-built SQL for a pre-configured field
   - ALWAYS use userId: "${userId}"
   
3. **sample_table_data**: Get sample rows from a specific table (ONLY if you're really unsure after analyzing the samples above)
   - ALWAYS use userId: "${userId}"

# CRITICAL INSTRUCTION: HOW TO SELECT THE RIGHT TABLE

This is THE MOST IMPORTANT part of your job!

## Step 1: Analyze the User's Question
- What data are they asking for?
- What keywords are in the question? (balance, sales, revenue, transactions, etc.)

## Step 2: Study the Sample Data Above
- Look at the SAMPLE DATA for each table
- See what actual values are in each table
- Understand what type of data each table contains

## Step 3: Match Question to Table
Use this reasoning:

- If question mentions **"balance", "assets", "liabilities", "equity", "financial position"**
  → Look for tables with account_type like "Asset", "Liability", "Equity"
  → This is typically a BALANCE SHEET table
  
- If question mentions **"sales", "revenue", "income", "expenses", "profit", "loss"**
  → Look for tables with categories like "Income", "Expense", "Revenue"
  → This is typically an INCOME STATEMENT table
  
- If question mentions **"payments", "deposits", "transactions", "transfers", "bank"**
  → Look for tables with transaction descriptions or payment types
  → This is typically a TRANSACTIONS table

## Step 4: Pick ONE Table
- Based on your analysis, pick the MOST RELEVANT table
- DO NOT try multiple tables
- Make a smart choice on the FIRST attempt

## Step 5: Build and Execute Query
- Build your SQL query using the chosen table
- Use proper WHERE clauses for filtering
- Use aggregations (SUM, COUNT, AVG) if needed
- Execute with execute_query tool

## Step 6: Stop When You Have the Answer
- If your query returns results → You're done! Answer the user.
- DO NOT query additional tables "just to check"
- DO NOT query multiple tables unless the question specifically asks for comparison
- Trust your first choice if it returns data

# CRITICAL: ONE TABLE RULE
Unless the user explicitly asks to compare or check multiple sources:
- Query ONE table only
- If it returns data → Use it and answer
- If it returns empty → Then try another table
- DO NOT "verify" by checking other tables

# EXAMPLE REASONING PROCESS

User asks: "What's my total balance in January 2025?"

Your thought process should be:
1. Keywords: "balance", "January"
2. Looking at sample data:
   - Table A has account_type: "Asset", "Liability" → BALANCE SHEET ✅
   - Table B has category: "Income", "Expense" → INCOME STATEMENT ❌
3. Decision: Use Table A
4. Query: SELECT SUM(amount) FROM table_a WHERE date >= '2025-01-01' AND date <= '2025-01-31'

# IMPORTANT RULES

1. **ALWAYS use userId="${userId}"** in every tool call
2. **Only SELECT queries** - no DELETE, INSERT, UPDATE, etc.
3. **Pick the right table FIRST** - don't waste iterations trying wrong tables
4. **Use the sample data** - it shows you exactly what's in each table
5. **STOP when you get results** - don't query more tables "just to check"
6. **If query fails**, analyze the error and try a different approach
7. **Be confident** - the sample data gives you everything you need to decide

# WHEN TO QUERY MULTIPLE TABLES

Query multiple tables ONLY when:
- ✅ User asks: "Compare X across tables"
- ✅ User asks: "Check all tables for X"
- ✅ User asks: "Show X from both Y and Z"

DO NOT query multiple tables when:
- ❌ You already found the answer
- ❌ You want to "verify" or "double-check"
- ❌ You're just being thorough
- ❌ The question doesn't mention multiple sources

# EXAMPLES

Good (stops after finding answer):
User: "When was my last Tesco purchase?"
→ Query bank_transaction → Found result → Answer user ✅

Bad (unnecessarily queries multiple tables):
User: "When was my last Tesco purchase?"
→ Query bank_transaction → Found result
→ Also query pl_xero "to check" → Waste of time ❌

Good (legitimately needs multiple tables):
User: "Show Tesco purchases from both bank transactions and expenses"
→ Query bank_transaction → Get results
→ Query pl_xero → Get results
→ Combine and answer ✅

# ERROR HANDLING

If a query fails:
- Read the error message carefully
- Don't blindly try other tables
- Think about what went wrong
- Adjust your query or approach

Remember: You have sample data from every table. Use it wisely to make the right choice on the first try!`;

      return systemPrompt;
    } catch (error) {
      throw new Error(`Failed to build system prompt: ${error.message}`);
    }
  }
  
  /**
   * Helper to analyze table purpose from sample data
   */
  analyzeTablePurpose(tableName, columns, sampleData) {
    if (sampleData.length === 0) return '';
    
    const columnNames = columns.map(c => c.name.toLowerCase());
    const firstRow = sampleData[0];
    
    let hints = 'AI Hint: ';
    
    // Check for balance sheet indicators
    if (columnNames.includes('account_type') && firstRow.account_type) {
      const types = sampleData.map(r => r.account_type).filter(Boolean);
      if (types.some(t => ['asset', 'liability', 'equity'].includes(t.toLowerCase()))) {
        hints += 'This appears to be BALANCE SHEET data (assets, liabilities, equity). ';
      }
    }
    
    // Check for income statement indicators
    if (columnNames.includes('category') && firstRow.category) {
      const categories = sampleData.map(r => r.category).filter(Boolean);
      if (categories.some(c => ['income', 'expense', 'revenue'].includes(c.toLowerCase()))) {
        hints += 'This appears to be INCOME STATEMENT data (income, expenses). ';
      }
    }
    
    // Check for transaction indicators
    if (columnNames.includes('transaction_id') || columnNames.includes('description')) {
      hints += 'This appears to be TRANSACTION data (payments, deposits). ';
    }
    
    // Check for common monetary columns
    if (columnNames.includes('amount') || columnNames.includes('line_amount')) {
      hints += 'Contains monetary amounts. ';
    }
    
    // Check for date columns
    if (columnNames.includes('date') || columnNames.includes('transaction_date')) {
      hints += 'Has date column for filtering. ';
    }
    
    return hints;
  }
  
  /**
   * Process user question with schema context and AI reasoning
   */
  async analyzeData(userId, userQuestion, modelId = null) {
    const model = modelId || this.defaultModel;
    
    try {
      console.log(`\n📊 Data Analysis Request`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Question: "${userQuestion}"`);
      console.log(`   Model: ${model}`);
      
      // Build smart system prompt with samples
      console.log(`🧠 Building AI context with sample data...`);
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
      
      // Initialize conversation
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
        
        // Handle completion
        if (choice.finish_reason === 'stop' || !choice.message.tool_calls) {
          console.log('✅ Analysis complete\n');
          return {
            success: true,
            answer: choice.message.content,
            toolsCalled: toolsCalled,
            model: model,
            iterations: iteration + 1,
            userId: userId
          };
        }
        
        // Handle tool calls
        if (choice.message.tool_calls) {
          messages.push(choice.message);
          
          for (const toolCall of choice.message.tool_calls) {
            const toolName = toolCall.function.name;
            let toolArgs = JSON.parse(toolCall.function.arguments);
            
            console.log(`⚡ Calling tool: ${toolName}`);
            console.log(`   Arguments:`, toolArgs);
            
            // Force correct userId for database tools
            if (['execute_query', 'get_field_query', 'sample_table_data'].includes(toolName)) {
              if (toolArgs.userId !== userId) {
                console.log(`   ⚠️  Wrong userId detected: "${toolArgs.userId}" → Correcting to "${userId}"`);
                toolArgs.userId = userId;
              }
            }
            
            toolsCalled.push({
              tool: toolName,
              args: toolArgs
            });
            
            // Call the MCP tool
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
        answer: 'Analysis reached maximum iterations. The question might be too complex or ambiguous.',
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