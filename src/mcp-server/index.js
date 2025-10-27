import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { weatherTool } from './tools/weather.tool.js';
import { 
  prepareCalendarEventTool,
  confirmCreateCalendarEventTool,
  listCalendarEventsTool,
  prepareUpdateCalendarEventTool,
  confirmUpdateCalendarEventTool,
  prepareDeleteCalendarEventTool,
  confirmDeleteCalendarEventTool,
  checkGoogleConnectionTool
} from './tools/calendar.tool.js';
import { prepareEmailTool, confirmSendEmailTool, searchEmailsTool } from './tools/email.tool.js';
import { searchInternetTool, fetchWebContentTool } from './tools/search.tool.js';

// Create MCP server
const server = new Server({
  name: 'multi-tool-server',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Define all tools - DON'T include user_id in schema (we inject it)
const TOOLS = [
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
    description: 'Check if Google Calendar is connected and working.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'prepare_calendar_event',
    description: 'Prepare a new calendar event for creation. This will create a preview and require user confirmation before actually creating. Always use this instead of directly creating events.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Event title/summary' },
        description: { type: 'string', description: 'Event description (optional)' },
        startDateTime: { 
          type: 'string', 
          description: 'Start date and time in ISO 8601 format (e.g., 2025-10-27T14:00:00)' 
        },
        endDateTime: { 
          type: 'string', 
          description: 'End date and time in ISO 8601 format (e.g., 2025-10-27T15:00:00)' 
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
      required: ['summary', 'startDateTime', 'endDateTime']
    }
  },
  {
    name: 'confirm_create_calendar_event',
    description: 'Confirm and create a previously prepared calendar event. Use this after user confirms they want to create the event.',
    inputSchema: {
      type: 'object',
      properties: {
        confirmationId: { 
          type: 'string', 
          description: 'The confirmation ID from the prepare_calendar_event response' 
        },
        confirmed: { 
          type: 'boolean', 
          description: 'true to create the event, false to cancel' 
        }
      },
      required: ['confirmationId', 'confirmed']
    }
  },
  {
    name: 'list_calendar_events',
    description: 'List upcoming events from Google Calendar.',
    inputSchema: {
      type: 'object',
      properties: {
        maxResults: { 
          type: 'number', 
          description: 'Maximum number of events to return',
          default: 5
        },
        timeMin: { 
          type: 'string', 
          description: 'Lower bound for event start time (ISO 8601 format)'
        }
      }
    }
  },
  {
    name: 'prepare_update_calendar_event',
    description: 'Prepare to update an existing calendar event. This will show current and new details and require user confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID to update' },
        summary: { type: 'string', description: 'New event title/summary' },
        description: { type: 'string', description: 'New event description' },
        startDateTime: { type: 'string', description: 'New start date/time (ISO 8601)' },
        endDateTime: { type: 'string', description: 'New end date/time (ISO 8601)' },
        timeZone: { type: 'string', default: 'Asia/Makassar' },
        attendees: { type: 'array', items: { type: 'string' } }
      },
      required: ['eventId']
    }
  },
  {
    name: 'confirm_update_calendar_event',
    description: 'Confirm and update a previously prepared calendar event update. Use this after user confirms.',
    inputSchema: {
      type: 'object',
      properties: {
        confirmationId: { 
          type: 'string', 
          description: 'The confirmation ID from the prepare_update_calendar_event response' 
        },
        confirmed: { 
          type: 'boolean', 
          description: 'true to update the event, false to cancel' 
        }
      },
      required: ['confirmationId', 'confirmed']
    }
  },
  {
    name: 'prepare_delete_calendar_event',
    description: 'Prepare to delete a calendar event. This will show event details and require user confirmation before deletion.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID to delete' }
      },
      required: ['eventId']
    }
  },
  {
    name: 'confirm_delete_calendar_event',
    description: 'Confirm and delete a previously prepared calendar event deletion. Use this after user confirms.',
    inputSchema: {
      type: 'object',
      properties: {
        confirmationId: { 
          type: 'string', 
          description: 'The confirmation ID from the prepare_delete_calendar_event response' 
        },
        confirmed: { 
          type: 'boolean', 
          description: 'true to delete the event, false to cancel' 
        }
      },
      required: ['confirmationId', 'confirmed']
    }
  },
  // NEW EMAIL TOOLS
  {
    name: 'prepare_email',
    description: 'Prepare an email for sending. This will create a preview and require user confirmation before actually sending. Always use this instead of directly sending emails.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { 
          type: ['string', 'array'],
          description: 'Recipient email address(es). Can be a single string or array of strings.',
          items: { type: 'string' }
        },
        subject: { 
          type: 'string', 
          description: 'Email subject line' 
        },
        body: { 
          type: 'string', 
          description: 'Email body content (plain text)' 
        },
        cc: {
          type: 'array',
          items: { type: 'string' },
          description: 'CC email addresses (optional)'
        },
        bcc: {
          type: 'array',
          items: { type: 'string' },
          description: 'BCC email addresses (optional)'
        }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'confirm_send_email',
    description: 'Confirm and send a previously prepared email. Use this after user confirms they want to send the email.',
    inputSchema: {
      type: 'object',
      properties: {
        confirmationId: { 
          type: 'string', 
          description: 'The confirmation ID from the prepare_email response' 
        },
        confirmed: { 
          type: 'boolean', 
          description: 'true to send the email, false to cancel' 
        }
      },
      required: ['confirmationId', 'confirmed']
    }
  },
  {
    name: 'search_emails',
    description: 'Search for emails in Gmail using Gmail search syntax (e.g., "from:user@example.com", "subject:meeting", "is:unread").',
    inputSchema: {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: 'Gmail search query (supports Gmail search operators like from:, to:, subject:, is:unread, etc.)' 
        },
        maxResults: { 
          type: 'number', 
          description: 'Maximum number of emails to return (default: 10)',
          default: 10
        }
      },
      required: ['query']
    }
  },
  // NEW INTERNET SEARCH TOOLS
  {
    name: 'search_internet',
    description: 'Search the internet for information. Returns web search results with titles, snippets, and links.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: 'Search query string' 
        },
        numResults: { 
          type: 'number', 
          description: 'Number of search results to return (default: 5)',
          default: 5
        }
      },
      required: ['query']
    }
  },
  {
    name: 'fetch_web_content',
    description: 'Fetch and extract text content from a specific URL. Useful for reading articles or web pages.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { 
          type: 'string', 
          description: 'Full URL to fetch (must include https:// or http://)' 
        },
        extractText: { 
          type: 'boolean', 
          description: 'Whether to extract plain text from HTML (default: true)',
          default: true
        }
      },
      required: ['url']
    }
  }
];

