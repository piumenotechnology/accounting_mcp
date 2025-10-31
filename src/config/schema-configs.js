// src/config/schema-configs.js

/**
 * Schema-specific configurations and instructions
 * Add custom handling for complex schemas that need special attention
 */

export const schemaConfigs = {
  // Example: Xero schema with complex structure
//   'xero_client_a': {
//     displayName: 'ABC Corp',
//     source: 'xero',
    
//     // Custom instructions for this schema
//     customInstructions: `
// ═══════════════════════════════════════════════════════════════
// SCHEMA: xero_client_a (ABC Corp)
// ═══════════════════════════════════════════════════════════════

// KEY TABLES:
// 1. pl_xero - Profit & Loss transactions
// 2. bank_transactions - Bank account movements
// 3. invoices - Customer invoices
// 4. bills - Supplier bills
// 5. contacts - Customer/supplier information

// IMPORTANT RELATIONSHIPS:
// • pl_xero.contact_id → contacts.id (for customer/supplier details)
// • bank_transactions.invoice_id → invoices.id (for payment tracking)
// • invoices.contact_id → contacts.id (for customer info)

// COMMON QUERIES:

// 1️⃣ REVENUE BY CUSTOMER:
// SELECT 
//   c.name as customer,
//   SUM(pl.amount) as total_revenue,
//   COUNT(*) as transaction_count
// FROM pl_xero pl
// JOIN contacts c ON pl.contact_id = c.id
// WHERE pl.type = 'Revenue'
// GROUP BY c.name
// ORDER BY total_revenue DESC;

// 2️⃣ OUTSTANDING INVOICES:
// SELECT 
//   i.invoice_number,
//   c.name as customer,
//   i.total,
//   i.amount_paid,
//   (i.total - i.amount_paid) as outstanding,
//   i.due_date,
//   CASE 
//     WHEN i.due_date < CURRENT_DATE THEN 'OVERDUE'
//     ELSE 'PENDING'
//   END as status
// FROM invoices i
// JOIN contacts c ON i.contact_id = c.id
// WHERE i.status != 'PAID'
// ORDER BY i.due_date;

// 3️⃣ CASH FLOW ANALYSIS:
// SELECT 
//   DATE_TRUNC('month', bt.date) as month,
//   SUM(CASE WHEN bt.type = 'RECEIVE' THEN bt.amount ELSE 0 END) as inflow,
//   SUM(CASE WHEN bt.type = 'SPEND' THEN bt.amount ELSE 0 END) as outflow,
//   SUM(CASE WHEN bt.type = 'RECEIVE' THEN bt.amount ELSE -bt.amount END) as net_cash_flow
// FROM bank_transactions bt
// WHERE bt.date >= DATE_TRUNC('year', CURRENT_DATE)
// GROUP BY month
// ORDER BY month DESC;

// 4️⃣ TOP EXPENSES BY CATEGORY:
// SELECT 
//   account_name,
//   SUM(ABS(amount)) as total,
//   COUNT(*) as count,
//   AVG(ABS(amount)) as avg_amount
// FROM pl_xero
// WHERE type = 'Expense'
//   AND date >= DATE_TRUNC('month', CURRENT_DATE)
// GROUP BY account_name
// ORDER BY total DESC
// LIMIT 10;

// 5️⃣ CUSTOMER PAYMENT BEHAVIOR:
// SELECT 
//   c.name as customer,
//   COUNT(i.id) as invoice_count,
//   SUM(i.total) as total_invoiced,
//   SUM(i.amount_paid) as total_paid,
//   AVG(EXTRACT(days FROM (i.paid_date - i.invoice_date))) as avg_days_to_pay
// FROM invoices i
// JOIN contacts c ON i.contact_id = c.id
// WHERE i.status = 'PAID'
//   AND i.invoice_date >= CURRENT_DATE - INTERVAL '12 months'
// GROUP BY c.name
// HAVING COUNT(i.id) >= 3
// ORDER BY avg_days_to_pay;

// BUSINESS RULES:
// • Revenue is positive amounts in pl_xero where type = 'Revenue'
// • Expenses are negative amounts (use ABS() to get positive values)
// • Bank reconciliation: check bank_transactions.reconciled = true
// • Overdue invoices: WHERE due_date < CURRENT_DATE AND status != 'PAID'

// DATA QUALITY NOTES:
// • Some older transactions may have NULL contact_id
// • Invoice numbers follow format: INV-YYYY-NNNN
// • Bank transactions before 2024-01-01 may have missing categories
// `,
    
//     // Common query patterns for this schema
//     queryPatterns: {
//       revenue: `
//         SELECT SUM(amount) as total 
//         FROM pl_xero 
//         WHERE type = 'Revenue'
//       `,
      
//       revenue_by_customer: `
//         SELECT 
//           c.name, 
//           SUM(pl.amount) as total
//         FROM pl_xero pl
//         JOIN contacts c ON pl.contact_id = c.id
//         WHERE pl.type = 'Revenue'
//         GROUP BY c.name
//         ORDER BY total DESC
//       `,
      
//       outstanding_invoices: `
//         SELECT 
//           i.invoice_number,
//           c.name as customer,
//           (i.total - i.amount_paid) as outstanding
//         FROM invoices i
//         JOIN contacts c ON i.contact_id = c.id
//         WHERE i.status != 'PAID'
//       `,
      
//       cash_flow: `
//         SELECT 
//           DATE_TRUNC('month', date) as month,
//           SUM(CASE WHEN type = 'RECEIVE' THEN amount ELSE -amount END) as net
//         FROM bank_transactions
//         GROUP BY month
//         ORDER BY month DESC
//       `
//     }
//   },

//   // Example: Another client with different structure
//   'quickbooks_client_b': {
//     displayName: 'XYZ Ltd',
//     source: 'quickbooks',
    
//     customInstructions: `
// ═══════════════════════════════════════════════════════════════
// SCHEMA: quickbooks_client_b (XYZ Ltd)
// ═══════════════════════════════════════════════════════════════

// KEY TABLES:
// 1. transactions - All financial transactions
// 2. accounts - Chart of accounts
// 3. customers - Customer master data
// 4. vendors - Vendor master data

// IMPORTANT RELATIONSHIPS:
// • transactions.account_id → accounts.id
// • transactions.customer_id → customers.id (for sales)
// • transactions.vendor_id → vendors.id (for purchases)

// SPECIAL NOTES:
// • This company uses CLASS tracking (transactions.class_id)
// • Department codes stored in transactions.department
// • Multi-currency: Always filter by transactions.currency = 'USD' unless specified

// COMMON QUERIES:

// 1️⃣ REVENUE BY DEPARTMENT:
// SELECT 
//   department,
//   SUM(amount) as total
// FROM transactions t
// JOIN accounts a ON t.account_id = a.id
// WHERE a.account_type = 'Income'
//   AND t.currency = 'USD'
// GROUP BY department
// ORDER BY total DESC;

// 2️⃣ VENDOR SPENDING:
// SELECT 
//   v.name,
//   SUM(t.amount) as total_spent,
//   COUNT(*) as transaction_count
// FROM transactions t
// JOIN vendors v ON t.vendor_id = v.id
// WHERE t.transaction_type = 'Bill'
//   AND t.date >= DATE_TRUNC('year', CURRENT_DATE)
// GROUP BY v.name
// ORDER BY total_spent DESC;

// BUSINESS RULES:
// • Always filter by currency = 'USD' for main reports
// • Class tracking: 'CORP' = corporate, 'RETAIL' = retail operations
// • Fiscal year starts April 1st (use DATE_TRUNC appropriately)
// `,
    
//     queryPatterns: {
//       revenue: `
//         SELECT SUM(t.amount) as total
//         FROM transactions t
//         JOIN accounts a ON t.account_id = a.id
//         WHERE a.account_type = 'Income'
//           AND t.currency = 'USD'
//       `,
      
//       expenses_by_vendor: `
//         SELECT 
//           v.name,
//           SUM(t.amount) as total
//         FROM transactions t
//         JOIN vendors v ON t.vendor_id = v.id
//         WHERE t.transaction_type = 'Bill'
//         GROUP BY v.name
//         ORDER BY total DESC
//       `
//     }
//   },

  // Add more schemas as needed...
  
  // Default fallback for schemas without custom config
  'default': {
    displayName: 'Unknown Schema',
    source: 'unknown',
    customInstructions: `
═══════════════════════════════════════════════════════════════
GENERIC SCHEMA INSTRUCTIONS
═══════════════════════════════════════════════════════════════

This schema doesn't have custom instructions yet.

WORKFLOW:
1. Call list_data_sources to see schema name
2. Call get_schema_structure to discover tables and columns
3. Examine sample_data carefully to understand data patterns
4. Write queries using EXACT names from schema structure

BEST PRACTICES:
• Always check column names before writing queries
• Look at sample data to understand value formats
• Use appropriate date formats (usually YYYY-MM-DD)
• Handle NULL values appropriately
• Test with simple queries first before complex joins
`,
    queryPatterns: {}
  }
};

export function getSchemaConfig(schemaName) {
  return schemaConfigs[schemaName] || schemaConfigs['default'];
}


export function getSchemaInstructions(schemaName) {
  const config = getSchemaConfig(schemaName);
  return config.customInstructions;
}


export function getQueryPattern(schemaName, patternName) {
  const config = getSchemaConfig(schemaName);
  return config.queryPatterns[patternName] || null;
}


export function hasCustomConfig(schemaName) {
  return schemaName in schemaConfigs && schemaName !== 'default';
}


export function listConfiguredSchemas() {
  return Object.keys(schemaConfigs)
    .filter(key => key !== 'default')
    .map(key => ({
      schemaName: key,
      displayName: schemaConfigs[key].displayName,
      source: schemaConfigs[key].source,
      hasCustomInstructions: true
    }));
}