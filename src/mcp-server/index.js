import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { countTool } from './tools/counter.tool.js';
import { weatherTool } from './tools/weather.tool.js';

// Create MCP server
const server = new Server({
  name: 'simple-counter-server',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Define all tools in one place for better organization
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
  }
];

// Handle tools/list request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Tool handlers - clean separation of concerns
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
        text: JSON.stringify({ error: error.message })
      }],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ MCP Server started successfully');
}

main().catch(error => {
  console.error('❌ Failed to start MCP server:', error);
  process.exit(1);
});