// src/mcp-server/tools/enhanced-dynamic-query.tool.js
import { pool } from '../../config/db.js';
import { getSchemaConfig, hasCustomConfig } from '../../config/schema-configs.js';

/**
 * Enhanced version that includes schema-specific instructions
 */
export async function getEnhancedSchemaStructureTool({ userId, schemaName }) {
  const client = await pool.connect();
  
  try {
    // Check access
    const accessCheck = await client.query(
      'SELECT user_has_schema_access($1, $2) as has_access',
      [userId, schemaName]
    );
    
    if (!accessCheck.rows[0].has_access) {
      return {
        success: false,
        error: 'You do not have access to this data source'
      };
    }
    
    // Get schema configuration (if exists)
    const schemaConfig = getSchemaConfig(schemaName);
    const hasCustom = hasCustomConfig(schemaName);
    
    // Get all tables in the schema
    const tablesResult = await client.query(`
      SELECT 
        table_name,
        obj_description((quote_ident($1) || '.' || quote_ident(table_name))::regclass) as table_comment
      FROM information_schema.tables
      WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `, [schemaName]);
    
    // Get columns for each table
    const structure = {};
    
    for (const table of tablesResult.rows) {
      const columnsResult = await client.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = $1
        AND table_name = $2
        ORDER BY ordinal_position
      `, [schemaName, table.table_name]);
      
      // Get sample data
      const sampleResult = await client.query(
        `SELECT * FROM ${schemaName}.${table.table_name} LIMIT 10`
      );
      
      structure[table.table_name] = {
        comment: table.table_comment,
        columns: columnsResult.rows,
        sample_data: sampleResult.rows
      };
    }
    
    // Build response with custom instructions if available
    const response = {
      success: true,
      schema_name: schemaName,
      display_name: schemaConfig.displayName,
      source: schemaConfig.source,
      has_custom_config: hasCustom,
      structure: structure
    };
    
    // Add custom instructions if available
    if (hasCustom) {
      response.custom_instructions = schemaConfig.customInstructions;
      response.available_patterns = Object.keys(schemaConfig.queryPatterns || {});
      response.message = `⭐ This schema has CUSTOM CONFIGURATION. Review custom_instructions carefully for:
• Pre-built query patterns
• Important table relationships
• Business rules
• Data quality notes

Use the provided query patterns as templates for common requests.`;
    } else {
      response.message = `ℹ️ This is a generic schema. Discover structure from tables and sample data.`;
    }
    
    return response;
    
  } catch (error) {
    console.error('Error getting enhanced schema structure:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    client.release();
  }
}

/**
 * Get a specific query pattern for a schema
 */
export async function getQueryPatternTool({ userId, schemaName, patternName }) {
  try {
    // Check access
    const accessCheck = await pool.query(
      'SELECT user_has_schema_access($1, $2) as has_access',
      [userId, schemaName]
    );
    
    if (!accessCheck.rows[0].has_access) {
      return {
        success: false,
        error: 'You do not have access to this data source'
      };
    }
    
    const schemaConfig = getSchemaConfig(schemaName);
    const pattern = schemaConfig.queryPatterns[patternName];
    
    if (!pattern) {
      return {
        success: false,
        error: `Pattern '${patternName}' not found for schema '${schemaName}'`,
        available_patterns: Object.keys(schemaConfig.queryPatterns || {})
      };
    }
    
    return {
      success: true,
      schema_name: schemaName,
      pattern_name: patternName,
      sql: pattern.trim(),
      message: `Use this as a template. Modify date filters, limits, or add WHERE clauses as needed.`
    };
    
  } catch (error) {
    console.error('Error getting query pattern:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * List all available query patterns for a schema
 */
export async function listQueryPatternsTool({ userId, schemaName }) {
  try {
    // Check access
    const accessCheck = await pool.query(
      'SELECT user_has_schema_access($1, $2) as has_access',
      [userId, schemaName]
    );
    
    if (!accessCheck.rows[0].has_access) {
      return {
        success: false,
        error: 'You do not have access to this data source'
      };
    }
    
    const schemaConfig = getSchemaConfig(schemaName);
    const hasCustom = hasCustomConfig(schemaName);
    
    if (!hasCustom) {
      return {
        success: true,
        schema_name: schemaName,
        has_patterns: false,
        message: 'This schema does not have pre-configured query patterns. Use get_schema_structure to discover tables and write custom queries.'
      };
    }
    
    const patterns = Object.keys(schemaConfig.queryPatterns || {});
    
    return {
      success: true,
      schema_name: schemaName,
      display_name: schemaConfig.displayName,
      has_patterns: true,
      available_patterns: patterns,
      message: `This schema has ${patterns.length} pre-configured query patterns. Use get_query_pattern to get the SQL for any pattern.`,
      examples: patterns.slice(0, 3)
    };
    
  } catch (error) {
    console.error('Error listing query patterns:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Re-export existing tools
export { 
  getUserSchemasTool,
  executeDynamicQueryTool,
  getQuickAnalyticsTool
} from './dynamic-query.tool.js';