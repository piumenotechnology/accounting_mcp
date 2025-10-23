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
    
    // Create stdio transport
    const transport = new StdioClientTransport({
      command: 'node',
      args: [mcpServerPath]
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