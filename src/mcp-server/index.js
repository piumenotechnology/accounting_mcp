import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { countTool } from './tools/counter.tool.js';
import { weatherTool } from './tools/weather.tool.js';
import { 
  createCalendarEventTool, 
  listCalendarEventsTool,
  updateCalendarEventTool,
  deleteCalendarEventTool,
  checkGoogleConnectionTool
} from './tools/calendar.tool.js';

// Create MCP server
const server = new Server({
  name: 'multi-tool-server',
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
        start: { type: 'number', description: 'Starting number' },
        end: { type: 'number', description: 'Ending number' }
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
        location: { type: 'string', description: 'Location to get the weather for' }
      },
      required: ['location']
    }
  },
  {
    name: 'check_google_connection',
    description: 'Check if Google Calendar is connected and working for the user.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { 
          type: 'string', 
          description: 'User ID to check connection for' 
        }
      },
      required: ['user_id']
    }
  },
  {
    name: 'create_calendar_event',
    description: 'Create a new event in Google Calendar.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { 
          type: 'string', 
          description: 'User ID for authentication' 
        },
        summary: { type: 'string', description: 'Event title/summary' },
        description: { type: 'string', description: 'Event description (optional)' },
        startDateTime: { 
          type: 'string', 
          description: 'Start date and time in ISO 8601 format (e.g., 2025-10-25T10:00:00)' 
        },
        endDateTime: { 
          type: 'string', 
          description: 'End date and time in ISO 8601 format (e.g., 2025-10-25T11:00:00)' 
        },
        timeZone: { 
          type: 'string', 
          description: 'Time zone (e.g., Asia/Makassar, America/New_York)',
          default: 'Asia/Makassar'
        },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of attendee email addresses (optional)'
        }
      },
      required: ['user_id', 'summary', 'startDateTime', 'endDateTime']
    }
  },
  {
    name: 'list_calendar_events',
    description: 'List upcoming events from Google Calendar.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { 
          type: 'string', 
          description: 'User ID for authentication' 
        },
        maxResults: { 
          type: 'number', 
          description: 'Maximum number of events to return',
          default: 10
        },
        timeMin: { 
          type: 'string', 
          description: 'Lower bound for event start time (ISO 8601 format)'
        }
      },
      required: ['user_id']
    }
  },
  {
    name: 'update_calendar_event',
    description: 'Update an existing Google Calendar event.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { 
          type: 'string', 
          description: 'User ID for authentication' 
        },
        eventId: { type: 'string', description: 'Event ID to update' },
        summary: { type: 'string', description: 'New event title/summary' },
        description: { type: 'string', description: 'New event description' },
        startDateTime: { type: 'string', description: 'New start date/time (ISO 8601)' },
        endDateTime: { type: 'string', description: 'New end date/time (ISO 8601)' },
        timeZone: { type: 'string', default: 'Asia/Makassar' },
        attendees: { type: 'array', items: { type: 'string' } }
      },
      required: ['user_id', 'eventId']
    }
  },
  {
    name: 'delete_calendar_event',
    description: 'Delete a Google Calendar event.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { 
          type: 'string', 
          description: 'User ID for authentication' 
        },
        eventId: { type: 'string', description: 'Event ID to delete' }
      },
      required: ['user_id', 'eventId']
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
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },
  
  weather: async (args) => {
    console.error(`⚡ MCP: Executing weather tool for location: ${args.location}`);
    const result = await weatherTool({ location: args.location });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  check_google_connection: async (args) => {
    console.error(`⚡ MCP: Checking Google connection for user: ${args.user_id}`);
    const result = await checkGoogleConnectionTool({ userId: args.user_id });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  create_calendar_event: async (args) => {
    console.error(`⚡ MCP: Creating calendar event for user: ${args.user_id}`);
    const { user_id, ...eventData } = args;
    const result = await createCalendarEventTool({ 
      userId: user_id, 
      ...eventData 
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  list_calendar_events: async (args) => {
    console.error(`⚡ MCP: Listing calendar events for user: ${args.user_id}`);
    const { user_id, ...queryData } = args;
    const result = await listCalendarEventsTool({ 
      userId: user_id, 
      ...queryData 
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  update_calendar_event: async (args) => {
    console.error(`⚡ MCP: Updating calendar event for user: ${args.user_id}`);
    const { user_id, ...eventData } = args;
    const result = await updateCalendarEventTool({ 
      userId: user_id, 
      ...eventData 
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  delete_calendar_event: async (args) => {
    console.error(`⚡ MCP: Deleting calendar event for user: ${args.user_id}`);
    const { user_id, ...eventData } = args;
    const result = await deleteCalendarEventTool({ 
      userId: user_id, 
      ...eventData 
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
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
          error: error.message,
          code: error.code 
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
  console.error('✅ MCP Server started successfully');
}

main().catch(error => {
  console.error('❌ Failed to start MCP server:', error);
  process.exit(1);
});