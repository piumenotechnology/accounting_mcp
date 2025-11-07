// src/mcp-server/tools/query-validator.js

export class QueryValidator {
  
  static validate(query) {
    const normalized = query.trim().toUpperCase();
    
    // 1. Must be SELECT only
    if (!normalized.startsWith('SELECT')) {
      throw new Error('Only SELECT queries allowed');
    }
    
    // 2. Block dangerous keywords
    const forbidden = [
      'DROP', 'DELETE', 'INSERT', 'UPDATE', 'TRUNCATE', 
      'ALTER', 'CREATE', 'GRANT', 'REVOKE', 'EXECUTE',
      'INTO OUTFILE', 'LOAD_FILE', 'EXEC'
    ];
    
    for (const keyword of forbidden) {
      if (normalized.includes(keyword)) {
        throw new Error(`Forbidden keyword: ${keyword}`);
      }
    }
    
    // 3. Block multiple statements
    const statements = query.split(';').filter(s => s.trim());
    if (statements.length > 1) {
      throw new Error('Multiple statements not allowed');
    }
    
    return true;
  }
  
  static addSafetyLimits(query, maxRows = 1000) {
    // ✅ FIX: Remove trailing semicolon before adding LIMIT
    let cleanQuery = query.trim();
    if (cleanQuery.endsWith(';')) {
      cleanQuery = cleanQuery.slice(0, -1).trim();
    }
    
    // Add LIMIT if not present
    if (!cleanQuery.toUpperCase().includes('LIMIT')) {
      cleanQuery += ` LIMIT ${maxRows}`;
    }
    
    return cleanQuery;
  }
}