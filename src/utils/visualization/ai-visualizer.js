// // src/services/ai-visualizer.js
// import OpenAI from 'openai';

// const client = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// class AIVisualizer {
//   constructor() {
//     this.model = 'gpt-4o-mini'; // Fast and cheap
//   }

//   /**
//    * Main method: Analyze SQL results and generate visualization config
//    */
//   async generateVisualization(data) {
//     const { rows, query, userQuestion = '', schema_name } = data;

//     if (!rows || rows.length === 0) {
//       return {
//         visual: null,
//         content: '',
//         variants: [],
//         default: null
//       };
//     }

//     // Less than 3 rows? Return table only
//     if (rows.length < 3) {
//       return {
//         visual: null,
//         content: '',
//         variants: [],
//         default: null
//       };
//     }

//     try {
//       // Step 1: Ask AI to analyze and plan visualizations
//       const vizPlan = await this.planVisualizations(rows, query, userQuestion, schema_name);

//       // Step 2: Execute AI's plan and build actual chart data
//       const visualizations = this.buildVisualizationsFromPlan(rows, vizPlan);

//       return visualizations;

//     } catch (error) {
//       console.error('❌ AI Visualization error:', error);
      
//       // Fallback: return table only
//       return {
//         visual: this.buildSimpleTable(rows),
//         content: '',
//         variants: [
//           {
//             id: 'table',
//             title: 'Table',
//             visual: this.buildSimpleTable(rows)
//           }
//         ],
//         default: 'table'
//       };
//     }
//   }

//   /**
//    * Step 1: AI analyzes data and creates visualization plan
//    */
//   async planVisualizations(rows, query, userQuestion, schema_name) {
//     // Prepare data sample (first 5 rows to save tokens)
//     const sampleRows = rows.slice(0, 5);
//     const columns = Object.keys(rows[0]);
//     const rowCount = rows.length;

//     // Detect column types by sampling
//     const columnTypes = this.detectColumnTypes(rows, columns);

//     const prompt = `You are a data visualization expert. Analyze this SQL query result and create the best visualizations.

// **Context:**
// - Schema: ${schema_name}
// - User Question: "${userQuestion || 'Not provided'}"
// - SQL Query: ${query}
// - Total Rows: ${rowCount}
// - Columns: ${JSON.stringify(columnTypes, null, 2)}

// **Sample Data (first 5 rows):**
// ${JSON.stringify(sampleRows, null, 2)}

// **Your Task:**
// 1. Analyze the data structure and user intent
// 2. Recommend the best default visualization
// 3. Suggest 2-4 alternative visualization variants
// 4. For each visualization, specify:
//    - Chart type (table, line, bar, pie, period_bar)
//    - Which columns to use for X and Y axis
//    - Aggregation needed (sum, count, avg, none)
//    - Sorting/ordering requirements
//    - Top N limit for categories (if applicable)

// **Rules:**
// - If data has dates + numeric values → line chart or period_bar for trends
// - If data has categories + numeric values → bar chart or pie for comparison
// - If categories > 10 → use "top_n" to limit and group rest as "Other"
// - Always include a table variant
// - Pie charts work best with 3-10 categories
// - Choose chart type based on user intent (trends vs comparison vs distribution)

// **Response Format (JSON only):**
// {
//   "reasoning": "Brief explanation of your choices",
//   "default": "chart_id",
//   "variants": [
//     {
//       "id": "table",
//       "title": "Data Table",
//       "type": "table",
//       "columns": ["col1", "col2", "col3"]
//     },
//     {
//       "id": "line",
//       "title": "Trend Over Time",
//       "type": "line",
//       "x_column": "date",
//       "y_column": "amount",
//       "sort_by": "date",
//       "sort_order": "asc",
//       "aggregation": "none"
//     },
//     {
//       "id": "bar",
//       "title": "By Category",
//       "type": "bar",
//       "x_column": "category",
//       "y_column": "amount",
//       "aggregation": "sum",
//       "sort_by": "value",
//       "sort_order": "desc",
//       "top_n": 10
//     },
//     {
//       "id": "pie",
//       "title": "Distribution",
//       "type": "pie",
//       "category_column": "vendor",
//       "value_column": "amount",
//       "aggregation": "sum",
//       "top_n": 8
//     }
//   ]
// }

// Return ONLY valid JSON, no markdown or explanations outside the JSON.`;

//     console.log('🤖 Asking AI to plan visualizations...');

//     const response = await client.chat.completions.create({
//       model: this.model,
//       messages: [
//         {
//           role: 'system',
//           content: 'You are a data visualization expert. Always respond with valid JSON only.'
//         },
//         {
//           role: 'user',
//           content: prompt
//         }
//       ],
//       temperature: 0.3,
//       max_tokens: 1500,
//       response_format: { type: 'json_object' }
//     });

//     const content = response.choices[0].message.content;
//     const plan = JSON.parse(content);

//     console.log('✅ AI Visualization Plan:');
//     console.log(`   Reasoning: ${plan.reasoning}`);
//     console.log(`   Default: ${plan.default}`);
//     console.log(`   Variants: ${plan.variants?.map(v => v.id).join(', ')}`);

//     return plan;
//   }

//   /**
//    * Step 2: Execute AI's plan and build actual visualizations
//    */
//   buildVisualizationsFromPlan(rows, plan) {
//     const variants = [];

//     for (const variantPlan of plan.variants || []) {
//       let visual = null;

//       switch (variantPlan.type) {
//         case 'table':
//           visual = this.buildTable(rows, variantPlan);
//           break;
//         case 'line':
//           visual = this.buildLineChart(rows, variantPlan);
//           break;
//         case 'bar':
//           visual = this.buildBarChart(rows, variantPlan);
//           break;
//         case 'period_bar':
//           visual = this.buildPeriodBar(rows, variantPlan);
//           break;
//         case 'pie':
//           visual = this.buildPieChart(rows, variantPlan);
//           break;
//       }

