// src/mcp-server/index.js
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
import { 
  getUserSchemasTool,
  getSchemaStructureTool,
  executeDynamicQueryTool,
  getQuickAnalyticsTool
} from './tools/dynamic-query.tool.js';

// ⭐ NEW: Import Google Maps
import { googleMapsTools } from './tools/maps.tools.js';
import { googleMapsHandlers } from './handlers/maps.handlers.js';

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
  // Existing tools
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

  {
    name: 'list_data_sources',
    description: 'List all data sources (companies/clients) the user has access to via referral tokens. Use this to see which companies\' financial data the user can query.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  // {
  //   name: 'query_profit_loss',
  //   description: 'Query profit and loss (P&L) data for a specific company. Shows revenue, expenses, and profit over time. Use this when user asks about revenue, sales, expenses, or profit.',
  //   inputSchema: {
  //     type: 'object',
  //     properties: {
  //       schema_name: {
  //         type: 'string',
  //         description: 'The schema name of the company to query (get from list_data_sources first)'
  //       },
  //       start_date: {
  //         type: 'string',
  //         description: 'Start date in YYYY-MM-DD format (optional, defaults to last 12 months)'
  //       },
  //       end_date: {
  //         type: 'string',
  //         description: 'End date in YYYY-MM-DD format (optional, defaults to today)'
  //       }
  //     },
  //     required: ['schema_name']
  //   }
  // },
  // {
  //   name: 'query_balance_sheet',
  //   description: 'Query balance sheet (BS) data for a specific company. Shows assets, liabilities, and equity over time. Use this when user asks about assets, liabilities, equity, or financial position.',
  //   inputSchema: {
  //     type: 'object',
  //     properties: {
  //       schema_name: {
  //         type: 'string',
  //         description: 'The schema name of the company to query (get from list_data_sources first)'
  //       },
  //       start_date: {
  //         type: 'string',
  //         description: 'Start date in YYYY-MM-DD format (optional)'
  //       },
  //       end_date: {
  //         type: 'string',
  //         description: 'End date in YYYY-MM-DD format (optional)'
  //       }
  //     },
  //     required: ['schema_name']
  //   }
  // },
  // {
  //   name: 'use_referral_token',
  //   description: 'Activate a referral code to gain access to a company\'s financial data. Use this when user provides a new referral code.',
  //   inputSchema: {
  //     type: 'object',
  //     properties: {
  //       referral_code: {
  //         type: 'string',
  //         description: 'The referral code provided by the user'
  //       }
  //     },
  //     required: ['referral_code']
  //   }
  // },

  {
    name: 'get_schema_structure',
    description: 'Discover what tables and columns exist in a client\'s schema. Use this FIRST when user asks about their data and you don\'t know the structure. Returns table names, column names, data types, and sample data.',
    inputSchema: {
      type: 'object',
      properties: {
        schema_name: {
          type: 'string',
          description: 'Schema name from list_data_sources'
        }
      },
      required: ['schema_name']
    }
  },
  {
    name: 'execute_sql_query',
    description: 'Execute a custom SQL SELECT query on client data. Use this after discovering schema structure. ONLY SELECT statements allowed. Automatically uses the correct schema.',
    inputSchema: {
      type: 'object',
      properties: {
        schema_name: {
          type: 'string',
          description: 'Schema name from list_data_sources'
        },
        sql: {
          type: 'string',
          description: 'SQL SELECT query (without schema prefix). Example: "SELECT * FROM pl_xero WHERE date >= \'2025-01-01\' LIMIT 10"'
        },
        params: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional parameters for parameterized queries (use $1, $2, etc.)'
        }
      },
      required: ['schema_name', 'sql']
    }
  },
  {
    name: 'get_quick_analytics',
    description: 'Get quick aggregated analytics from a table. Simplifies common queries like sums, counts, averages grouped by category. Use for "total revenue by category", "count by type", etc.',
    inputSchema: {
      type: 'object',
      properties: {
        schema_name: {
          type: 'string',
          description: 'Schema name from list_data_sources'
        },
        table_name: {
          type: 'string',
          description: 'Table to query (e.g., pl_xero, bank_transaction)'
        },
        metric: {
          type: 'string',
          description: 'What to calculate: "SUM(amount)", "COUNT(*)", "AVG(amount)", etc.'
        },
        group_by: {
          type: 'string',
          description: 'Column to group by (e.g., "category", "type", "contact_name")'
        },
        start_date: {
          type: 'string',
          description: 'Start date YYYY-MM-DD (optional)'
        },
        end_date: {
          type: 'string',
          description: 'End date YYYY-MM-DD (optional)'
        }
      },
      required: ['schema_name', 'table_name', 'metric']
    }
  },
  ...googleMapsTools
];

// Handle tools/list request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Tool handlers
const toolHandlers = {
  // Existing handlers
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

  list_data_sources: async (args) => {
    const { user_id } = args;
    console.error(`⚡ MCP: Listing data sources for user: ${user_id}`);
    const result = await getUserSchemasTool({ userId: user_id });
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  get_schema_structure: async (args) => {
    const { user_id, schema_name } = args;
    console.error(`⚡ MCP: Getting schema structure for ${schema_name}`);
    
    const result = await getSchemaStructureTool({
      userId: user_id,
      schemaName: schema_name
    });
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  execute_sql_query: async (args) => {
    const { user_id, schema_name, sql, params } = args;
    console.error(`⚡ MCP: Executing SQL on ${schema_name}: ${sql.substring(0, 100)}...`);
    
    const result = await executeDynamicQueryTool({
      userId: user_id,
      schemaName: schema_name,
      sql,
      params
    });
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  get_quick_analytics: async (args) => {
    const { user_id, schema_name, table_name, metric, group_by, start_date, end_date } = args;
    console.error(`⚡ MCP: Quick analytics on ${schema_name}.${table_name}`);
    
    const result = await getQuickAnalyticsTool({
      userId: user_id,
      schemaName: schema_name,
      tableName: table_name,
      metric,
      groupBy: group_by,
      startDate: start_date,
      endDate: end_date
    });
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  },

  // ⭐ NEW: Add Google Maps handlers
  ...googleMapsHandlers
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
  console.error('✅ MCP Server started with Google Maps tools');
}

main().catch(error => {
  console.error('❌ Failed to start MCP server:', error);
  process.exit(1);
});