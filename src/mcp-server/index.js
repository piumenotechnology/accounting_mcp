// src/mcp-server/index.js - SECURE VERSION WITH ACCESS CONTROL
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Existing imports
import { weatherTool } from './tools/weather.tool.js';
import { 
  createCalendarEventTool, 
  listCalendarEventsTool,
  updateCalendarEventTool,
  deleteCalendarEventTool,
  checkGoogleConnectionTool
} from './tools/calendar.tool.js';
import { searchContactTool } from './tools/contact.tool.js';
import { sendEmailTool } from './tools/email.tool.js';

// Google Maps
import { googleMapsTools } from './tools/maps.tools.js';
import { googleMapsHandlers } from './handlers/maps.handlers.js';

// Database tool
import { executeQueryTool } from './tools/database.tool.js';

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
    name: 'weather',
    description: 'Get the current weather for a given location. Can use user location if no location specified.',
    inputSchema: {
      type: 'object',
      properties: {
        location: { 
          type: 'string', 
          description: 'Location to get the weather for (e.g., "Bali", "London"). Optional if user_location is provided.' 
        }
      }
    }
  },
  {
    name: 'search_contact',
    description: 'Search for a contact email address by searching through Gmail history. Finds people the user has emailed with. Use this when you need to find someone\'s email address.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { 
          type: 'string', 
          description: 'Name of person to search for (e.g., "fitrah", "john smith", "geri")'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'send_email',
    description: 'Send an email via Gmail. Use search_contact tool first to find recipient email addresses by name. Emails are sent immediately.',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recipient email addresses. Use search_contact first if you only have names.'
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        body: {
          type: 'string',
          description: 'Email body content. Write professional, clear, and context-appropriate content.'
        },
        cc: {
          type: 'array',
          items: { type: 'string' },
          description: 'CC recipient email addresses (optional)'
        },
        bcc: {
          type: 'array',
          items: { type: 'string' },
          description: 'BCC recipient email addresses (optional)'
        },
        html: {
          type: 'boolean',
          description: 'Whether body content is HTML formatted (optional, default: false)',
          default: false
        },
        replyTo: {
          type: 'string',
          description: 'Gmail message ID to reply to for threading (optional)'
        }
      },
      required: ['to', 'subject', 'body']
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
    name: 'create_calendar_event',
    description: 'Create a new event in Google Calendar. Use the detected timezone from system context.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Event title/summary' },
        description: { type: 'string', description: 'Event description (optional)' },
        startDateTime: { 
          type: 'string', 
          description: 'Start date and time in ISO 8601 format (e.g., 2025-10-29T14:00:00)' 
        },
        endDateTime: { 
          type: 'string', 
          description: 'End date and time in ISO 8601 format (e.g., 2025-10-29T15:00:00)' 
        },
        timeZone: { 
          type: 'string', 
          description: 'Time zone (use the timezone from system message)',
          default: 'Asia/Makassar'
        },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of attendee email addresses (optional). Use search_contact tool first if you need to find email addresses by name.'
        }
      },
      required: ['summary', 'startDateTime', 'endDateTime']
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
          default: 10
        },
        timeMin: { 
          type: 'string', 
          description: 'Lower bound for event start time (ISO 8601 format)'
        }
      }
    }
  },
  {
    name: 'update_calendar_event',
    description: 'Update an existing Google Calendar event.',
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
    name: 'delete_calendar_event',
    description: 'Delete a Google Calendar event.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID to delete' }
      },
      required: ['eventId']
    }
  },
  // Database query execution tool
  {
    name: 'execute_query',
    description: 'Execute a SELECT query on a database schema. Schema structure is provided in the system message.',
    inputSchema: {
      type: 'object',
      properties: {
        schema_name: { 
          type: 'string', 
          description: 'Schema name (from system message)' 
        },
        query: { 
          type: 'string', 
          description: 'SELECT query to execute' 
        },
        params: {
          type: 'array',
          items: { type: 'string' },
          description: 'Query parameters for $1, $2, etc.',
          default: []
        }
      },
      required: ['schema_name', 'query']
    }
  },

  //seacrh
  {
    name: 'web_search',
    description: 'Search the internet for text results and images. Returns web pages with descriptions and relevant images. Use this for general knowledge questions, current events, factual information, or when user asks to "search" or "look up" something.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "latest AI trends", "how to make pasta", "Eiffel Tower")'
        },
        search_type: {
          type: 'string',
          enum: ['general', 'text', 'images'],
          description: 'Type of search: "general" (text + images), "text" (only text), "images" (only images)',
          default: 'general'
        },
        count: {
          type: 'number',
          description: 'Number of results to return (1-20)',
          default: 5,
          minimum: 1,
          maximum: 20
        }
      },
      required: ['query']
    }
  },
  {
    name: 'news_search',
    description: 'Search for recent news articles. Use this when user asks about current events, breaking news, or recent happenings.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'News search query (e.g., "latest tech news", "climate change updates")'
        },
        count: {
          type: 'number',
          description: 'Number of articles to return (1-20)',
          default: 5,
          minimum: 1,
          maximum: 20
        },
        freshness: {
          type: 'string',
          enum: ['pd', 'pw', 'pm'],
          description: 'Time range: "pd" (past day), "pw" (past week), "pm" (past month)',
          default: 'pw'
        }
      },
      required: ['query']
    }
  },
  // {
  //   name: 'video_search',
  //   description: 'Search for videos from YouTube and other platforms. Use when user wants to find tutorials, entertainment, or video content.',
  //   inputSchema: {
  //     type: 'object',
  //     properties: {
  //       query: {
  //         type: 'string',
  //         description: 'Video search query (e.g., "how to cook steak", "funny cat videos")'
  //       },
  //       count: {
  //         type: 'number',
  //         description: 'Number of videos to return (1-20)',
  //         default: 5,
  //         minimum: 1,
  //         maximum: 20
  //       }
  //     },
  //     required: ['query']
  //   }
  // },
  
  ...googleMapsTools
];