//       if (visual) {
//         variants.push({
//           id: variantPlan.id,
//           title: variantPlan.title,
//           visual
//         });
//       }
//     }

//     // Find default visual
//     const defaultId = plan.default || 'table';
//     const defaultVisual = variants.find(v => v.id === defaultId)?.visual;

//     return {
//       visual: defaultVisual,
//       content: plan.reasoning || '',
//       variants,
//       default: defaultId
//     };
//   }

//   /**
//    * Build table visualization
//    */
//   buildTable(rows, plan) {
//     const columns = plan.columns || Object.keys(rows[0]);
//     const labels = columns.map(col => this.humanize(col));
    
//     const data = rows.map(row =>
//       columns.map(col => this.formatValue(row[col]))
//     );

//     return {
//       type: 'table',
//       labels,
//       data
//     };
//   }

//   /**
//    * Build line chart
//    */
//   buildLineChart(rows, plan) {
//     const { x_column, y_column, sort_by, sort_order = 'asc' } = plan;

//     // Sort data
//     let sorted = [...rows];
//     if (sort_by) {
//       sorted.sort((a, b) => {
//         const aVal = a[sort_by];
//         const bVal = b[sort_by];
        
//         // Try date comparison first
//         const aDate = new Date(aVal);
//         const bDate = new Date(bVal);
        
//         if (!isNaN(aDate) && !isNaN(bDate)) {
//           return sort_order === 'asc' ? aDate - bDate : bDate - aDate;
//         }
        
//         // Fallback to regular comparison
//         return sort_order === 'asc' ? 
//           (aVal > bVal ? 1 : -1) : 
//           (aVal < bVal ? 1 : -1);
//       });
//     }

//     const labels = sorted.map(r => this.formatValue(r[x_column]));
//     const data = sorted.map(r => this.roundNumber(Number(r[y_column])));
//     const formatted = data.map(v => this.formatCurrency(v));

//     return {
//       type: 'chart',
//       chartType: 'line',
//       labels,
//       data,
//       axis_labels: {
//         x: this.humanize(x_column),
//         y: this.humanize(y_column)
//       },
//       extra: { formatted }
//     };
//   }

//   /**
//    * Build period bar chart (time series as bars)
//    */
//   buildPeriodBar(rows, plan) {
//     const lineChart = this.buildLineChart(rows, plan);
//     return {
//       ...lineChart,
//       chartType: 'bar'
//     };
//   }

//   /**
//    * Build bar chart with aggregation
//    */
//   buildBarChart(rows, plan) {
//     const { 
//       x_column, 
//       y_column, 
//       aggregation = 'sum', 
//       sort_by = 'value',
//       sort_order = 'desc',
//       top_n 
//     } = plan;

//     // Aggregate data
//     const aggregated = this.aggregate(rows, x_column, y_column, aggregation);

//     // Sort
//     let entries = [...aggregated.entries()];
//     if (sort_by === 'value') {
//       entries.sort((a, b) => sort_order === 'asc' ? a[1] - b[1] : b[1] - a[1]);
//     } else {
//       entries.sort((a, b) => {
//         const comparison = String(a[0]).localeCompare(String(b[0]));
//         return sort_order === 'asc' ? comparison : -comparison;
//       });
//     }

//     // Apply top_n and "Other"
//     if (top_n && entries.length > top_n) {
//       const head = entries.slice(0, top_n);
//       const tail = entries.slice(top_n);
//       const otherSum = tail.reduce((sum, [_, v]) => sum + v, 0);
      
//       entries = head;
//       if (otherSum > 0) {
//         entries.push(['Other', otherSum]);
//       }
//     }

//     const labels = entries.map(([k, _]) => String(k));
//     const data = entries.map(([_, v]) => this.roundNumber(v));
//     const formatted = data.map(v => this.formatCurrency(v));

//     return {
//       type: 'chart',
//       chartType: 'bar',
//       labels,
//       data,
//       axis_labels: {
//         x: this.humanize(x_column),
//         y: this.humanize(y_column)
//       },
//       extra: { formatted }
//     };
//   }

//   /**
//    * Build pie chart with aggregation
//    */
//   buildPieChart(rows, plan) {
//     const { 
//       category_column, 
//       value_column, 
//       aggregation = 'sum',
//       top_n = 8 
//     } = plan;

//     // Aggregate
//     const aggregated = this.aggregate(rows, category_column, value_column, aggregation);

//     // Sort by value desc
//     let entries = [...aggregated.entries()].sort((a, b) => b[1] - a[1]);

//     // Top N with "Other"
//     if (entries.length > top_n) {
//       const head = entries.slice(0, top_n);
//       const tail = entries.slice(top_n);
//       const otherSum = tail.reduce((sum, [_, v]) => sum + v, 0);
      
//       entries = head;
//       if (otherSum > 0) {
//         entries.push(['Other', otherSum]);
//       }
//     }

//     // Pie charts need 3-10 slices
//     if (entries.length < 3 || entries.length > 10) {
//       return null;
//     }

//     const labels = entries.map(([k, _]) => String(k));
//     const data = entries.map(([_, v]) => this.roundNumber(v));
//     const formatted = data.map(v => this.formatCurrency(v));

//     return {
//       type: 'chart',
//       chartType: 'pie',
//       labels,
//       data,
//       extra: { formatted }
//     };
//   }

//   /**
//    * Aggregate data by category
//    */
//   aggregate(rows, categoryColumn, valueColumn, method = 'sum') {
//     const groups = new Map();

//     for (const row of rows) {
//       const category = row[categoryColumn];
//       if (category === null || category === undefined || category === '') continue;

