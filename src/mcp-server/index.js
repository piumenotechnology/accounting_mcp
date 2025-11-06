import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { DatabaseService } from '../services/database.service.js';

// Initialize database service
const dbService = new DatabaseService();

// Create MCP server
const server = new Server({
  name: 'data-analysis-server-smart',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Tools with sample_table_data as optional safety net
const TOOLS = [
  {
    name: 'execute_query',
    description: 'Execute a SQL SELECT query on the user database and get real data. Only SELECT queries are allowed. This is the main tool to get data after you decide which table to use.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to determine which schema to query'
        },
        query: {
          type: 'string',
          description: 'SQL SELECT query to execute. Do not include LIMIT (automatically added).'
        },
        limit: {
          type: 'number',
          description: 'Maximum rows to return (default: 100, max: 1000)',
          default: 100
        }
      },
      required: ['userId', 'query']
    }
  },
  {
    name: 'get_field_query',
    description: 'Get pre-built SQL query for a specific field based on query rules. Use when user asks about a pre-configured field listed in AVAILABLE FIELDS.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        fieldName: {
          type: 'string',
          description: 'Field name from AVAILABLE FIELDS in system prompt'
        }
      },
      required: ['userId', 'fieldName']
    }
  },
  {
    name: 'sample_table_data',
    description: 'Get sample rows from a specific table. ONLY USE THIS if you are truly unsure which table to query after analyzing the sample data already provided in your system prompt. This is a safety net - prefer using the samples already in your context.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        tableName: {
          type: 'string',
          description: 'Name of the table to sample'
        },
        limit: {
          type: 'number',
          description: 'Number of rows to return (default: 5)',
          default: 5
        }
      },
      required: ['userId', 'tableName']
    }
  }
];

// Handle tools/list request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Tool handlers
const toolHandlers = {
  execute_query: async (args) => {
    console.error(`⚡ MCP: Executing query for user ${args.userId}`);
    console.error(`   Query: ${args.query.substring(0, 100)}...`);
    
    const limit = Math.min(args.limit || 100, 1000);
    const result = await dbService.executeQuery(args.userId, args.query, limit);
    
    if (result.success) {
      console.error(`   ✅ Success: ${result.row_count} rows returned`);
    } else {
      console.error(`   ❌ Error: ${result.error}`);
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result)
      }]
    };
  },
  
  get_field_query: async (args) => {
    console.error(`⚡ MCP: Getting query for field "${args.fieldName}" (user ${args.userId})`);
    
    const result = await dbService.buildQueryForField(args.userId, args.fieldName);
    
    if (result.success) {
      console.error(`   ✅ Query built successfully`);
    } else {
      console.error(`   ❌ Error: ${result.error}`);
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result)
      }]
    };
  },
  
  sample_table_data: async (args) => {
    console.error(`⚡ MCP: Sampling table "${args.tableName}" (user ${args.userId})`);
    
    const limit = Math.min(args.limit || 5, 20);
    const result = await dbService.sampleSpecificTable(args.userId, args.tableName, limit);
    
    if (result.success) {
      console.error(`   ✅ Retrieved ${result.row_count} sample rows`);
    } else {
      console.error(`   ❌ Error: ${result.error}`);
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result)
      }]
    };
  }
};

// Handle tools/call request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    const handler = toolHandlers[name];
    
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }
    
    return await handler(args);
    
  } catch (error) {
    console.error(`❌ MCP: Tool execution error for ${name}:`, error);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ 
          success: false,
          error: error.message 
        })
      }],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ MCP Smart Data Analysis Server started');
  console.error('🧠 AI reasoning with sample data enabled');
  console.error('🔧 Available tools: execute_query, get_field_query, sample_table_data');
}

main().catch(error => {
  console.error('❌ Failed to start MCP server:', error);
  process.exit(1);
});