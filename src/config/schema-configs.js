// src/config/schema-configs.js

export const schemaConfigs = {
  'hireplus': {
    displayName: 'Hireplus Vehicle Rentals',
    source: 'hireplus',
    
    customInstructions: `
HIREPLUS - PATTERN-FIRST APPROACH

STRATEGY:
1. Check if query matches a pattern → Use it directly (fast!)
2. No pattern match → Call get_schema_structure ONCE
3. Use exact column names from structure for custom queries

AVAILABLE PATTERNS (use these first):
- active_rentals: List current rental contracts
- contract_income: Income breakdown per contract
- vehicle_total_income: Total income per vehicle
- income_by_customer: Revenue by customer
- vehicle_margin: Profitability per vehicle
- monthly_revenue: Current monthly revenue projection

WHEN TO DISCOVER:
Only if user asks something NOT covered by patterns above.
Example: "Show contracts ending next month" → No pattern → Discover

IMPORTANT COLUMN NAMES (if you need to write custom SQL):
- vehicle_registration (NOT regi_no or registration)
- vehicle_manufactur (NOT manufacturer - typo in DB)
- amount_oi (other_incomes amount)
- amount_oc (other_costs amount)
- next_step_status_sales (status field)
- id_purchase_order (FK, integer type)

KEY JOINS:
- so.id_purchase_order = po.id (integer = integer)
- oi.id_sales_order = so.id (contract-level income)
- oi.id_purchase_order = po.id (vehicle-level income)
`,
    
    queryPatterns: {
      active_rentals: `
        SELECT 
          so.agreement_number,
          so.cust_name,
          po.vehicle_registration,
          po.vehicle_manufactur,
          po.vehicle_model,
          so.monthly_rental,
          so.contract_start_date
        FROM sales_orders so
        LEFT JOIN purchase_orders po ON po.id = so.id_purchase_order
        WHERE so.next_step_status_sales = 'Hired'
        ORDER BY so.contract_start_date DESC
      `,

      contract_income: `
        SELECT 
          so.agreement_number,
          so.cust_name,
          po.vehicle_registration,
          ((so.monthly_rental * so.margin_term) + so.first_payment) as rental_income,
          COALESCE(SUM(oi.amount_oi), 0) as other_income,
          ((so.monthly_rental * so.margin_term) + so.first_payment) + COALESCE(SUM(oi.amount_oi), 0) as total_income
        FROM sales_orders so
        LEFT JOIN purchase_orders po ON po.id = so.id_purchase_order
        LEFT JOIN other_incomes oi ON oi.id_sales_order = so.id
        GROUP BY so.id, so.agreement_number, so.cust_name, po.vehicle_registration, so.monthly_rental, so.margin_term, so.first_payment
        ORDER BY total_income DESC
      `,

      vehicle_total_income: `
        SELECT 
          po.vehicle_registration,
          po.vehicle_manufactur,
          po.vehicle_model,
          COUNT(DISTINCT so.id) as contract_count,
          SUM((so.monthly_rental * so.margin_term) + so.first_payment) as rental_income,
          COALESCE(SUM(oi.amount_oi), 0) as other_income,
          SUM((so.monthly_rental * so.margin_term) + so.first_payment) + COALESCE(SUM(oi.amount_oi), 0) as total_income
        FROM purchase_orders po
        LEFT JOIN sales_orders so ON so.id_purchase_order = po.id
        LEFT JOIN other_incomes oi ON oi.id_purchase_order = po.id
        GROUP BY po.id, po.vehicle_registration, po.vehicle_manufactur, po.vehicle_model
        ORDER BY total_income DESC
      `,

      income_by_customer: `
        SELECT 
          so.cust_name as customer,
          COUNT(so.id) as contract_count,
          SUM((so.monthly_rental * so.margin_term) + so.first_payment) as rental_income,
          COALESCE(SUM(oi.amount_oi), 0) as other_income,
          SUM((so.monthly_rental * so.margin_term) + so.first_payment) + COALESCE(SUM(oi.amount_oi), 0) as total_income
        FROM sales_orders so
        LEFT JOIN other_incomes oi ON oi.id_sales_order = so.id
        GROUP BY so.cust_name
        ORDER BY total_income DESC
      `,
      
      vehicle_margin: `
        SELECT 
          po.vehicle_registration,
          po.vehicle_manufactur,
          po.vehicle_model,
          so.cust_name,
          so.next_step_status_sales as status,
          ((so.monthly_rental * so.margin_term) + so.first_payment) as rental_income,
          COALESCE(SUM(oi.amount_oi), 0) as other_income,
          so.total_cost as cost,
          COALESCE(SUM(oc.amount_oc), 0) as other_costs,
          (((so.monthly_rental * so.margin_term) + so.first_payment) + COALESCE(SUM(oi.amount_oi), 0) - so.total_cost - COALESCE(SUM(oc.amount_oc), 0)) as net_margin
        FROM sales_orders so
        LEFT JOIN purchase_orders po ON po.id = so.id_purchase_order
        LEFT JOIN other_incomes oi ON oi.id_sales_order = so.id
        LEFT JOIN other_costs oc ON oc.id_purchase_order = po.id
        GROUP BY so.id, po.vehicle_registration, po.vehicle_manufactur, po.vehicle_model, so.cust_name, so.next_step_status_sales, so.monthly_rental, so.margin_term, so.first_payment, so.total_cost
        ORDER BY net_margin DESC
      `,
      
      monthly_revenue: `
        SELECT 
          SUM(so.monthly_rental) as total_monthly_revenue,
          COUNT(so.id) as active_contract_count,
          AVG(so.monthly_rental) as avg_monthly_rental
        FROM sales_orders so
        WHERE so.next_step_status_sales = 'Hired'
      `
    }
  },

  'default': {
    displayName: 'Generic Data Source',
    source: 'unknown',
    customInstructions: `
GENERIC SCHEMA - DISCOVERY REQUIRED

NO PATTERNS AVAILABLE - Must discover structure first

MANDATORY WORKFLOW:
1. Call get_schema_structure(schema_name)
2. Read response carefully:
   - structure: tables and columns
   - sample_data: actual data formats
3. Use EXACT column names (copy from structure)
4. Check data types before joining
5. Write query using exact names
6. Execute

CRITICAL RULES:
❌ NEVER guess column names
❌ NEVER assume standard names (id, name, amount)
❌ NEVER use abbreviations
✅ ALWAYS use exact names from get_schema_structure
✅ ALWAYS check sample_data for formats
✅ ALWAYS verify data types match in JOINs

COMMON ERRORS TO AVOID:
- text = integer (type mismatch)
- Guessing "registration" when it's "vehicle_registration"
- Using "amount" when it's "amount_oi" or "amount_oc"
- Abbreviated names like "regi_no" instead of full name
`,
    queryPatterns: {}
  }
};

/**
 * Get configuration for a specific schema
 */
export function getSchemaConfig(schemaName) {
  return schemaConfigs[schemaName] || schemaConfigs['default'];
}

/**
 * Get custom instructions for a schema
 */
export function getSchemaInstructions(schemaName) {
  const config = getSchemaConfig(schemaName);
  return config.customInstructions;
}

/**
 * Get a query pattern for a schema
 */
export function getQueryPattern(schemaName, patternName) {
  const config = getSchemaConfig(schemaName);
  return config.queryPatterns[patternName] || null;
}

/**
 * Check if a schema has custom configuration
 */
export function hasCustomConfig(schemaName) {
  return schemaName in schemaConfigs && schemaName !== 'default';
}

/**
 * List all configured schemas
 */
export function listConfiguredSchemas() {
  return Object.keys(schemaConfigs)
    .filter(key => key !== 'default')
    .map(key => ({
      schemaName: key,
      displayName: schemaConfigs[key].displayName,
      source: schemaConfigs[key].source,
      hasCustomInstructions: true,
      patternCount: Object.keys(schemaConfigs[key].queryPatterns || {}).length
    }));
}