//       const value = Number(row[valueColumn]);
//       if (!Number.isFinite(value)) continue;

//       if (!groups.has(category)) {
//         groups.set(category, []);
//       }
//       groups.get(category).push(value);
//     }

//     const result = new Map();
//     for (const [category, values] of groups.entries()) {
//       let aggregatedValue = 0;

//       switch (method) {
//         case 'sum':
//           aggregatedValue = values.reduce((a, b) => a + b, 0);
//           break;
//         case 'avg':
//           aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
//           break;
//         case 'count':
//           aggregatedValue = values.length;
//           break;
//         case 'min':
//           aggregatedValue = Math.min(...values);
//           break;
//         case 'max':
//           aggregatedValue = Math.max(...values);
//           break;
//         default:
//           aggregatedValue = values.reduce((a, b) => a + b, 0);
//       }

//       result.set(category, aggregatedValue);
//     }

//     return result;
//   }

//   /**
//    * Simple table fallback
//    */
//   buildSimpleTable(rows) {
//     const columns = Object.keys(rows[0]);
//     const labels = columns.map(col => this.humanize(col));
//     const data = rows.map(row =>
//       columns.map(col => this.formatValue(row[col]))
//     );

//     return {
//       type: 'table',
//       labels,
//       data
//     };
//   }

//   /**
//    * Detect column types from sample data
//    */
//   detectColumnTypes(rows, columns) {
//     const types = {};
//     const sampleSize = Math.min(10, rows.length);

//     for (const col of columns) {
//       const samples = rows.slice(0, sampleSize).map(r => r[col]);
      
//       let isDate = false;
//       let isNumeric = false;
//       let isCategorical = false;

//       // Check if date
//       const dateCount = samples.filter(v => {
//         if (!v) return false;
//         const d = new Date(v);
//         return !isNaN(d.getTime());
//       }).length;
      
//       isDate = dateCount / sampleSize >= 0.7;

//       // Check if numeric
//       const numericCount = samples.filter(v => {
//         return typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '');
//       }).length;
      
//       isNumeric = numericCount / sampleSize >= 0.8;

//       // Check if categorical
//       const uniqueValues = new Set(samples.filter(v => v !== null && v !== undefined));
//       const distinctRatio = uniqueValues.size / samples.length;
//       isCategorical = !isDate && !isNumeric && distinctRatio < 0.9 && uniqueValues.size >= 2;

//       types[col] = {
//         is_date: isDate,
//         is_numeric: isNumeric,
//         is_categorical: isCategorical,
//         sample_value: samples[0],
//         distinct_count: uniqueValues.size
//       };
//     }

//     return types;
//   }

//   /**
//    * Format value for display
//    */
//   formatValue(value) {
//     if (value === null || value === undefined) return '';
    
//     // Try date formatting
//     const date = new Date(value);
//     if (!isNaN(date.getTime()) && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
//       return date.toISOString().split('T')[0];
//     }

//     // Try number formatting
//     if (typeof value === 'number') {
//       return this.formatCurrency(value);
//     }

//     return String(value);
//   }

//   /**
//    * Format as currency
//    */
//   formatCurrency(value) {
//     if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
    
//     return new Intl.NumberFormat('en-US', {
//       style: 'currency',
//       currency: 'USD',
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2
//     }).format(value);
//   }

//   /**
//    * Round number
//    */
//   roundNumber(value) {
//     if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
//     return Math.round(value * 100) / 100;
//   }

//   /**
//    * Humanize column name
//    */
//   humanize(columnName) {
//     if (!columnName) return '';
    
//     return String(columnName)
//       .replace(/_/g, ' ')
//       .replace(/([A-Z])/g, ' $1')
//       .trim()
//       .split(' ')
//       .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
//       .join(' ');
//   }
// }

// export default AIVisualizer;


