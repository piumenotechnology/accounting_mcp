// src/services/database.service.js
import {pool} from '../config/db.js'

export class DatabaseService {
  constructor() {
    this.pool = pool;
    this.schemaCache = new Map();
    this.rulesCache = new Map();
    this.cacheTTL = 5 * 60 * 1000;
    
    // this.testConnection();
  }

  // async testConnection() {
  //   try {
  //     const result = await this.pool.query('SELECT NOW() as current_time, current_database() as database');
  //     console.log('✅ Database connection successful');
  //     console.log(`   Database: ${result.rows[0].database}`);
  //     return true;
  //   } catch (error) {
  //     console.error('❌ Database connection failed:', error.message);
  //     throw error;
  //   }
  // }

  getFromCache(key) {
    const cached = this.schemaCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    if (cached) this.schemaCache.delete(key);
    return null;
  }

  cache(key, data) {
    this.schemaCache.set(key, { data, timestamp: Date.now() });
  }

  async getUserSchema(userId) {
    try {
      const result = await this.pool.query(`
        SELECT rt.schema_name, rt.referral, rt.client_name, rt.id
        FROM public.referral_token_usages rtu
        JOIN public.referral_tokens rt ON rtu.referral_token_id = rt.id
        WHERE rtu.user_id = $1 AND rt.is_active = true
        LIMIT 1
      `, [userId]);

      if (result.rows.length === 0) {
        throw new Error(`User ${userId} not assigned to any schema. Please add user to referral_token_usages table.`);
      }

      return result.rows[0];
    } catch (error) {
      // console.error(`❌ Error getting schema for user ${userId}:`, error.message);
      throw error;
    }
  }

