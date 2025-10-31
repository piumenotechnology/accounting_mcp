// tools/dynamic-query.tool.js

import { pool } from '../../config/db.js';
export async function getUserSchemasTool({ userId }) {
  try {
    const result = await pool.query(
      'SELECT * FROM get_user_schemas($1)',
      [userId]
    );
    
    return {
      success: true,
      schemas: result.rows
    };
  } catch (error) {
    console.error('Error getting user schemas:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Get schema structure (tables and columns)
export async function getSchemaStructureTool({ userId, schemaName }) {
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
      
      // Get sample data to understand the table better
      const sampleResult = await client.query(
        `SELECT * FROM ${schemaName}.${table.table_name} LIMIT 10`
      );
      
      structure[table.table_name] = {
        comment: table.table_comment,
        columns: columnsResult.rows,
        sample_data: sampleResult.rows
      };
    }
    
    return {
      success: true,
      schema_name: schemaName,
      structure: structure
    };
    
  } catch (error) {
    console.error('Error getting schema structure:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    client.release();
  }
}

// Execute dynamic query
export async function executeDynamicQueryTool({ userId, schemaName, sql, params = [] }) {
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
    
    // Security: Only allow SELECT statements
    const sqlUpper = sql.trim().toUpperCase();
    if (!sqlUpper.startsWith('SELECT')) {
      return {
        success: false,
        error: 'Only SELECT queries are allowed for security reasons'
      };
    }
    
    // Check for dangerous keywords
    const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE'];
    for (const keyword of dangerousKeywords) {
      if (sqlUpper.includes(keyword)) {
        return {
          success: false,
          error: `Query contains prohibited keyword: ${keyword}`
        };
      }
    }
    
    // Set search path
    await client.query(`SET search_path TO ${schemaName}, public`);
    
    // Execute query
    const result = await client.query(sql, params);
    
    return {
      success: true,
      schema_name: schemaName,
      data: result.rows,
      row_count: result.rowCount,
      columns: result.fields.map(f => ({
        name: f.name,
        type: f.dataTypeID
      }))
    };
    
  } catch (error) {
    console.error('Error executing dynamic query:', error);
    return {
      success: false,
      error: error.message,
      hint: error.hint
    };
  } finally {
    client.release();
  }
}

// Quick analytics helper
export async function getQuickAnalyticsTool({ userId, schemaName, tableName, metric, groupBy, startDate, endDate }) {
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
    
    await client.query(`SET search_path TO ${schemaName}, public`);
    
    // Build query dynamically
    let query = `SELECT `;
    
    if (groupBy) {
      query += `${groupBy}, `;
    }
    
    // Add metric aggregation
    if (metric.toLowerCase().includes('sum')) {
      const field = metric.replace(/sum\(/i, '').replace(')', '').trim();
      query += `SUM(${field}) as total`;
    } else if (metric.toLowerCase().includes('count')) {
      query += `COUNT(*) as count`;
    } else if (metric.toLowerCase().includes('avg')) {
      const field = metric.replace(/avg\(/i, '').replace(')', '').trim();
      query += `AVG(${field}) as average`;
    } else {
      query += `${metric}`;
    }
    
    query += ` FROM ${tableName}`;
    
    // Add date filter if exists
    const params = [];
    let paramCount = 1;
    
    if (startDate || endDate) {
      query += ` WHERE 1=1`;
      
      if (startDate) {
        query += ` AND date >= $${paramCount}`;
        params.push(startDate);
        paramCount++;
      }
      
      if (endDate) {
        query += ` AND date <= $${paramCount}`;
        params.push(endDate);
        paramCount++;
      }
    }
    
    if (groupBy) {
      query += ` GROUP BY ${groupBy}`;
      query += ` ORDER BY total DESC`;
    }
    
    query += ` LIMIT 1000`;
    
    const result = await client.query(query, params);
    
    return {
      success: true,
      schema_name: schemaName,
      table_name: tableName,
      data: result.rows,
      row_count: result.rowCount,
      query_used: query
    };
    
  } catch (error) {
    console.error('Error executing quick analytics:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    client.release();
  }
}