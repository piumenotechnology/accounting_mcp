// src/mcp-server/tools/enhanced-dynamic-query.tool.js
import { pool } from '../../config/db.js';

/**
 * ✅ STEP 1: List available data sources (schemas) for the user
 */
export async function getUserSchemasTool({ userId }) {
  const client = await pool.connect();
  
  try {
    console.error(`🔍 Fetching schemas for user: ${userId}`);
    
    const result = await client.query(
      'SELECT * FROM get_user_schemas($1)',
      [userId]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return {
        success: false,
        schemas: [],
        message: 'No data sources available for this user'
      };
    }
    
    console.error(`✅ Found ${result.rows.length} schemas for user ${userId}`);
    
    return {
      success: true,
      schemas: result.rows.map(row => ({
        schema_name: row.schema_name,
        description: row.description || 'No description available',
        has_custom_config: row.has_custom_config || false
      })),
      message: `Found ${result.rows.length} data source(s)`
    };
    
  } catch (error) {
    console.error('❌ Error fetching user schemas:', error);
    return {
      success: false,
      error: error.message,
      schemas: []
    };
  } finally {
    client.release();
  }
}

/**
 * ✅ STEP 2: Verify schema access and get structure
 */
export async function getEnhancedSchemaStructureTool({ userId, schemaName }) {
  const client = await pool.connect();
  
  try {
    console.error(`🔐 Checking access: user ${userId} → schema ${schemaName}`);
    
    // ⭐ CRITICAL: Verify user has access to this schema
    const accessCheck = await client.query(
      'SELECT user_has_schema_access($1, $2) as has_access',
      [userId, schemaName]
    );
    
    const hasAccess = accessCheck.rows[0]?.has_access;
    
    if (!hasAccess) {
      console.error(`❌ ACCESS DENIED: User ${userId} cannot access schema ${schemaName}`);
      return {
        success: false,
        error: 'ACCESS_DENIED',
        message: `You don't have permission to access the data source: ${schemaName}`,
        has_access: false
      };
    }
    
    console.error(`✅ Access granted: ${userId} → ${schemaName}`);
    
    // Fetch schema structure
    const structureResult = await client.query(
      'SELECT * FROM get_schema_structure($1, $2)',
      [userId, schemaName]
    );
    
    if (!structureResult.rows || structureResult.rows.length === 0) {
      return {
        success: false,
        error: 'SCHEMA_NOT_FOUND',
        message: `Schema ${schemaName} not found or has no tables`,
        has_access: true
      };
    }
    
    // Check if schema has custom configuration
    const configCheck = await client.query(
      `SELECT EXISTS(
        SELECT 1 FROM data_source_configs 
        WHERE schema_name = $1
      ) as has_config`,
      [schemaName]
    );
    
    const hasCustomConfig = configCheck.rows[0]?.has_config || false;
    let customInstructions = null;
    
    if (hasCustomConfig) {
      console.error(`📋 Schema ${schemaName} has custom configuration`);
      
      const configResult = await client.query(
        `SELECT custom_instructions, query_patterns 
         FROM data_source_configs 
         WHERE schema_name = $1`,
        [schemaName]
      );
      
      if (configResult.rows.length > 0) {
        customInstructions = {
          instructions: configResult.rows[0].custom_instructions,
          query_patterns: configResult.rows[0].query_patterns
        };
      }
    }
    
    // Process and return structure
    const tables = {};
    structureResult.rows.forEach(row => {
      if (!tables[row.table_name]) {
        tables[row.table_name] = {
          table_name: row.table_name,
          columns: []
        };
      }
      
      tables[row.table_name].columns.push({
        column_name: row.column_name,
        data_type: row.data_type,
        is_nullable: row.is_nullable === 'YES',
        sample_values: row.sample_values
      });
    });
    
    return {
      success: true,
      has_access: true,
      schema_name: schemaName,
      has_custom_config: hasCustomConfig,
      custom_instructions: customInstructions,
      tables: Object.values(tables),
      message: `Schema structure loaded with ${Object.keys(tables).length} table(s)${hasCustomConfig ? ' (custom config available)' : ''}`
    };
    
  } catch (error) {
    console.error('❌ Error in getEnhancedSchemaStructureTool:', error);
    return {
      success: false,
      error: error.message,
      has_access: false
    };
  } finally {
    client.release();
  }
}

