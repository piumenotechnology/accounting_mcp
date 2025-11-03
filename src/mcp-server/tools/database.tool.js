// NEW FILE: src/mcp-server/tools/database.tool.js

import {pool as db} from '../../config/db.js';
import { QueryValidator } from './query-validator.js';

export async function executeQueryTool({ userId, schema_name, query, params = [] }) {
  // 1. Check access
  const accessCheck = await db.query(
    'SELECT user_has_schema_access($1, $2) as has_access',
    [userId, schema_name]
  );
  
  if (!accessCheck.rows[0].has_access) {
    throw new Error(`Access denied to schema: ${schema_name}`);
  }
  
  // 2. Validate query
  try {
    QueryValidator.validate(query);
  } catch (error) {
    return {
      error: error.message,
      query: query
    };
  }
  
  // 3. Add safety limits
  const safeQuery = QueryValidator.addSafetyLimits(query);
  
  // 4. Execute with schema isolation
  const client = await db.connect();
  
  try {
    await client.query('BEGIN READ ONLY');
    await client.query(`SET search_path TO ${schema_name}, public`);
    
    const startTime = Date.now();
    const result = await client.query(safeQuery, params);
    const executionTime = Date.now() - startTime;
    
    await client.query('COMMIT');
    
    return {
      schema_name,
      query: safeQuery,
      rows: result.rows,
      rowCount: result.rowCount,
      executionTime: `${executionTime}ms`
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    return {
      error: error.message,
      query: safeQuery,
      hint: 'Check your SQL syntax and table/column names'
    };
  } finally {
    client.release();
  }
}