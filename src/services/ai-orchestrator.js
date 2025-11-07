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
   * Build smart system prompt with SAMPLE DATA and clear instructions
   */
  async buildSystemPrompt(userId) {
    try {
      const schemaInfo = await this.dbService.getCompleteSchemaInfo(userId);
      const samples = await this.dbService.getTableSamples(userId, 3);
      
      const systemPrompt = `You are a data analyst AI assistant with access to a PostgreSQL database.

# CRITICAL: USER ID
Your assigned user ID is: "${userId}"
IMPORTANT: When calling ANY tool, ALWAYS use userId: "${userId}"

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

Sample Data (first 3 rows):
${sampleData.length > 0 ? JSON.stringify(sampleData, null, 2) : 'No sample data available'}

${this.analyzeTablePurpose(table.name, table.columns, sampleData)}
`;
}).join('\n')}

${schemaInfo.available_fields.length > 0 ? `
# ========================================
# PRE-CONFIGURED FIELDS (VERY IMPORTANT!)
# ========================================

These fields have pre-built queries with correct formulas and JOINs.
THESE ARE NOT REGULAR COLUMNS - they are calculated fields or complex queries!

${schemaInfo.available_fields.map(field => `
## ${field.name}
Description: ${field.description}
Source Table: ${field.source_table}

⚠️  CRITICAL: This is a PRE-CONFIGURED field!
To use this field, you MUST:
1. Call get_field_query(userId="${userId}", fieldName="${field.name}")
2. You'll receive the correct formula/query structure
3. Then add user's filters (customer, date, vehicle, etc.)
4. Then execute the final query

DO NOT try to query a column called "${field.name}" - it doesn't exist!
DO NOT build this query from scratch - use get_field_query!
`).join('\n')}

# ========================================
# CRITICAL: HOW TO USE PRE-CONFIGURED FIELDS
# ========================================

When user asks about ANY of the fields listed above:

**MANDATORY PROCESS:**

1. **FIRST** → Call get_field_query(userId="${userId}", fieldName="field_name")
   This returns the correct formula, JOINs, and structure

2. **SECOND** → Examine the returned query structure
   - Note the table aliases (e.g., "so" for sales_orders)
   - Note the formula (e.g., "(so.monthly_rental * so.margin_term) + so.first_payment")
   - Note any JOINs required

3. **THIRD** → Adapt the query for user's specific filters
   - Add WHERE clauses for: customer name, vehicle, date, etc.
   - Add GROUP BY if user wants breakdown
   - Add ORDER BY if user wants sorting
   - Wrap in SUM/COUNT/AVG if user wants aggregation

4. **FOURTH** → Execute the final query with execute_query

**EXAMPLES:**

Example 1 - User asks: "total income for vehicle HV71 UOR"
❌ WRONG: SELECT SUM(total_income) FROM sales_orders WHERE vehicle = 'HV71 UOR'
           (total_income column doesn't exist!)

✅ CORRECT:
   Step 1: get_field_query(userId="${userId}", fieldName="total_income")
           Returns: "(so.monthly_rental * so.margin_term) + so.first_payment"
                    with JOIN to purchase_orders
   
   Step 2: Build query:
           SELECT SUM((so.monthly_rental * so.margin_term) + so.first_payment) as total_income
           FROM sales_orders so
           JOIN purchase_orders po ON po.id = so.id_purchase_order
           WHERE po.vehicle_registration = 'HV71 UOR'
   
   Step 3: execute_query(userId="${userId}", query="...")

Example 2 - User asks: "monthly revenue by customer"
✅ CORRECT:
   Step 1: get_field_query(userId="${userId}", fieldName="monthly_revenue")
   Step 2: Add GROUP BY customer
   Step 3: execute_query with grouped query

` : 'No pre-configured fields available. Build queries directly from tables.'}

# YOUR CAPABILITIES

You have these tools:

1. **get_field_query** - Get pre-built query for a pre-configured field
   USE THIS for any field listed in "PRE-CONFIGURED FIELDS" section above!
   
2. **execute_query** - Execute a SQL SELECT query
   Use AFTER getting field query or for direct table queries
   
3. **sample_table_data** - Get sample rows (only if really unsure)

# TABLE SELECTION STRATEGY

## Step 1: Check if Pre-Configured Field Exists
- Is user asking about a field in "PRE-CONFIGURED FIELDS"?
- If YES → MUST call get_field_query first!
- If NO → Proceed to build custom query

## Step 2: Analyze Question (for custom queries)
- What data are they asking for?
- Which table contains this data? (use sample data to decide)

## Step 3: Pick ONE Table
- Choose most relevant table based on sample data
- DO NOT try multiple tables unless user explicitly asks for comparison