/**
 * ✅ STEP 3: Execute SQL query with access verification
 */
export async function executeSQLQueryTool({ userId, schemaName, sqlQuery }) {
  const client = await pool.connect();
  
  try {
    console.error(`🔐 Verifying access before query: ${userId} → ${schemaName}`);
    
    // ⭐ CRITICAL: Verify access before executing ANY query
    const accessCheck = await client.query(
      'SELECT user_has_schema_access($1, $2) as has_access',
      [userId, schemaName]
    );
    
    const hasAccess = accessCheck.rows[0]?.has_access;
    
    if (!hasAccess) {
      console.error(`❌ ACCESS DENIED: User ${userId} cannot query schema ${schemaName}`);
      return {
        success: false,
        error: 'ACCESS_DENIED',
        message: `You don't have permission to query this data source: ${schemaName}`,
        has_access: false
      };
    }
    
    console.error(`✅ Access verified. Executing query on ${schemaName}`);
    console.error(`📝 Query: ${sqlQuery.substring(0, 100)}...`);
    
    // Set search path to user's schema
    await client.query(`SET search_path TO ${schemaName}, public`);
    
    // Execute the query
    const result = await client.query(sqlQuery);
    
    console.error(`✅ Query executed successfully. Rows: ${result.rows.length}`);
    
    return {
      success: true,
      has_access: true,
      schema_name: schemaName,
      rows: result.rows,
      row_count: result.rows.length,
      columns: result.fields.map(f => f.name)
    };
    
  } catch (error) {
    console.error('❌ Error executing SQL query:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to execute query. Please check your SQL syntax.',
      has_access: true // Access was verified, but query failed
    };
  } finally {
    // Reset search path
    await client.query('RESET search_path');
    client.release();
  }
}

/**
 * ✅ OPTIONAL: Quick analytics with access verification
 */
export async function getQuickAnalyticsTool({ userId, schemaName, metric }) {
  const client = await pool.connect();
  
  try {
    // ⭐ CRITICAL: Verify access first
    const accessCheck = await client.query(
      'SELECT user_has_schema_access($1, $2) as has_access',
      [userId, schemaName]
    );
    
    const hasAccess = accessCheck.rows[0]?.has_access;
    
    if (!hasAccess) {
      return {
        success: false,
        error: 'ACCESS_DENIED',
        message: `You don't have permission to access: ${schemaName}`,
        has_access: false
      };
    }
    
    console.error(`✅ Running analytics: ${metric} on ${schemaName}`);
    
    // Set search path
    await client.query(`SET search_path TO ${schemaName}, public`);
    
    // Execute predefined analytics based on metric type
    let query;
    switch (metric) {
      case 'total_revenue':
        query = 'SELECT SUM(total) as total_revenue FROM invoices';
        break;
      case 'total_expenses':
        query = 'SELECT SUM(total) as total_expenses FROM bills';
        break;
      case 'customer_count':
        query = 'SELECT COUNT(*) as customer_count FROM contacts WHERE is_customer = true';
        break;
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
    
    const result = await client.query(query);
    
    return {
      success: true,
      has_access: true,
      schema_name: schemaName,
      metric: metric,
      result: result.rows[0]
    };
    
  } catch (error) {
    console.error('❌ Error in analytics:', error);
    return {
      success: false,
      error: error.message,
      has_access: true
    };
  } finally {
    await client.query('RESET search_path');
    client.release();
  }
}