// Handle tools/list request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Tool handlers
const toolHandlers = {  
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

  // CALENDAR HANDLERS (with confirmation)
  prepare_calendar_event: async (args) => {
    console.error(`⚡ MCP: Preparing calendar event for user: ${args.user_id}`);
    const { user_id, ...eventData } = args;
    const result = await prepareCalendarEventTool({ 
      userId: user_id, 
      ...eventData 
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  confirm_create_calendar_event: async (args) => {
    console.error(`⚡ MCP: Confirming calendar event creation for user: ${args.user_id}`);
    const { user_id, ...confirmData } = args;
    const result = await confirmCreateCalendarEventTool({ 
      userId: user_id, 
      ...confirmData 
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

  prepare_update_calendar_event: async (args) => {
    console.error(`⚡ MCP: Preparing calendar event update for user: ${args.user_id}`);
    const { user_id, ...eventData } = args;
    const result = await prepareUpdateCalendarEventTool({ 
      userId: user_id, 
      ...eventData 
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  confirm_update_calendar_event: async (args) => {
    console.error(`⚡ MCP: Confirming calendar event update for user: ${args.user_id}`);
    const { user_id, ...confirmData } = args;
    const result = await confirmUpdateCalendarEventTool({ 
      userId: user_id, 
      ...confirmData 
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  prepare_delete_calendar_event: async (args) => {
    console.error(`⚡ MCP: Preparing calendar event deletion for user: ${args.user_id}`);
    const { user_id, ...eventData } = args;
    const result = await prepareDeleteCalendarEventTool({ 
      userId: user_id, 
      ...eventData 
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  confirm_delete_calendar_event: async (args) => {
    console.error(`⚡ MCP: Confirming calendar event deletion for user: ${args.user_id}`);
    const { user_id, ...confirmData } = args;
    const result = await confirmDeleteCalendarEventTool({ 
      userId: user_id, 
      ...confirmData 
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  // NEW EMAIL HANDLERS
  prepare_email: async (args) => {
    console.error(`⚡ MCP: Preparing email for user: ${args.user_id}`);
    const { user_id, ...emailData } = args;
    const result = await prepareEmailTool({ 
      userId: user_id, 
      ...emailData 
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  confirm_send_email: async (args) => {
    console.error(`⚡ MCP: Confirming email send for user: ${args.user_id}`);
    const { user_id, ...confirmData } = args;
    const result = await confirmSendEmailTool({ 
      userId: user_id, 
      ...confirmData 
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  search_emails: async (args) => {
    console.error(`⚡ MCP: Searching emails for user: ${args.user_id}`);
    const { user_id, ...searchData } = args;
    const result = await searchEmailsTool({ 
      userId: user_id, 
      ...searchData 
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  // NEW INTERNET SEARCH HANDLERS
  search_internet: async (args) => {
    console.error(`⚡ MCP: Searching internet for query: ${args.query}`);
    const result = await searchInternetTool(args);
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  fetch_web_content: async (args) => {
    console.error(`⚡ MCP: Fetching web content from: ${args.url}`);
    const result = await fetchWebContentTool(args);
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
  console.error('✅ MCP Server started successfully with email and search tools');
}

main().catch(error => {
  console.error('❌ Failed to start MCP server:', error);
  process.exit(1);
});
