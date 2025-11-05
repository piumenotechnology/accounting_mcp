// src/services/ai-visualizer.js
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class AIVisualizer {
  constructor() {
    this.model = 'gpt-4o-mini'; // Fast and cheap
  }

  /**
   * Main method: Analyze SQL results and generate visualization config
   */
  async generateVisualization(data) {
    const { rows, query, userQuestion = '', schema_name } = data;

    if (!rows || rows.length === 0) {
      return {
        visual: null,
        content: '',
        variants: [],
        default: null
      };
    }

    // Less than 3 rows? Return table only
    if (rows.length < 3) {
      return {
        visual: null,
        content: '',
        variants: [],
        default: null
      };
    }

    try {
      // Step 1: Ask AI to analyze and plan visualizations
      const vizPlan = await this.planVisualizations(rows, query, userQuestion, schema_name);

      // Step 2: Execute AI's plan and build actual chart data
      const visualizations = this.buildVisualizationsFromPlan(rows, vizPlan);

      return visualizations;

    } catch (error) {
      console.error('❌ AI Visualization error:', error);
      
      // Fallback: return table only
      return {
        visual: this.buildSimpleTable(rows),
        content: '',
        variants: [
          {
            id: 'table',
            title: 'Table',
            visual: this.buildSimpleTable(rows)
          }
        ],
        default: 'table'
      };
    }
  }

  /**
   * Step 1: AI analyzes data and creates visualization plan
   */
  async planVisualizations(rows, query, userQuestion, schema_name) {
    // Prepare data sample (first 5 rows to save tokens)
    const sampleRows = rows.slice(0, 5);
    const columns = Object.keys(rows[0]);
    const rowCount = rows.length;

    // Detect column types by sampling
    const columnTypes = this.detectColumnTypes(rows, columns);

    const prompt = `You are a data visualization expert. Analyze this SQL query result and create the best visualizations.

**Context:**
- Schema: ${schema_name}
- User Question: "${userQuestion || 'Not provided'}"
- SQL Query: ${query}
- Total Rows: ${rowCount}
- Columns: ${JSON.stringify(columnTypes, null, 2)}

**Sample Data (first 5 rows):**
${JSON.stringify(sampleRows, null, 2)}

**Your Task:**
1. Analyze the data structure and user intent
2. Recommend the best default visualization
3. Suggest 2-4 alternative visualization variants
4. For each visualization, specify:
   - Chart type (table, line, bar, pie, period_bar)
   - Which columns to use for X and Y axis
   - Aggregation needed (sum, count, avg, none)
   - Sorting/ordering requirements
   - Top N limit for categories (if applicable)

**Rules:**
- If data has dates + numeric values → line chart or period_bar for trends
- If data has categories + numeric values → bar chart or pie for comparison
- If categories > 10 → use "top_n" to limit and group rest as "Other"
- Always include a table variant
- Pie charts work best with 3-10 categories
- Choose chart type based on user intent (trends vs comparison vs distribution)

**Response Format (JSON only):**
{
  "reasoning": "Brief explanation of your choices",
  "default": "chart_id",
  "variants": [
    {
      "id": "table",
      "title": "Data Table",
      "type": "table",
      "columns": ["col1", "col2", "col3"]
    },
    {
      "id": "line",
      "title": "Trend Over Time",
      "type": "line",
      "x_column": "date",
      "y_column": "amount",
      "sort_by": "date",
      "sort_order": "asc",
      "aggregation": "none"
    },
    {
      "id": "bar",
      "title": "By Category",
      "type": "bar",
      "x_column": "category",
      "y_column": "amount",
      "aggregation": "sum",
      "sort_by": "value",
      "sort_order": "desc",
      "top_n": 10
    },
    {
      "id": "pie",
      "title": "Distribution",
      "type": "pie",
      "category_column": "vendor",
      "value_column": "amount",
      "aggregation": "sum",
      "top_n": 8
    }
  ]
}

Return ONLY valid JSON, no markdown or explanations outside the JSON.`;

    console.log('🤖 Asking AI to plan visualizations...');

    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a data visualization expert. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    const plan = JSON.parse(content);

    console.log('✅ AI Visualization Plan:');
    console.log(`   Reasoning: ${plan.reasoning}`);
    console.log(`   Default: ${plan.default}`);
    console.log(`   Variants: ${plan.variants?.map(v => v.id).join(', ')}`);

    return plan;
  }

  /**
   * Step 2: Execute AI's plan and build actual visualizations
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

    // Find default visual
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
   * Build table visualization
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
   * Build line chart
   */
  buildLineChart(rows, plan) {
    const { x_column, y_column, sort_by, sort_order = 'asc' } = plan;

    // Sort data
    let sorted = [...rows];
    if (sort_by) {
      sorted.sort((a, b) => {
        const aVal = a[sort_by];
        const bVal = b[sort_by];
        
        // Try date comparison first
        const aDate = new Date(aVal);
        const bDate = new Date(bVal);
        
        if (!isNaN(aDate) && !isNaN(bDate)) {
          return sort_order === 'asc' ? aDate - bDate : bDate - aDate;
        }
        
        // Fallback to regular comparison
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
   * Build period bar chart (time series as bars)
   */
  buildPeriodBar(rows, plan) {
    const lineChart = this.buildLineChart(rows, plan);
    return {
      ...lineChart,
      chartType: 'bar'
    };
  }

  /**
   * Build bar chart with aggregation
   */
  buildBarChart(rows, plan) {
    const { 
      x_column, 
      y_column, 
      aggregation = 'sum', 
      sort_by = 'value',
      sort_order = 'desc',
      top_n 
    } = plan;

    // Aggregate data
    const aggregated = this.aggregate(rows, x_column, y_column, aggregation);

    // Sort
    let entries = [...aggregated.entries()];
    if (sort_by === 'value') {
      entries.sort((a, b) => sort_order === 'asc' ? a[1] - b[1] : b[1] - a[1]);
    } else {
      entries.sort((a, b) => {
        const comparison = String(a[0]).localeCompare(String(b[0]));
        return sort_order === 'asc' ? comparison : -comparison;
      });
    }

    // Apply top_n and "Other"
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
   * Build pie chart with aggregation
   */
  buildPieChart(rows, plan) {
    const { 
      category_column, 
      value_column, 
      aggregation = 'sum',
      top_n = 8 
    } = plan;

    // Aggregate
    const aggregated = this.aggregate(rows, category_column, value_column, aggregation);

    // Sort by value desc
    let entries = [...aggregated.entries()].sort((a, b) => b[1] - a[1]);

    // Top N with "Other"
    if (entries.length > top_n) {
      const head = entries.slice(0, top_n);
      const tail = entries.slice(top_n);
      const otherSum = tail.reduce((sum, [_, v]) => sum + v, 0);
      
      entries = head;
      if (otherSum > 0) {
        entries.push(['Other', otherSum]);
      }
    }

    // Pie charts need 3-10 slices
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
   * Aggregate data by category
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
   * Simple table fallback
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
   * Detect column types from sample data
   */
  detectColumnTypes(rows, columns) {
    const types = {};
    const sampleSize = Math.min(10, rows.length);

    for (const col of columns) {
      const samples = rows.slice(0, sampleSize).map(r => r[col]);
      
      let isDate = false;
      let isNumeric = false;
      let isCategorical = false;

      // Check if date
      const dateCount = samples.filter(v => {
        if (!v) return false;
        const d = new Date(v);
        return !isNaN(d.getTime());
      }).length;
      
      isDate = dateCount / sampleSize >= 0.7;

      // Check if numeric
      const numericCount = samples.filter(v => {
        return typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '');
      }).length;
      
      isNumeric = numericCount / sampleSize >= 0.8;

      // Check if categorical
      const uniqueValues = new Set(samples.filter(v => v !== null && v !== undefined));
      const distinctRatio = uniqueValues.size / samples.length;
      isCategorical = !isDate && !isNumeric && distinctRatio < 0.9 && uniqueValues.size >= 2;

      types[col] = {
        is_date: isDate,
        is_numeric: isNumeric,
        is_categorical: isCategorical,
        sample_value: samples[0],
        distinct_count: uniqueValues.size
      };
    }

    return types;
  }

  /**
   * Format value for display
   */
  formatValue(value) {
    if (value === null || value === undefined) return '';
    
    // Try date formatting
    const date = new Date(value);
    if (!isNaN(date.getTime()) && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return date.toISOString().split('T')[0];
    }

    // Try number formatting
    if (typeof value === 'number') {
      return this.formatCurrency(value);
    }

    return String(value);
  }

  /**
   * Format as currency
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