// Handle tools/list request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Tool handlers
const toolHandlers = {
  weather: async (args) => {
    const { location, user_location } = args;
    
    if (user_location) {
      console.error(`⚡ MCP: Executing weather tool with user location: ${user_location.lat}, ${user_location.lng}`);
    } else if (location) {
      console.error(`⚡ MCP: Executing weather tool for location: ${location}`);
    } else {
      console.error(`⚡ MCP: Executing weather tool without location`);
    }
    
    const result = await weatherTool({ location, user_location });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  search_contact: async (args) => {
    const { name, user_id } = args;
    console.error(`⚡ MCP: Searching contact "${name}" for user: ${user_id}`);
    
    const result = await searchContactTool({ 
      userId: user_id, 
      name 
    });
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  send_email: async (args) => {
    const { user_id, to, subject, body, cc, bcc, html, replyTo } = args;
    console.error(`⚡ MCP: Sending email for user: ${user_id}`);
    console.error(`   To: ${to?.join(', ')}`);
    console.error(`   Subject: ${subject}`);
    
    const result = await sendEmailTool({
      userId: user_id,
      to,
      subject,
      body,
      cc,
      bcc,
      html,
      replyTo
    });
    
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
    const { user_id, user_location, ...eventData } = args;
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
    const { user_id, user_location, ...queryData } = args;
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
    const { user_id, user_location, ...eventData } = args;
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
    const { user_id, user_location, ...eventData } = args;
    const result = await deleteCalendarEventTool({ 
      userId: user_id, 
      ...eventData 
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  execute_query: async (args) => {
    const { user_id, schema_name, query, params = [] } = args;
    console.error(`⚡ MCP: Executing query on ${schema_name} for user: ${user_id}`);
    
    const result = await executeQueryTool({
      userId: user_id,
      schema_name,
      query,
      params
    });
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  web_search: async (args) => {
    const { query, search_type = 'general', count = 5 } = args;
    console.error(`⚡ MCP: Web search for: "${query}" (type: ${search_type})`);
    
    const result = await webSearchTool({ query, search_type, count });
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  news_search: async (args) => {
    const { query, count = 5, freshness = 'pw' } = args;
    console.error(`⚡ MCP: News search for: "${query}"`);
    
    const result = await newsSearchTool({ query, count, freshness });
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  // video_search: async (args) => {
  //   const { query, count = 5 } = args;
  //   console.error(`⚡ MCP: Video search for: "${query}"`);
    
  //   const result = await videoSearchTool({ query, count });
    
  //   return {
  //     content: [{ type: 'text', text: JSON.stringify(result) }]
  //   };
  // },
  
  ...googleMapsHandlers
};

// Handle tools/call request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

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
  console.error('✅ MCP Server started with SECURE database access control');
}

main().catch(error => {
  console.error('❌ Failed to start MCP server:', error);
  process.exit(1);
});