## Step 4: Build Query
- Use proper table aliases
- Add WHERE clauses for filters
- Use aggregations if needed

## Step 5: Execute
- Call execute_query with userId="${userId}"

## Step 6: Stop When You Have Answer
- If query returns data → Answer user immediately
- DO NOT query additional tables "to verify"

# IMPORTANT RULES

1. **ALWAYS use userId="${userId}"** in every tool call
2. **For pre-configured fields** → ALWAYS call get_field_query first
3. **DO NOT invent column names** - use actual columns or get_field_query formulas
4. **Only SELECT queries** - no DELETE, INSERT, UPDATE, etc.
5. **Stop when you get results** - don't query more tables unnecessarily
6. **Use sample data** to pick right table on first try
7. **Be decisive** - one table, one query, one answer

# WHEN TO QUERY MULTIPLE TABLES

ONLY query multiple tables when:
- ✅ User asks: "Compare X across tables"
- ✅ User asks: "Check all tables for X"  
- ✅ User asks: "Show from both Y and Z"

DO NOT query multiple tables when:
- ❌ You already found the answer
- ❌ You want to "verify"
- ❌ The question doesn't mention multiple sources

# ERROR HANDLING

If query fails:
- Read error carefully
- If "column doesn't exist" → Did you forget get_field_query?
- If "table doesn't exist" → Check available tables above
- Adjust and try once more

Remember: Pre-configured fields are FORMULAS, not columns. Always use get_field_query for them!`;

      return systemPrompt;
    } catch (error) {
      throw new Error(`Failed to build system prompt: ${error.message}`);
    }
  }
  
  analyzeTablePurpose(tableName, columns, sampleData) {
    if (sampleData.length === 0) return '';
    
    const columnNames = columns.map(c => c.name.toLowerCase());
    const firstRow = sampleData[0];
    
    let hints = 'AI Hint: ';
    
    if (columnNames.includes('account_type') && firstRow.account_type) {
      const types = sampleData.map(r => r.account_type).filter(Boolean);
      if (types.some(t => ['asset', 'liability', 'equity'].includes(t.toLowerCase()))) {
        hints += 'This appears to be BALANCE SHEET data (assets, liabilities, equity). ';
      }
    }
    
    if (columnNames.includes('category') && firstRow.category) {
      const categories = sampleData.map(r => r.category).filter(Boolean);
      if (categories.some(c => ['income', 'expense', 'revenue'].includes(c.toLowerCase()))) {
        hints += 'This appears to be INCOME STATEMENT data (income, expenses). ';
      }
    }
    
    if (columnNames.includes('transaction_id') || columnNames.includes('description')) {
      hints += 'This appears to be TRANSACTION data (payments, deposits). ';
    }
    
    if (columnNames.includes('amount') || columnNames.includes('line_amount')) {
      hints += 'Contains monetary amounts. ';
    }
    
    if (columnNames.includes('date') || columnNames.includes('transaction_date')) {
      hints += 'Has date column for filtering. ';
    }
    
    return hints;
  }
  
  async analyzeData(userId, userQuestion, modelId = null) {
    const model = modelId || this.defaultModel;
    
    try {
      console.log(`\n📊 Data Analysis Request`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Question: "${userQuestion}"`);
      console.log(`   Model: ${model}`);
      
      console.log(`🧠 Building AI context with sample data...`);
      const systemPrompt = await this.buildSystemPrompt(userId);
      
      await this.mcpClient.connect();
      const mcpTools = await this.mcpClient.listTools();
      
      console.log(`🔧 Available tools: ${mcpTools.tools.map(t => t.name).join(', ')}`);
      
      const tools = mcpTools.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }
      }));
      
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
        
        if (choice.message.tool_calls) {
          messages.push(choice.message);
          
          for (const toolCall of choice.message.tool_calls) {
            const toolName = toolCall.function.name;
            let toolArgs = JSON.parse(toolCall.function.arguments);
            
            console.log(`⚡ Calling tool: ${toolName}`);
            console.log(`   Arguments:`, toolArgs);
            
            // Force correct userId
            if (['execute_query', 'get_field_query', 'sample_table_data'].includes(toolName)) {
              if (toolArgs.userId !== userId) {
                console.log(`   ⚠️  Wrong userId: "${toolArgs.userId}" → Correcting to "${userId}"`);
                toolArgs.userId = userId;
              }
            }
            
            toolsCalled.push({
              tool: toolName,
              args: toolArgs
            });
            
            const toolResult = await this.mcpClient.callTool({
              name: toolName,
              arguments: toolArgs
            });
            
            console.log(`   Result: ${JSON.stringify(toolResult.content).substring(0, 200)}...`);
            
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
        answer: 'Analysis reached maximum iterations.',
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