// src/services/ai-visualizer.js
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class AIVisualizer {
  constructor() {
    this.model = 'gpt-4o-mini';
    this.timeout = 2000; // 2 second AI timeout
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Main method: Fast visualization generation with multiple optimization strategies
   */
  async generateVisualization(data) {
    const startTime = Date.now();
    const { rows, query, userQuestion = '', schema_name } = data;

    // Early exit for empty/small data
    if (!rows || rows.length === 0 || rows.length < 3) {
      return { visual: null, content: '', variants: [], default: null };
    }

    const columns = Object.keys(rows[0]);
    const analysis = this.quickAnalyze(rows, columns);

    // ═══════════════════════════════════════════════════════════════
    // STRATEGY 5: Skip AI for simple cases (~100ms)
    // ═══════════════════════════════════════════════════════════════
    const isSimple = this.isSimpleCase(columns, analysis);
    
    if (isSimple) {
      console.log('⚡ Simple data structure detected, skipping AI');
      const result = await this.generateQuickFallback(rows, 0, analysis);
      console.log(`✅ Completed in ${Date.now() - startTime}ms (simple case)`);
      return result;
    }

    // ═══════════════════════════════════════════════════════════════
    // STRATEGY 3: Check cache (~50ms)
    // ═══════════════════════════════════════════════════════════════
    const cacheKey = this.getCacheKey(rows, columns);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log('⚡ Using cached visualization plan');
      const result = this.buildVisualizationsFromPlan(rows, cached.plan);
      console.log(`✅ Completed in ${Date.now() - startTime}ms (cached)`);
      return result;
    }

    // ═══════════════════════════════════════════════════════════════
    // STRATEGY 1: Race AI vs Quick Fallback (~500ms-2s)
    // ═══════════════════════════════════════════════════════════════
    console.log('🤖 Complex case - racing AI vs fallback...');
    
    try {
      const result = await Promise.race([
        this.generateWithAI(rows, query, userQuestion, schema_name, cacheKey),
        this.generateQuickFallback(rows, this.timeout, analysis)
      ]);

      console.log(`✅ Completed in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      console.error('❌ AI visualization error:', error);
      const result = await this.generateQuickFallback(rows, 0, analysis);
      console.log(`✅ Completed in ${Date.now() - startTime}ms (fallback)`);
      return result;
    }
  }

  /**
   * Check if data structure is simple enough to skip AI
   */
  isSimpleCase(columns, analysis) {
    // Simple case: 2-3 columns with clear date/category + numeric pattern
    if (columns.length > 4) return false;
    
    const hasNumeric = analysis.numericColumn !== null;
    const hasDateOrCategory = analysis.dateColumn !== null || analysis.categoryColumn !== null;
    
    return hasNumeric && hasDateOrCategory && columns.length <= 3;
  }

  /**
   * Generate cache key based on data structure
   */
  getCacheKey(rows, columns) {
    const sortedCols = columns.sort().join(',');
    const rowCount = Math.min(rows.length, 100); // Bucket row counts
    const analysis = this.quickAnalyze(rows, columns);
    
    return `${sortedCols}:${rowCount}:${!!analysis.dateColumn}:${!!analysis.categoryColumn}:${!!analysis.numericColumn}`;
  }

  /**
   * AI-powered generation with caching
   */
  async generateWithAI(rows, query, userQuestion, schema_name, cacheKey) {
    console.log('🤖 Generating AI-powered visualization...');
    const aiStartTime = Date.now();

    // Timeout promise
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI timeout')), this.timeout)
    );

    try {
      // Race AI vs timeout
      const plan = await Promise.race([
        this.planVisualizationsOptimized(rows, query, userQuestion, schema_name),
        timeoutPromise
      ]);

      // Cache the plan
      if (cacheKey) {
        this.cache.set(cacheKey, {
          plan,
          timestamp: Date.now()
        });
      }

      const visualizations = this.buildVisualizationsFromPlan(rows, plan);
      
      console.log(`✅ AI visualization completed in ${Date.now() - aiStartTime}ms`);
      return visualizations;

    } catch (error) {
      if (error.message === 'AI timeout') {
        console.log('⏱️ AI timed out, fallback will be used');
      }
      throw error;
    }
  }

  /**
   * Optimized AI planning (Strategy 4: Smaller prompt)
   */
  async planVisualizationsOptimized(rows, query, userQuestion, schema_name) {
    // Only send 3 sample rows
    const sampleRows = rows.slice(0, 3);
    const columns = Object.keys(rows[0]);
    const columnTypes = this.detectColumnTypes(rows, columns);

    // Compact prompt
    const prompt = `Analyze SQL results and create visualizations.

Schema: ${schema_name}
Question: "${userQuestion || 'N/A'}"
Rows: ${rows.length}
Columns: ${JSON.stringify(columnTypes)}

Sample:
${JSON.stringify(sampleRows, null, 2)}

Return JSON only:
{
  "default": "chart_id",
  "variants": [
    {"id": "table", "type": "table", "columns": [...]},
    {"id": "line", "type": "line", "x_column": "date", "y_column": "amount", "sort_by": "date"},
    {"id": "bar", "type": "bar", "x_column": "category", "y_column": "amount", "aggregation": "sum", "top_n": 10}
  ]
}

Rules:
- Date+numeric → line chart
- Category+numeric → bar/pie
- Limit categories to top 10
- Always include table`;

    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a data visualization expert. Return JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });

    const plan = JSON.parse(response.choices[0].message.content);
    return plan;
  }

  /**
   * Quick rule-based fallback (no AI)
   */
  async generateQuickFallback(rows, delay = 0, analysis = null) {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const fallbackStart = Date.now();
    console.log('⚡ Using quick fallback visualization...');

    const columns = Object.keys(rows[0]);
    const columnAnalysis = analysis || this.quickAnalyze(rows, columns);
    const variants = [];

    // Always add table
    variants.push({
      id: 'table',
      title: 'Data Table',
      visual: this.buildSimpleTable(rows)
    });

    // Line chart if has date + numeric
    if (columnAnalysis.dateColumn && columnAnalysis.numericColumn) {
      const lineChart = this.buildQuickLine(rows, columnAnalysis);
      if (lineChart) variants.push(lineChart);

      // Also add period bar
      variants.push({
        id: 'period_bar',
        title: 'By Period',
        visual: {
          ...lineChart.visual,
          chartType: 'bar'
        }
      });
    }

    // Bar chart if has category + numeric
    if (columnAnalysis.categoryColumn && columnAnalysis.numericColumn) {
      const barChart = this.buildQuickBar(rows, columnAnalysis);
      if (barChart) variants.push(barChart);

      // Pie chart if categories are 3-10
      const uniqueCategories = new Set(rows.map(r => r[columnAnalysis.categoryColumn])).size;
      if (uniqueCategories >= 3 && uniqueCategories <= 10) {
        const pieChart = this.buildQuickPie(rows, columnAnalysis);
        if (pieChart) variants.push(pieChart);
      }
    }

    // Determine default
    let defaultId = 'table';
    if (variants.some(v => v.id === 'line')) defaultId = 'line';
    else if (variants.some(v => v.id === 'bar')) defaultId = 'bar';
    else if (variants.some(v => v.id === 'pie')) defaultId = 'pie';

    const defaultVisual = variants.find(v => v.id === defaultId)?.visual;

    console.log(`✅ Fallback completed in ${Date.now() - fallbackStart}ms`);

    return {
      visual: defaultVisual,
      content: '',
      variants,
      default: defaultId
    };
  }

  /**
   * Quick analysis without AI
   */
  // quickAnalyze(rows, columns) {
  //   let dateColumn = null;
  //   let numericColumn = null;
  //   let categoryColumn = null;

  //   for (const col of columns) {
  //     const sample = rows[0][col];
      
  //     // Check date
  //     if (!dateColumn && this.looksLikeDate(col, sample)) {
  //       dateColumn = col;
  //     }
      
  //     // Check numeric
  //     if (!numericColumn && (typeof sample === 'number' || this.isNumericColumn(rows, col))) {
  //       numericColumn = col;
  //     }
      
  //     // Check category
  //     if (!categoryColumn && !dateColumn && typeof sample !== 'number') {
  //       const uniqueCount = new Set(rows.map(r => r[col])).size;
  //       if (uniqueCount >= 2 && uniqueCount <= 50 && uniqueCount < rows.length * 0.9) {
  //         categoryColumn = col;
  //       }
  //     }
  //   }

  //   return { dateColumn, numericColumn, categoryColumn };
  // }

  quickAnalyze(rows, columns) {
    let dateColumn = null;
    let numericColumn = null;
    let categoryColumn = null;

    // Priority scoring for each column
    const columnScores = columns.map(col => {
      const sample = rows[0][col];
      const allValues = rows.map(r => r[col]);
      const uniqueCount = new Set(allValues.filter(v => v !== null && v !== undefined)).size;
      
      let score = {
        col,
        isDate: false,
        isNumeric: false,
        isCategory: false,
        dateScore: 0,
        numericScore: 0,
        categoryScore: 0
      };

      // Check if DATE column
      const dateKeywords = ['date', 'time', 'created', 'updated', 'day', 'month', 'year', 'timestamp'];
      const nameLower = col.toLowerCase();
      const hasDateKeyword = dateKeywords.some(kw => nameLower.includes(kw));
      
      if (hasDateKeyword) {
        score.isDate = true;
        score.dateScore = 100;
      } else if (this.looksLikeDateValue(sample)) {
        score.isDate = true;
        score.dateScore = 80;
      }

      // Check if NUMERIC column
      const numericKeywords = ['amount', 'total', 'sum', 'count', 'price', 'value', 'revenue', 'cost', 'balance'];
      const hasNumericKeyword = numericKeywords.some(kw => nameLower.includes(kw));
      
      if (typeof sample === 'number') {
        score.isNumeric = true;
        score.numericScore = hasNumericKeyword ? 100 : 80;
      } else if (this.isNumericColumn(rows, col)) {
        score.isNumeric = true;
        score.numericScore = hasNumericKeyword ? 90 : 70;
      }

      // Check if CATEGORY column
      const categoryKeywords = ['category', 'type', 'name', 'detail', 'status', 'group', 'class', 'vendor', 'customer'];
      const hasCategoryKeyword = categoryKeywords.some(kw => nameLower.includes(kw));
      
      if (!score.isDate && !score.isNumeric) {
        const ratio = uniqueCount / rows.length;
        
        if (uniqueCount >= 2 && uniqueCount <= 50 && ratio < 0.9) {
          score.isCategory = true;
          score.categoryScore = hasCategoryKeyword ? 100 : 60;
          
          // Prefer columns with moderate cardinality
          if (uniqueCount >= 3 && uniqueCount <= 20) {
            score.categoryScore += 20;
          }
        }
      }

      return score;
  });

  // Select best columns
  const dateColumns = columnScores.filter(s => s.isDate).sort((a, b) => b.dateScore - a.dateScore);
  const numericColumns = columnScores.filter(s => s.isNumeric).sort((a, b) => b.numericScore - a.numericScore);
  const categoryColumns = columnScores.filter(s => s.isCategory).sort((a, b) => b.categoryScore - a.categoryScore);

  dateColumn = dateColumns[0]?.col || null;
  numericColumn = numericColumns[0]?.col || null;
  categoryColumn = categoryColumns[0]?.col || null;

  console.log('📊 Quick Analysis Results:');
  console.log(`   Date Column: ${dateColumn}`);
  console.log(`   Numeric Column: ${numericColumn}`);
  console.log(`   Category Column: ${categoryColumn}`);

  return { dateColumn, numericColumn, categoryColumn };
  }

  //new
  looksLikeDateValue(value) {
    if (!value) return false;
    
    const str = String(value);
    
    // ISO format: 2024-01-15 or 2024-01-15T10:30:00
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return true;
    
    // Common date formats
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) return true;
    if (/^\d{1,2}-\d{1,2}-\d{4}/.test(str)) return true;
    
    // Try parsing
    const date = new Date(value);
    const isValid = !isNaN(date.getTime());
    
    // Make sure it's a reasonable date (after 2000, before 2100)
    if (isValid) {
      const year = date.getFullYear();
      return year >= 2000 && year <= 2100;
    }
    
    return false;
  }


  /**
   * Check if column is numeric
   */
  isNumericColumn(rows, col) {
    const sample = rows.slice(0, Math.min(5, rows.length));
    const numericCount = sample.filter(r => {
      const val = r[col];
      return typeof val === 'number' || (!isNaN(Number(val)) && String(val).trim() !== '');
    }).length;
    
    return numericCount / sample.length >= 0.8;
  }

  /**
   * Check if looks like date
   */
  // looksLikeDate(colName, value) {
  //   const dateKeywords = ['date', 'time', 'created', 'updated', 'day', 'month', 'year'];
  //   const nameLower = colName.toLowerCase();
    
  //   if (dateKeywords.some(kw => nameLower.includes(kw))) return true;
    
  //   if (!value) return false;
    
  //   const str = String(value);
  //   if (/^\d{4}-\d{2}-\d{2}/.test(str)) return true;
    
  //   const date = new Date(value);
  //   return !isNaN(date.getTime());
  // }

  looksLikeDate(colName, value) {
    const dateKeywords = ['date', 'time', 'created', 'updated', 'day', 'month', 'year', 'timestamp'];
    const nameLower = colName.toLowerCase();
    
    if (dateKeywords.some(kw => nameLower.includes(kw))) return true;
    
    return this.looksLikeDateValue(value);
  }

  /**
   * Build simple table
   */
  buildSimpleTable(rows) {
    const columns = Object.keys(rows[0]);
    const labels = columns.map(col => this.humanize(col));
    
    const data = rows.map(row =>
      columns.map(col => this.formatValue(row[col]))
    );

    return {
      type: 'table',
      labels,
      data
    };
  }

  /**
   * Quick line chart builder
   */
  // buildQuickLine(rows, analysis) {
  //   const { dateColumn, numericColumn } = analysis;
    
  //   const sorted = [...rows].sort((a, b) => 
  //     new Date(a[dateColumn]) - new Date(b[dateColumn])
  //   );

  //   const labels = sorted.map(r => this.formatDate(r[dateColumn]));
  //   const data = sorted.map(r => this.roundNumber(Number(r[numericColumn])));
  //   const formatted = data.map(v => this.formatCurrency(v));

  //   return {
  //     id: 'line',
  //     title: 'Trend Over Time',
  //     visual: {
  //       type: 'chart',
  //       chartType: 'line',
  //       labels,
  //       data,
  //       axis_labels: {
  //         x: this.humanize(dateColumn),
  //         y: this.humanize(numericColumn)
  //       },
  //       extra: { formatted }
  //     }
  //   };
  // }

  buildQuickLine(rows, analysis) {
  const { dateColumn, numericColumn } = analysis;
  
  if (!dateColumn || !numericColumn) {
    console.log('⚠️ Missing date or numeric column for line chart');
    return null;
  }

  console.log(`📊 Building line chart: ${dateColumn} vs ${numericColumn}`);
  
  // Sort by date
  const sorted = [...rows].sort((a, b) => {
    const dateA = new Date(a[dateColumn]);
    const dateB = new Date(b[dateColumn]);
    return dateA - dateB;
  });

  const labels = sorted.map(r => this.formatDate(r[dateColumn]));
  const data = sorted.map(r => this.roundNumber(Number(r[numericColumn])));
  const formatted = data.map(v => this.formatCurrency(v));

  return {
    id: 'line',
    title: 'Trend Over Time',
    visual: {
      type: 'chart',
      chartType: 'line',
      labels,
      data,
      axis_labels: {
        x: this.humanize(dateColumn),
        y: this.humanize(numericColumn)
      },
      extra: { formatted }
    }
  };
}

  /**
   * Quick bar chart builder
   */
  // buildQuickBar(rows, analysis) {
  //   const { categoryColumn, numericColumn } = analysis;
    
  //   // Aggregate
  //   const totals = new Map();
  //   for (const row of rows) {
  //     const cat = row[categoryColumn];
  //     const val = Number(row[numericColumn]);
  //     if (cat && Number.isFinite(val)) {
  //       totals.set(cat, (totals.get(cat) || 0) + val);
  //     }
  //   }

  //   // Sort by value desc and limit to top 10
  //   let entries = [...totals.entries()]
  //     .sort((a, b) => b[1] - a[1])
  //     .slice(0, 10);
    
  //   // Add "Other" if needed
  //   if (totals.size > 10) {
  //     const remaining = [...totals.entries()].slice(10);
  //     const otherSum = remaining.reduce((sum, [_, v]) => sum + v, 0);
  //     if (otherSum > 0) {
  //       entries.push(['Other', otherSum]);
  //     }
  //   }

  //   const labels = entries.map(([k, _]) => String(k));
  //   const data = entries.map(([_, v]) => this.roundNumber(v));
  //   const formatted = data.map(v => this.formatCurrency(v));

  //   return {
  //     id: 'bar',
  //     title: 'By Category',
  //     visual: {
  //       type: 'chart',
  //       chartType: 'bar',
  //       labels,
  //       data,
  //       axis_labels: {
  //         x: this.humanize(categoryColumn),
  //         y: this.humanize(numericColumn)
  //       },
  //       extra: { formatted }
  //     }
  //   };
  // }

  buildQuickBar(rows, analysis) {
    const { categoryColumn, numericColumn } = analysis;
    
    if (!categoryColumn || !numericColumn) {
      console.log('⚠️ Missing category or numeric column for bar chart');
      return null;
    }

    console.log(`📊 Building bar chart: ${categoryColumn} vs ${numericColumn}`);
    
    // Aggregate
    const totals = new Map();
    for (const row of rows) {
      const cat = row[categoryColumn];
      const val = Number(row[numericColumn]);
      if ((cat !== null && cat !== undefined && cat !== '') && Number.isFinite(val)) {
        totals.set(String(cat), (totals.get(String(cat)) || 0) + val);
      }
    }

    if (totals.size === 0) {
      console.log('⚠️ No data to aggregate for bar chart');
      return null;
    }

    // Sort by value desc and limit to top 10
    let entries = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    // Add "Other" if needed
    if (totals.size > 10) {
      const remaining = [...totals.entries()].slice(10);
      const otherSum = remaining.reduce((sum, [_, v]) => sum + v, 0);
      if (otherSum > 0) {
        entries.push(['Other', otherSum]);
      }
    }

    const labels = entries.map(([k, _]) => k);
    const data = entries.map(([_, v]) => this.roundNumber(v));
    const formatted = data.map(v => this.formatCurrency(v));

    return {
      id: 'bar',
      title: 'By Category',
      visual: {
        type: 'chart',
        chartType: 'bar',
        labels,
        data,
        axis_labels: {
          x: this.humanize(categoryColumn),
          y: this.humanize(numericColumn)
        },
        extra: { formatted }
      }
    };
  }

  /**
   * Quick pie chart builder
   */
  // buildQuickPie(rows, analysis) {
  //   const { categoryColumn, numericColumn } = analysis;
    
  //   // Aggregate
  //   const totals = new Map();
  //   for (const row of rows) {
  //     const cat = row[categoryColumn];
  //     const val = Number(row[numericColumn]);
  //     if (cat && Number.isFinite(val)) {
  //       totals.set(cat, (totals.get(cat) || 0) + val);
  //     }
  //   }

  //   // Sort and limit to top 8
  //   let entries = [...totals.entries()]
  //     .sort((a, b) => b[1] - a[1])
  //     .slice(0, 8);
    
  //   // Add "Other" if needed
  //   if (totals.size > 8) {
  //     const remaining = [...totals.entries()].slice(8);
  //     const otherSum = remaining.reduce((sum, [_, v]) => sum + v, 0);
  //     const totalSum = [...totals.values()].reduce((a, b) => a + b, 0);
      
  //     if (otherSum / totalSum >= 0.05) {
  //       entries.push(['Other', otherSum]);
  //     }
  //   }

  //   // Pie needs 3-10 slices
  //   if (entries.length < 3 || entries.length > 10) {
  //     return null;
  //   }

  //   const labels = entries.map(([k, _]) => String(k));
  //   const data = entries.map(([_, v]) => this.roundNumber(v));
  //   const formatted = data.map(v => this.formatCurrency(v));

  //   return {
  //     id: 'pie',
  //     title: 'Distribution',
  //     visual: {
  //       type: 'chart',
  //       chartType: 'pie',
  //       labels,
  //       data,
  //       extra: { formatted }
  //     }
  //   };
  // }

  buildQuickPie(rows, analysis) {
  const { categoryColumn, numericColumn } = analysis;
  
  if (!categoryColumn || !numericColumn) {
    console.log('⚠️ Missing category or numeric column for pie chart');
    return null;
  }

  console.log(`📊 Building pie chart: ${categoryColumn} vs ${numericColumn}`);
  
  // Aggregate
  const totals = new Map();
  for (const row of rows) {
    const cat = row[categoryColumn];
    const val = Number(row[numericColumn]);
    if ((cat !== null && cat !== undefined && cat !== '') && Number.isFinite(val)) {
      totals.set(String(cat), (totals.get(String(cat)) || 0) + val);
    }
  }

  if (totals.size === 0) {
    console.log('⚠️ No data to aggregate for pie chart');
    return null;
  }

  // Sort and limit to top 8
  let entries = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  
  // Add "Other" if needed
  if (totals.size > 8) {
    const remaining = [...totals.entries()].slice(8);
    const otherSum = remaining.reduce((sum, [_, v]) => sum + v, 0);
    const totalSum = [...totals.values()].reduce((a, b) => a + b, 0);
    
    if (otherSum / totalSum >= 0.05) {
      entries.push(['Other', otherSum]);
    }
  }

  // Pie needs 3-10 slices
  if (entries.length < 3 || entries.length > 10) {
    console.log(`⚠️ Pie chart needs 3-10 slices, got ${entries.length}`);
    return null;
  }

  const labels = entries.map(([k, _]) => k);
  const data = entries.map(([_, v]) => this.roundNumber(v));
  const formatted = data.map(v => this.formatCurrency(v));

  return {
    id: 'pie',
    title: 'Distribution',
    visual: {
      type: 'chart',
      chartType: 'pie',
      labels,
      data,
      extra: { formatted }
    }
  };
}

  /**
   * Build visualizations from AI plan
   */
  buildVisualizationsFromPlan(rows, plan) {
    const variants = [];

    for (const variantPlan of plan.variants || []) {
      let visual = null;

      switch (variantPlan.type) {
        case 'table':
          visual = this.buildTable(rows, variantPlan);
          break;
        case 'line':
          visual = this.buildLineChart(rows, variantPlan);
          break;
        case 'bar':
          visual = this.buildBarChart(rows, variantPlan);
          break;
        case 'period_bar':
          visual = this.buildPeriodBar(rows, variantPlan);
          break;
        case 'pie':
          visual = this.buildPieChart(rows, variantPlan);
          break;
      }

      if (visual) {
        variants.push({
          id: variantPlan.id,
          title: variantPlan.title,
          visual
        });
      }
    }

    const defaultId = plan.default || 'table';
    const defaultVisual = variants.find(v => v.id === defaultId)?.visual;

    return {
      visual: defaultVisual,
      content: plan.reasoning || '',
      variants,
      default: defaultId
    };
  }

  /**
   * Build table from AI plan
   */
  buildTable(rows, plan) {
    const columns = plan.columns || Object.keys(rows[0]);
    const labels = columns.map(col => this.humanize(col));
    
    const data = rows.map(row =>
      columns.map(col => this.formatValue(row[col]))
    );

    return {
      type: 'table',
      labels,
      data
    };
  }

  /**
   * Build line chart from AI plan
   */
  buildLineChart(rows, plan) {
    const { x_column, y_column, sort_by, sort_order = 'asc' } = plan;

    let sorted = [...rows];
    if (sort_by) {
      sorted.sort((a, b) => {
        const aVal = a[sort_by];
        const bVal = b[sort_by];
        
        const aDate = new Date(aVal);
        const bDate = new Date(bVal);
        
        if (!isNaN(aDate) && !isNaN(bDate)) {
          return sort_order === 'asc' ? aDate - bDate : bDate - aDate;
        }
        
        return sort_order === 'asc' ? 
          (aVal > bVal ? 1 : -1) : 
          (aVal < bVal ? 1 : -1);
      });
    }

    const labels = sorted.map(r => this.formatValue(r[x_column]));
    const data = sorted.map(r => this.roundNumber(Number(r[y_column])));
    const formatted = data.map(v => this.formatCurrency(v));

    return {
      type: 'chart',
      chartType: 'line',
      labels,
      data,
      axis_labels: {
        x: this.humanize(x_column),
        y: this.humanize(y_column)
      },
      extra: { formatted }
    };
  }

  /**
   * Build period bar from AI plan
   */
  buildPeriodBar(rows, plan) {
    const lineChart = this.buildLineChart(rows, plan);
    return {
      ...lineChart,
      chartType: 'bar'
    };
  }

  /**
   * Build bar chart from AI plan
   */
  buildBarChart(rows, plan) {
    const { 
      x_column, 
      y_column, 
      aggregation = 'sum', 
      sort_by = 'value',
      sort_order = 'desc',
      top_n = 10
    } = plan;

    const aggregated = this.aggregate(rows, x_column, y_column, aggregation);

    let entries = [...aggregated.entries()];
    if (sort_by === 'value') {
      entries.sort((a, b) => sort_order === 'asc' ? a[1] - b[1] : b[1] - a[1]);
    }

    if (top_n && entries.length > top_n) {
      const head = entries.slice(0, top_n);
      const tail = entries.slice(top_n);
      const otherSum = tail.reduce((sum, [_, v]) => sum + v, 0);
      
      entries = head;
      if (otherSum > 0) {
        entries.push(['Other', otherSum]);
      }
    }

    const labels = entries.map(([k, _]) => String(k));
    const data = entries.map(([_, v]) => this.roundNumber(v));
    const formatted = data.map(v => this.formatCurrency(v));

    return {
      type: 'chart',
      chartType: 'bar',
      labels,
      data,
      axis_labels: {
        x: this.humanize(x_column),
        y: this.humanize(y_column)
      },
      extra: { formatted }
    };
  }

  /**
   * Build pie chart from AI plan
   */
  buildPieChart(rows, plan) {
    const { 
      category_column, 
      value_column, 
      aggregation = 'sum',
      top_n = 8 
    } = plan;

    const aggregated = this.aggregate(rows, category_column, value_column, aggregation);
    let entries = [...aggregated.entries()].sort((a, b) => b[1] - a[1]);

    if (entries.length > top_n) {
      const head = entries.slice(0, top_n);
      const tail = entries.slice(top_n);
      const otherSum = tail.reduce((sum, [_, v]) => sum + v, 0);
      
      entries = head;
      if (otherSum > 0) {
        entries.push(['Other', otherSum]);
      }
    }

    if (entries.length < 3 || entries.length > 10) {
      return null;
    }

    const labels = entries.map(([k, _]) => String(k));
    const data = entries.map(([_, v]) => this.roundNumber(v));
    const formatted = data.map(v => this.formatCurrency(v));

    return {
      type: 'chart',
      chartType: 'pie',
      labels,
      data,
      extra: { formatted }
    };
  }

  /**
   * Aggregate data
   */
  aggregate(rows, categoryColumn, valueColumn, method = 'sum') {
    const groups = new Map();

    for (const row of rows) {
      const category = row[categoryColumn];
      if (category === null || category === undefined || category === '') continue;

      const value = Number(row[valueColumn]);
      if (!Number.isFinite(value)) continue;

      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category).push(value);
    }

    const result = new Map();
    for (const [category, values] of groups.entries()) {
      let aggregatedValue = 0;

      switch (method) {
        case 'sum':
          aggregatedValue = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'count':
          aggregatedValue = values.length;
          break;
        case 'min':
          aggregatedValue = Math.min(...values);
          break;
        case 'max':
          aggregatedValue = Math.max(...values);
          break;
        default:
          aggregatedValue = values.reduce((a, b) => a + b, 0);
      }

      result.set(category, aggregatedValue);
    }

    return result;
  }

  /**
   * Detect column types
   */
  detectColumnTypes(rows, columns) {
    const types = {};
    const sampleSize = Math.min(5, rows.length);

    for (const col of columns) {
      const samples = rows.slice(0, sampleSize).map(r => r[col]);
      
      let isDate = false;
      let isNumeric = false;

      const dateCount = samples.filter(v => {
        if (!v) return false;
        const d = new Date(v);
        return !isNaN(d.getTime());
      }).length;
      
      isDate = dateCount / sampleSize >= 0.7;

      const numericCount = samples.filter(v => {
        return typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '');
      }).length;
      
      isNumeric = numericCount / sampleSize >= 0.8;

      types[col] = {
        is_date: isDate,
        is_numeric: isNumeric,
        sample: samples[0]
      };
    }

    return types;
  }

  /**
   * Format value
   */
  formatValue(value) {
    if (value === null || value === undefined) return '';
    
    const date = new Date(value);
    if (!isNaN(date.getTime()) && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return this.formatDate(value);
    }

    if (typeof value === 'number') {
      return this.formatCurrency(value);
    }

    return String(value);
  }

  /**
   * Format date
   */
  // formatDate(value) {
  //   if (!value) return '';
    
  //   try {
  //     const date = new Date(value);
  //     if (isNaN(date.getTime())) return String(value);
      
  //     return date.toISOString().split('T')[0];
  //   } catch (e) {
  //     return String(value);
  //   }
  // }

  formatDate(value) {
    if (!value) return '';
    
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return String(value);
      
      // Check if it's a valid year (not 1969/1970 which indicates timestamp issue)
      const year = date.getFullYear();
      if (year < 2000 || year > 2100) {
        // Might be a timestamp in milliseconds or malformed date
        return String(value);
      }
      
      // Return ISO format date (YYYY-MM-DD)
      return date.toISOString().split('T')[0];
    } catch (e) {
      return String(value);
    }
  }

  /**
   * Format currency
   */
  formatCurrency(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  /**
   * Round number
   */
  roundNumber(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
  }

  /**
   * Humanize column name
   */
  humanize(columnName) {
    if (!columnName) return '';
    
    return String(columnName)
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

export default AIVisualizer;


