import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MCPClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }
  
  async connect() {
    if (this.isConnected) return;
    
    console.log('🔌 Connecting to MCP server...');
    
    // Path to MCP server
    const mcpServerPath = join(__dirname, '../mcp-server/index.js');
    
    // ⭐ Pass environment variables to MCP server
    const transport = new StdioClientTransport({
      command: 'node',
      args: [mcpServerPath],
      env: {
        ...process.env,
        ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
        POSTGRES_URL: process.env.POSTGRES_URL,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        GOOGLE_WEB_CLIENT_ID: process.env.GOOGLE_WEB_CLIENT_ID,
        GOOGLE_WEB_CLIENT_SECRET: process.env.GOOGLE_WEB_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
        NODE_ENV: process.env.NODE_ENV
      }
    });
    
    // Create client
    this.client = new Client({
      name: 'backend-client',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });
    
    // Connect
    await this.client.connect(transport);
    this.isConnected = true;
    
    console.log('✅ MCP client connected');
  }
  
  async listTools() {
    if (!this.isConnected) await this.connect();
    
    const tools = await this.client.listTools();
    return tools;
  }
  
  async callTool({ name, arguments: args }) {
    if (!this.isConnected) await this.connect();
    
    const result = await this.client.callTool({
      name: name,
      arguments: args
    });
    
    return result;
  }
  
  async close() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
    }
  }
}

export default MCPClient;