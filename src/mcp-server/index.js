import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { countTool } from './tools/counter.tool.js';
import { weatherTool } from './tools/weather.tool.js';
import { DatabaseService } from '../services/database.service.js';

// Initialize database service
const dbService = new DatabaseService();

// Create MCP server
const server = new Server({
  name: 'data-analysis-server',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Define all tools
const TOOLS = [
  {
    name: 'count',
    description: 'Count from start number to end number. Returns an array of numbers.',
    inputSchema: {
      type: 'object',
      properties: {
        start: {
          type: 'number',
          description: 'Starting number'
        },
        end: {
          type: 'number',
          description: 'Ending number'
        }
      },
      required: ['start', 'end']
    }
  },
  {
    name: 'weather',
    description: 'Get the current weather for a given location.',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'Location to get the weather for'
        }
      },
      required: ['location']
    }
  },
    {
    name: 'execute_query',
    description: 'Execute a SQL SELECT query on the user database and get real data. Only SELECT queries are allowed. The query will be automatically limited for safety. This is the MAIN tool you need to actually get data from the database.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to determine which schema to query'
        },
        query: {
          type: 'string',
          description: 'SQL SELECT query to execute. Do not include LIMIT clause (automatically added). Example: SELECT * FROM customers WHERE state = \'CA\''
        },
        limit: {
          type: 'number',
          description: 'Maximum number of rows to return (default: 100, max: 1000)',
          default: 100
        }
      },
      required: ['userId', 'query']
    }
  },
  {
    name: 'get_field_query',
    description: 'Get a pre-built SQL query for a specific field based on query rules. Use this when the user asks about a field that has pre-configured query logic (complex JOINs, aggregations, etc). The field names are listed in your system prompt under "AVAILABLE FIELDS".',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        fieldName: {
          type: 'string',
          description: 'Field name to get query for (must match a field from AVAILABLE FIELDS in your system prompt)'
        }
      },
      required: ['userId', 'fieldName']
    }
  }
];

// Handle tools/list request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Tool handlers
const toolHandlers = {
  count: async (args) => {
    console.error(`⚡ MCP: Executing count tool: ${args.start} to ${args.end}`);
    const result = await countTool({ start: args.start, end: args.end });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result)
      }]
    };
  },
  
  weather: async (args) => {
    console.error(`⚡ MCP: Executing weather tool for location: ${args.location}`);
    const result = await weatherTool({ location: args.location });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result)
      }]
    };
  },
  
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
  console.error('✅ MCP Data Analysis Server started successfully');
  console.error('📊 Database tools enabled');
}

main().catch(error => {
  console.error('❌ Failed to start MCP server:', error);
  process.exit(1);
});