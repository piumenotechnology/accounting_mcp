// src/services/ai-visualizer.js
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class AIVisualizer {
  constructor() {
    this.model = 'gpt-4.1-mini';
  }

  /**
   * Main method: Analyze SQL results and generate visualization config
   */
  async generateVisualization(data) {
    const { rows, query, userQuestion = '', schema_name } = data;

    if (!rows || rows.length === 0) {
      return [];
    }

    if (rows.length < 3) {
      return [];
    }

    try {
      // Quick local analysis
      const columnAnalysis = this.analyzeColumnsFromData(rows);
      
      // Let AI decide everything based on actual data
      const vizPlan = await this.planVisualizationsDynamic(
        rows, 
        query, 
        userQuestion, 
        schema_name,
        columnAnalysis
      );

      // Build charts from AI's plan and return only variants
      const variants = this.buildVariantsFromPlan(rows, vizPlan, columnAnalysis);

      return variants;

    } catch (error) {
      console.error('❌ AI Visualization error:', error);
      
      // Fallback: return table only
      return [
        {
          id: 'table',
          title: 'Table',
          visual: this.buildSimpleTable(rows)
        }
      ];
    }
  }

  /**
   * DYNAMIC: Analyze whatever columns exist in the data
   */
  analyzeColumnsFromData(rows) {
    const columns = Object.keys(rows[0]);
    const analysis = {};
    const sampleSize = Math.min(15, rows.length);

    for (const col of columns) {
      const samples = rows.slice(0, sampleSize)
        .map(r => r[col])
        .filter(v => v !== null && v !== undefined && v !== '');
      
      if (samples.length === 0) {
        analysis[col] = { 
          type: 'empty', 
          priority: 0,
          uniqueCount: 0,
          sampleValues: []
        };
        continue;
      }

      const uniqueValues = new Set(samples);
      const distinctRatio = uniqueValues.size / samples.length;

      // Type detection with scoring
      const scores = {
        date: this.scoreDateColumn(samples),
        numeric: this.scoreNumericColumn(samples),
        currency: this.scoreCurrencyColumn(samples),
        identifier: this.scoreIdentifierColumn(col, samples),
        category: this.scoreCategoryColumn(samples, uniqueValues.size, rows.length),
        text: this.scoreTextColumn(samples, distinctRatio)
      };

      // Get best type
      const bestType = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])[0];

      // Calculate priority for chart usage
      let priority = bestType[1];
      
      // Boost priority for good chart columns
      if (bestType[0] === 'date') priority += 2;
      if (bestType[0] === 'numeric' || bestType[0] === 'currency') priority += 1.5;
      if (bestType[0] === 'category' && uniqueValues.size >= 2 && uniqueValues.size <= 20) priority += 1;
      
      // Lower priority for identifiers
      if (bestType[0] === 'identifier') priority = 0.1;

      analysis[col] = {
        type: bestType[0],
        confidence: bestType[1],
        priority,
        uniqueCount: uniqueValues.size,
        distinctRatio,
        sampleValues: Array.from(uniqueValues).slice(0, 5),
        totalRows: rows.length
      };
    }

    return analysis;
  }

  /**
   * Score if column is a date
   */
  scoreDateColumn(samples) {
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}/, // 2023-01-15
      /^\d{2}\/\d{2}\/\d{4}/, // 01/15/2023
      /^\d{4}\/\d{2}\/\d{2}/, // 2023/01/15
    ];

    let dateCount = 0;
    for (const val of samples) {
      const str = String(val);
      const matchesPattern = datePatterns.some(p => p.test(str));
      
      if (matchesPattern) {
        const d = this.parseDate(val);
        if (d && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
          dateCount++;
        }
      }
    }

    return dateCount / samples.length;
  }

  /**
   * Parse date using UTC and handle timezone-shifted dates
   * Backend converts: 2025-01-01 00:00:00+0800 → 2024-12-31T16:00:00.000Z
   * We want to show: 2025-01-01 (the original date in SQL)
   */
  parseDate(dateString) {
    if (!dateString) return null;
    
    const str = String(dateString);
    
    // Extract YYYY-MM-DD part
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [_, year, month, day] = match;
      
      // Check if this is a UTC timestamp that's been timezone-shifted
      // Pattern: ends with 16:00:00.000Z (midnight in +8 timezone)
      const isShiftedFromPlus8 = str.match(/T16:00:00\.000Z$/);
      
      if (isShiftedFromPlus8) {
        // Add 8 hours back to get original date
        const d = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 16));
        // Shift forward 8 hours
        d.setUTCHours(d.getUTCHours() + 8);
        return d;
      }
      
      // Regular date parsing in UTC
      const d = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
      return isNaN(d.getTime()) ? null : d;
    }
    
    return null;
  }

  /**
   * Score if column is numeric (not currency, not ID)
   */
  scoreNumericColumn(samples) {
    let numericCount = 0;
    const numbers = [];

    for (const val of samples) {
      // Skip if it looks like currency
      if (String(val).includes('$')) continue;
      
      const num = Number(val);
      if (!isNaN(num) && isFinite(num)) {
        numericCount++;
        numbers.push(num);
      }
    }

    const ratio = numericCount / samples.length;
    
    // Penalize if looks like an ID (low variance)
    if (numbers.length > 1 && ratio > 0.8) {
      const hasVariance = this.hasGoodVariance(numbers);
      return hasVariance ? ratio : ratio * 0.3;
    }

    return ratio;
  }

  /**
   * Score if column contains currency values
   */
  scoreCurrencyColumn(samples) {
    let currencyCount = 0;

    for (const val of samples) {
      const str = String(val);
      // Look for $, commas, or .00 endings
      const hasCurrencyMarkers = str.includes('$') || 
                                 (str.includes(',') && str.includes('.')) ||
                                 /\.\d{2}$/.test(str);
      
      if (hasCurrencyMarkers) {
        const cleaned = str.replace(/[$,]/g, '');
        if (!isNaN(Number(cleaned))) {
          currencyCount++;
        }
      }
    }

    return currencyCount / samples.length;
  }

  /**
   * Score if column is an identifier (ID, code, number)
   */
  scoreIdentifierColumn(columnName, samples) {
    const name = columnName.toLowerCase();
    const idKeywords = ['id', '_id', 'code', 'number', 'key', 'ref'];
    
    let score = 0;

    // Check name
    if (idKeywords.some(keyword => name.includes(keyword))) {
      score += 0.6;
    }

    // Check if numeric with low variance
    const numbers = samples.map(v => Number(v)).filter(n => !isNaN(n));
    if (numbers.length / samples.length > 0.8) {
      if (!this.hasGoodVariance(numbers)) {
        score += 0.4;
      }
    }

    return Math.min(score, 1);
  }

  /**
   * Score if column is categorical
   */
  scoreCategoryColumn(samples, uniqueCount, totalRows) {
    // Good categories: 2-50 unique values, repeated values
    if (uniqueCount < 2 || uniqueCount > 50) return 0;

    const repeatRatio = 1 - (uniqueCount / samples.length);
    const sizeRatio = uniqueCount / totalRows;

    // Best when values repeat and not too many unique
    if (repeatRatio > 0.3 && sizeRatio < 0.8) {
      return 0.7 + (repeatRatio * 0.3);
    }

    return repeatRatio * 0.5;
  }

  /**
   * Score if column is text
   */
  scoreTextColumn(samples, distinctRatio) {
    // High distinctRatio = mostly unique values = likely text
    if (distinctRatio > 0.8) {
      return distinctRatio * 0.6;
    }
    return 0;
  }

  /**
   * Check if numbers have good variance (not an ID)
   */
  hasGoodVariance(numbers) {
    if (numbers.length < 2) return true;

    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    if (mean === 0) return false;

    const variance = numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / Math.abs(mean);

    return coefficientOfVariation > 0.15; // Has meaningful variance
  }

  /**
   * DYNAMIC: Let AI analyze the actual data structure
   */
  async planVisualizationsDynamic(rows, query, userQuestion, schema_name, columnAnalysis) {
    const sampleRows = rows.slice(0, 3);
    const rowCount = rows.length;

    // Build dynamic column insights
    const columnInsights = Object.entries(columnAnalysis)
      .sort((a, b) => b[1].priority - a[1].priority)
      .map(([col, info]) => {
        return {
          column_name: col,
          type: info.type,
          priority: info.priority.toFixed(2),
          unique_values: info.uniqueCount,
          sample: info.sampleValues.slice(0, 3)
        };
      });

    const prompt = `You are a data visualization expert. Analyze this RANDOM dataset and create the best visualizations.

**Dataset Context:**
- Total Rows: ${rowCount}
- User Question: "${userQuestion || 'Analyze this data'}"
- SQL Query: ${query}

**Column Analysis (auto-detected from data):**
${JSON.stringify(columnInsights, null, 2)}

**Sample Data:**
${JSON.stringify(sampleRows, null, 2)}

**Your Task:**
Analyze the ACTUAL columns present and create:
1. A descriptive default visualization
2. 2-4 alternative views
3. Use ACTUAL column names from the data
4. Create human-readable titles dynamically

**Chart Selection Guide:**
- DATE column + NUMERIC/CURRENCY → Line chart (time trend)
- CATEGORY + NUMERIC/CURRENCY → Bar chart (comparison)
- CATEGORY (3-10 unique) + NUMERIC/CURRENCY → Pie chart (distribution)
- IDENTIFIER columns (IDs, codes) → DO NOT use for axes, only in table
- Many categories (>10) → Use top_n: 10
- Numeric with high variance → Good for Y axis
- Dates → Always sort chronologically

**Response Format (JSON):**
{
  "reasoning": "Brief explanation of chart choices based on actual data",
  "default": "chart_id",
  "variants": [
    {
      "id": "table",
      "title": "Data Table",
      "type": "table"
    },
    {
      "id": "unique_id",
      "title": "Dynamic Title Based on Columns (e.g., 'Revenue by Category')",
      "type": "line|bar|pie",
      "x_column": "exact_column_name_from_data",
      "y_column": "exact_column_name_from_data",
      "aggregation": "sum|avg|count|none",
      "sort_by": "x_column|y_column|value",
      "sort_order": "asc|desc",
      "top_n": 10
    }
  ]
}

CRITICAL: 
- Use exact column names as they appear in the data
- Prioritize columns with high priority scores
- Create descriptive titles that explain what the chart shows
- Avoid using identifier columns (type: "identifier") for chart axes

Return ONLY valid JSON.`;

    console.log('🤖 AI analyzing data structure...');

    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a data visualization expert. Analyze the actual data structure and respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Very low for consistent column selection
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    const plan = JSON.parse(content);

    console.log('✅ Dynamic Visualization Plan:');
    console.log(`   Reasoning: ${plan.reasoning}`);
    console.log(`   Default: ${plan.default}`);
    console.log(`   Charts: ${plan.variants?.map(v => `${v.id} (${v.type})`).join(', ')}`);

    return plan;
  }

  /**
   * Build variants array from AI's dynamic plan
   */
  buildVariantsFromPlan(rows, plan, columnAnalysis) {
    const variants = [];

    for (const variantPlan of plan.variants || []) {
      let visual = null;

      // Validate columns exist in data
      const availableColumns = Object.keys(rows[0]);
      const xColumn = variantPlan.x_column;
      const yColumn = variantPlan.y_column;
      const categoryColumn = variantPlan.category_column;
      const valueColumn = variantPlan.value_column;

      // Skip if required columns don't exist
      if (xColumn && !availableColumns.includes(xColumn)) continue;
      if (yColumn && !availableColumns.includes(yColumn)) continue;
      if (categoryColumn && !availableColumns.includes(categoryColumn)) continue;
      if (valueColumn && !availableColumns.includes(valueColumn)) continue;

      switch (variantPlan.type) {
        case 'table':
          visual = this.buildDynamicTable(rows, variantPlan, availableColumns);
          break;
        case 'line':
          visual = this.buildLineChart(rows, variantPlan, columnAnalysis);
          break;
        case 'bar':
          visual = this.buildBarChart(rows, variantPlan, columnAnalysis);
          break;
        case 'period_bar':
          visual = this.buildPeriodBar(rows, variantPlan, columnAnalysis);
          break;
        case 'pie':
          visual = this.buildPieChart(rows, variantPlan, columnAnalysis);
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

    return variants;
  }

  /**
   * Build dynamic table from actual columns
   */
  buildDynamicTable(rows, plan, availableColumns) {
    const columns = availableColumns;
    const labels = columns.map(col => this.generateLabel(col));
    
    const data = rows.map(row =>
      columns.map(col => this.formatValueByType(row[col], col))
    );

    return {
      type: 'table',
      labels,
      data
    };
  }

  /**
   * Build line chart with dynamic column detection
   */
  buildLineChart(rows, plan, columnAnalysis) {
    const { x_column, y_column, sort_by, sort_order = 'asc' } = plan;

    // Sort data based on column type
    let sorted = [...rows];
    if (sort_by) {
      const sortColType = columnAnalysis[sort_by]?.type;
      
      sorted.sort((a, b) => {
        const aVal = a[sort_by];
        const bVal = b[sort_by];
        
        if (sortColType === 'date') {
          const aDate = this.parseDate(aVal);
          const bDate = this.parseDate(bVal);
          if (aDate && bDate) {
            return sort_order === 'asc' ? aDate - bDate : bDate - aDate;
          }
        }
        
        if (sortColType === 'numeric' || sortColType === 'currency') {
          const aNum = this.parseNumber(aVal);
          const bNum = this.parseNumber(bVal);
          return sort_order === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        // String sort
        return sort_order === 'asc' ? 
          String(aVal).localeCompare(String(bVal)) : 
          String(bVal).localeCompare(String(aVal));
      });
    }

    const labels = sorted.map(r => this.formatLabelByType(r[x_column], columnAnalysis[x_column]?.type));
    const data = sorted.map(r => this.parseNumber(r[y_column]));
    const formatted = data.map(v => this.formatNumberByType(v, columnAnalysis[y_column]?.type));

    return {
      type: 'chart',
      chartType: 'line',
      labels,
      data,
      axis_labels: {
        x: this.generateLabel(x_column),
        y: this.generateLabel(y_column)
      },
      extra: { formatted }
    };
  }

  /**
   * Build period bar (time series as bars)
   */
  buildPeriodBar(rows, plan, columnAnalysis) {
    const lineChart = this.buildLineChart(rows, plan, columnAnalysis);
    return {
      ...lineChart,
      chartType: 'bar'
    };
  }

  /**
   * Build bar chart with dynamic aggregation
   */
  buildBarChart(rows, plan, columnAnalysis) {
    const { 
      x_column, 
      y_column, 
      aggregation = 'sum', 
      sort_by = 'value',
      sort_order = 'desc',
      top_n 
    } = plan;

    const aggregated = this.aggregate(rows, x_column, y_column, aggregation);

    let entries = [...aggregated.entries()];
    if (sort_by === 'value') {
      entries.sort((a, b) => sort_order === 'asc' ? a[1] - b[1] : b[1] - a[1]);
    } else {
      entries.sort((a, b) => {
        const comparison = String(a[0]).localeCompare(String(b[0]));
        return sort_order === 'asc' ? comparison : -comparison;
      });
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

    const labels = entries.map(([k, _]) => this.formatLabelByType(k, columnAnalysis[x_column]?.type));
    const data = entries.map(([_, v]) => this.roundNumber(v));
    const formatted = data.map(v => this.formatNumberByType(v, columnAnalysis[y_column]?.type));

    return {
      type: 'chart',
      chartType: 'bar',
      labels,
      data,
      axis_labels: {
        x: this.generateLabel(x_column),
        y: this.generateLabel(y_column)
      },
      extra: { formatted }
    };
  }

  /**
   * Build pie chart with dynamic columns
   */
  buildPieChart(rows, plan, columnAnalysis) {
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

    if (entries.length < 2) return null;

    const labels = entries.map(([k, _]) => this.formatLabelByType(k, columnAnalysis[category_column]?.type));
    const data = entries.map(([_, v]) => this.roundNumber(v));
    const formatted = data.map(v => this.formatNumberByType(v, columnAnalysis[value_column]?.type));

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

      const value = this.parseNumber(row[valueColumn]);
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
    const labels = columns.map(col => this.generateLabel(col));
    const data = rows.map(row =>
      columns.map(col => this.formatValueByType(row[col]))
    );

    return {
      type: 'table',
      labels,
      data
    };
  }

  /**
   * DYNAMIC: Generate human-readable label from any column name
   */
  generateLabel(columnName) {
    if (!columnName) return '';
    
    const str = String(columnName);
    
    // Common acronyms to preserve
    const acronyms = {
      'id': 'ID',
      'url': 'URL',
      'api': 'API',
      'sql': 'SQL',
      'html': 'HTML',
      'css': 'CSS',
      'vat': 'VAT',
      'hvac': 'HVAC',
      'crm': 'CRM',
      'erp': 'ERP'
    };

    // Split by underscore, hyphen, or camelCase
    let words = str
      .replace(/[-_]/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toLowerCase()
      .split(/\s+/);

    // Capitalize and handle acronyms
    words = words.map(word => {
      const lower = word.toLowerCase();
      if (acronyms[lower]) return acronyms[lower];
      return word.charAt(0).toUpperCase() + word.slice(1);
    });

    return words.join(' ');
  }

  /**
   * Parse number from any format
   */
  parseNumber(value) {
    if (typeof value === 'number') return value;
    
    // Remove currency symbols and commas
    const cleaned = String(value).replace(/[$,]/g, '');
    const num = Number(cleaned);
    
    return isFinite(num) ? num : 0;
  }

  /**
   * Format label based on column type
   */
  formatLabelByType(value, type) {
    if (value === null || value === undefined) return '';
    
    if (type === 'date') {
      const date = this.parseDate(value);
      if (date) {
        // Check if this looks like monthly data (first day of month)
        const isFirstOfMonth = date.getUTCDate() === 1;
        
        if (isFirstOfMonth) {
          // Format as "Jan 2025" for monthly data
          return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short',
            timeZone: 'UTC'
          });
        }
        
        // Format as YYYY-MM-DD using UTC
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    return String(value);
  }

  /**
   * Format number based on column type
   */
  formatNumberByType(value, type) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
    
    if (type === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    }

    // Regular number
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  /**
   * Format value for table display
   */
  formatValueByType(value, columnName) {
    if (value === null || value === undefined) return '';
    
    const str = String(value);
    
    // Check if it's a date
    const dateMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      // Use the same parseDate logic to handle timezone shifts
      const date = this.parseDate(value);
      if (date) {
        const isFirstOfMonth = date.getUTCDate() === 1;
        
        if (isFirstOfMonth) {
          // Format as "Jan 2025" for monthly data
          return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short',
            timeZone: 'UTC'
          });
        }
        
        // Format as YYYY-MM-DD using UTC
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    // Try currency
    if (str.includes('$')) {
      return str;
    }

    // Try number
    if (typeof value === 'number') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    }

    return str;
  }

  /**
   * Round number
   */
  roundNumber(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
  }
}

export default AIVisualizer;