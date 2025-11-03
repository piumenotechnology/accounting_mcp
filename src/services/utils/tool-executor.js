// src/services/utils/tool-executor.js
/**
 * Tool Executor
 * Handles tool execution logic and result processing
 */

export class ToolExecutor {
  constructor(mcpClient) {
    this.mcpClient = mcpClient;
  }

  /**
   * Parse tool arguments safely
   */
  static parseArguments(argumentsString, toolName) {
    try {
      const argsString = argumentsString?.trim();
      
      if (!argsString || argsString === '') {
        console.log('⚠️ Empty arguments, using empty object');
        return {};
      }

      const parsed = JSON.parse(argsString);
      console.log('✅ Parsed arguments:', Object.keys(parsed).join(', '));
      return parsed;

    } catch (parseError) {
      console.error('❌ Failed to parse tool arguments:', parseError.message);
      console.error('   Raw arguments:', argumentsString);
      console.error('   Tool name:', toolName);
      console.log('⚠️ Using empty arguments object as fallback');
      return {};
    }
  }

  /**
   * Execute a tool call
   */
  async execute(toolCall) {
    const toolName = toolCall.function.name;
    
    console.log(`⚡ Calling tool: ${toolName}`);

    // Parse arguments
    const functionArgs = ToolExecutor.parseArguments(
      toolCall.function.arguments,
      toolName
    );

    // Execute tool via MCP
    const result = await this.mcpClient.callTool({
      name: toolName,
      arguments: functionArgs
    });

    // Log result preview
    this.logResultPreview(result);

    return result;
  }

  /**
   * Log safe preview of tool result
   */
  logResultPreview(toolResult) {
    try {
      const resultText = toolResult?.content?.[0]?.text || JSON.stringify(toolResult);
      const preview = resultText.substring(0, 200);
      console.log(`✅ Tool result:`, preview + (resultText.length > 200 ? '...' : ''));
    } catch (err) {
      console.log(`✅ Tool result received (preview failed):`, err.message);
    }
  }

  /**
   * Store structured tool result
   */
  static storeResult(toolResults, toolName, toolResult) {
    try {
      const resultText = toolResult?.content?.[0]?.text;
      if (resultText) {
        const parsedResult = JSON.parse(resultText);
        toolResults.push({
          tool: toolName,
          data: parsedResult
        });
        console.log(`📦 Stored result from ${toolName}`);
      }
    } catch (parseErr) {
      console.log('⚠️ Could not parse tool result for structured data');
    }
    return toolResults;
  }
}