  async getCompleteSchemaInfo(userId) {
    try {
      const userSchema = await this.getUserSchema(userId);
      const schemaName = userSchema.schema_name;
      const referral = userSchema.referral;

      const cacheKey = `schema:${userId}:${schemaName}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        // console.log(`📦 Using cached schema for ${schemaName}`);
        return cached;
      }

      console.log(`🔍 Fetching schema info for ${schemaName}...`);

      const schemaResult = await this.pool.query(`
        SELECT 
          t.table_name,
          json_agg(
            json_build_object(
              'name', c.column_name,
              'type', c.data_type
            ) ORDER BY c.ordinal_position
          ) as columns
        FROM information_schema.tables t
        JOIN information_schema.columns c 
          ON t.table_name = c.table_name AND t.table_schema = c.table_schema
        WHERE t.table_schema = $1 AND t.table_type = 'BASE TABLE'
        GROUP BY t.table_name
        ORDER BY t.table_name
      `, [schemaName]);

      const fieldsResult = await this.pool.query(`
        SELECT field_name, description, source_table
        FROM public.query_rules
        WHERE referral = $1
        ORDER BY field_name
      `, [referral]);

      const result = {
        schema_name: schemaName,
        client_name: userSchema.client_name,
        referral: referral,
        tables: schemaResult.rows.map(t => ({
          name: t.table_name,
          columns: t.columns
        })),
        available_fields: fieldsResult.rows.map(f => ({
          name: f.field_name,
          description: f.description,
          source_table: f.source_table
        }))
      };

      console.log(`✅ Schema loaded: ${result.tables.length} tables, ${result.available_fields.length} fields`);
      this.cache(cacheKey, result);
      return result;
    } catch (error) {
      // console.error('❌ Error fetching schema:', error.message);
      throw error;
    }
  }

  async getTableSamples(userId, rowsPerTable = 3) {
    try {
      const userSchema = await this.getUserSchema(userId);
      const schemaName = userSchema.schema_name;
      
      const cacheKey = `samples:${userId}:${schemaName}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        // console.log(`📦 Using cached samples for ${schemaName}`);
        return cached;
      }

      console.log(`🔍 Fetching sample data from ${schemaName}...`);
      
      const schemaInfo = await this.getCompleteSchemaInfo(userId);
      const samples = {};
      
      const client = await this.pool.connect();
      try {
        await client.query(`SET search_path TO "${schemaName}", public`);
        
        for (const table of schemaInfo.tables) {
          try {
            const result = await client.query(`
              SELECT * FROM ${table.name} 
              LIMIT ${rowsPerTable}
            `);
            samples[table.name] = result.rows;
            console.log(`   ✅ ${table.name}: ${result.rows.length} sample rows`);
          } catch (error) {
            console.log(`   ⚠️  ${table.name}: Could not fetch samples (${error.message})`);
            samples[table.name] = [];
          }
        }
      } finally {
        client.release();
      }

      this.cache(cacheKey, samples);
      return samples;
    } catch (error) {
      console.error('❌ Error fetching samples:', error.message);
      return {};
    }
  }

  async sampleSpecificTable(userId, tableName, limit = 5) {
    const client = await this.pool.connect();
    
    try {
      const userSchema = await this.getUserSchema(userId);
      const schemaName = userSchema.schema_name;
      
      console.log(`🔍 Sampling table: ${tableName} (${limit} rows)`);
      
      await client.query(`SET search_path TO "${schemaName}", public`);
      
      const result = await client.query(`
        SELECT * FROM ${tableName} 
        LIMIT ${limit}
      `);
      
      console.log(`   ✅ Retrieved ${result.rows.length} sample rows`);
      
      return {
        success: true,
        table_name: tableName,
        sample_rows: result.rows,
        row_count: result.rows.length,
        columns: result.fields?.map(f => f.name) || []
      };
    } catch (error) {
      console.error(`   ❌ Error sampling ${tableName}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        table_name: tableName
      };
    } finally {
      client.release();
    }
  }

  // async getFieldRules(userId, fieldName) {
  //   try {
  //     const userSchema = await this.getUserSchema(userId);
  //     const referral = userSchema.referral;

  //     const cacheKey = `rules:${referral}:${fieldName}`;
  //     const cached = this.getFromCache(cacheKey);
  //     if (cached) return cached;

  //     const result = await this.pool.query(`
  //       SELECT *
  //       FROM public.query_rules
  //       WHERE referral = $1 AND field_name = $2
  //     `, [referral, fieldName]);

  //     if (result.rows.length === 0) {
  //       throw new Error(`No rules found for field: ${fieldName}`);
  //     }

  //     const rule = result.rows[0];
  //     const parsed = {
  //       field_name: rule.field_name,
  //       source_table: rule.source_table,
  //       source_column: rule.source_column,
  //       joins_required: rule.joins_required ? JSON.parse(rule.joins_required) : [],
  //       transformations: rule.transformations,
  //       aggregation_hint: rule.aggregation_hint,
  //       description: rule.description
  //     };

  //     this.cache(cacheKey, parsed);
  //     return parsed;
  //   } catch (error) {
  //     console.error(`❌ Error getting rules for ${fieldName}:`, error.message);
  //     throw error;
  //   }
  // }

  async getFieldRules(userId, fieldName) {
    try {
      const userSchema = await this.getUserSchema(userId);
      const referral = userSchema.referral;

      const cacheKey = `rules:${referral}:${fieldName}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const result = await this.pool.query(`
        SELECT *
        FROM public.query_rules
        WHERE referral = $1 AND field_name = $2
      `, [referral, fieldName]);

      if (result.rows.length === 0) {
        throw new Error(`No rules found for field: ${fieldName}`);
      }

      const rule = result.rows[0];
      
      // FIX: Handle joins_required properly
      let joinsRequired = [];
      if (rule.joins_required) {
        if (typeof rule.joins_required === 'string') {
          // It's a JSON string, parse it
          try {
            joinsRequired = JSON.parse(rule.joins_required);
          } catch (e) {
            console.error('Failed to parse joins_required:', e);
            joinsRequired = [];
          }
        } else if (Array.isArray(rule.joins_required)) {
          // It's already an array (PostgreSQL JSONB type)
          joinsRequired = rule.joins_required;
        } else if (typeof rule.joins_required === 'object') {
          // It's an object, wrap it in array
          joinsRequired = [rule.joins_required];
        }
      }
      
      const parsed = {
        field_name: rule.field_name,
        source_table: rule.source_table,
        source_column: rule.source_column,
        joins_required: joinsRequired,
        transformations: rule.transformations,
        aggregation_hint: rule.aggregation_hint,
        description: rule.description
      };

      this.cache(cacheKey, parsed);
      return parsed;
    } catch (error) {
      console.error(`❌ Error getting rules for ${fieldName}:`, error.message);
      throw error;
    }
  }

  async validateQueryInternal(userId, query, tablesUsed = []) {
    try {
      const userSchema = await this.getUserSchema(userId);
      const schemaName = userSchema.schema_name;

      const dangerousPatterns = [
        /DROP\s+(?:TABLE|SCHEMA|DATABASE)/i,
        /DELETE\s+FROM/i,
        /INSERT\s+INTO/i,
        /UPDATE\s+/i,
        /ALTER\s+/i,
        /TRUNCATE/i,
        /CREATE\s+(?:TABLE|SCHEMA)/i
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(query)) {
          return { valid: false, error: 'Query contains unsafe operations. Only SELECT queries are allowed.' };
        }
      }

      if (!query.trim().toUpperCase().startsWith('SELECT')) {
        return { valid: false, error: 'Only SELECT queries are allowed' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * FIXED: Proper LIMIT handling - don't add LIMIT if query already has it
   */
  async executeQuery(userId, query, limit = 100) {
    const client = await this.pool.connect();
    
    try {
      console.log(`⚡ Executing query for user ${userId}`);
      
      const userSchema = await this.getUserSchema(userId);
      const schemaName = userSchema.schema_name;
      console.log(`   Schema: ${schemaName}`);

      // Validate first
      const validation = await this.validateQueryInternal(userId, query, []);
      if (!validation.valid) {
        console.error(`   ❌ Validation failed: ${validation.error}`);
        return { success: false, error: validation.error };
      }

      // Set search_path
      await client.query(`SET search_path TO "${schemaName}", public`);
      console.log(`   🔍 Search path set to: "${schemaName}", public`);

      // CRITICAL FIX: Check if query already has LIMIT
      const trimmedQuery = query.trim().replace(/;$/, ''); // Remove trailing semicolon
      const hasLimit = /LIMIT\s+\d+\s*$/i.test(trimmedQuery);
      
      let finalQuery;
      if (hasLimit) {
        // Query already has LIMIT, use as-is
        finalQuery = trimmedQuery;
        console.log(`   ℹ️  Query already has LIMIT clause`);
      } else {
        // Add LIMIT
        finalQuery = `${trimmedQuery} LIMIT ${limit}`;
        console.log(`   ℹ️  Added LIMIT ${limit} to query`);
      }
        
      console.log(`   📝 Query: ${finalQuery.substring(0, 100)}...`);
      
      const result = await client.query(finalQuery);

      console.log(`   ✅ Success: ${result.rows.length} rows returned`);

      return {
        success: true,
        rows: result.rows,
        row_count: result.rows.length,
        columns: result.fields?.map(f => ({
          name: f.name,
          type: f.dataTypeID
        })) || []
      };
    } catch (error) {
      console.error(`   ❌ Query execution error: ${error.message}`);
      
      let errorMessage = error.message;
      if (error.message.includes('does not exist')) {
        errorMessage = `${error.message}. Please check the table name and available tables in your schema.`;
      }
      
      return { success: false, error: errorMessage };
    } finally {
      client.release();
    }
  }

  async buildQueryForField(userId, fieldName) {
    try {
      console.log(`🔨 Building query for field: ${fieldName}`);
      
      const rules = await this.getFieldRules(userId, fieldName);
      
      let query = `SELECT ${rules.source_column} FROM ${rules.source_table}`;

      if (rules.joins_required && rules.joins_required.length > 0) {
        for (const join of rules.joins_required) {
          query += ` ${join.type} ${join.table} ON ${join.on}`;
        }
      }

      if (rules.transformations) {
        query += ` ${rules.transformations}`;
      }

      if (rules.aggregation_hint) {
        query += ` ${rules.aggregation_hint}`;
      }

      console.log(`✅ Query built successfully`);

      return {
        success: true,
        query: query,
        suggested_query: true,
        field_name: fieldName,
        source_table: rules.source_table,
        description: rules.description
      };
    } catch (error) {
      console.error(`❌ Error building query: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async getFieldSuggestions(userId) {
    try {
      const userSchema = await this.getUserSchema(userId);
      const referral = userSchema.referral;

      const result = await this.pool.query(`
        SELECT 
          field_name,
          description,
          source_table,
          aggregation_hint
        FROM public.query_rules
        WHERE referral = $1
        ORDER BY field_name
      `, [referral]);

      return {
        success: true,
        suggestions: result.rows.map(row => ({
          field: row.field_name,
          description: row.description,
          what_it_shows: `${row.field_name} from ${row.source_table}`,
          how_to_query: row.aggregation_hint ? `Use: ${row.aggregation_hint}` : 'Simple SELECT'
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  clearCache() {
    this.schemaCache.clear();
    console.log('🗑️ Cache cleared');
  }

  async close() {
    await this.pool.end();
    console.log('👋 Database connection closed');
  }
}

export default new DatabaseService();

