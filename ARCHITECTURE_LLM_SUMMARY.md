# LLM-Powered Response Processing Architecture

## Overview
Enhance the MCP Aggregator test page to use Claude for transforming raw JSON responses into human-friendly natural language summaries.

## Architecture

```
User Query
    ↓
Frontend (MCPQueryTest.tsx)
    ↓
API Endpoint (/api/mcp/query)
    ↓
MCP Aggregator
    ↓
MCP Servers (Elastic, NBA, Sentiment)
    ↓
Raw JSON Results
    ↓
LLM Summarizer Service (Claude)
    ↓
Human-Friendly Summary + Raw Data
    ↓
Frontend Display
```

## Components

### 1. LLM Summarizer Service (`lib/llm-summarizer.ts`)
**Purpose:** Transform raw MCP responses into natural language

**Input:**
- `query`: User's original query
- `results`: Raw MCP response data
- `metadata`: Intent, tools used, execution time

**Output:**
- Natural language summary
- Key insights highlighted
- Data presented conversationally

**Implementation:**
- Uses Anthropic SDK with Claude Sonnet 4.5
- Contextual prompt engineering
- Handles different data types (player stats, live games, sentiment, etc.)

### 2. Enhanced API Endpoint
**Endpoint:** `/api/mcp/query`

**New Parameters:**
- `summarize` (boolean, default: true) - Whether to generate LLM summary

**Response Structure:**
```typescript
{
  success: boolean;
  data: {
    intent: string;
    toolsUsed: string[];
    cached: boolean;
    executionTime: number;
    results: any;  // Raw data
    summary?: string;  // LLM-generated summary (when summarize=true)
  };
  error?: string;
}
```

### 3. Frontend Enhancement
**Component:** `MCPQueryTest.tsx`

**Features:**
- Primary display: LLM summary (readable, formatted)
- Secondary display: Raw JSON (collapsible)
- Toggle button: "Show Raw Data" / "Hide Raw Data"
- Better visual hierarchy
- Syntax highlighting for summary

**UI Layout:**
```
┌─────────────────────────────────────┐
│  Query Result                       │
│                                     │
│  📊 Summary                         │
│  [LLM-generated natural language]   │
│                                     │
│  ✓ Intent: PLAYER_STATS            │
│  ✓ Tools: elastic:platform...      │
│  ✓ Time: 1200ms                    │
│                                     │
│  [Show Raw Data ▼]                 │
│  ┌─────────────────────────────┐   │
│  │ { "results": ... }          │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

## Prompt Engineering Strategy

### System Prompt
```
You are an NBA data analyst assistant. Your job is to interpret
technical data from multiple NBA data sources and present it in
a clear, engaging, and accurate way for basketball fans and analysts.

Guidelines:
- Be conversational but precise
- Highlight key numbers and trends
- Use basketball terminology appropriately
- Compare players when relevant
- Note data quality or limitations
- Format numbers clearly (e.g., "23.5 PPG", "48.2% FG")
```

### User Prompt Template
```
The user asked: "{query}"

The system used these tools: {toolsUsed}
Intent classification: {intent}

Here's the data from multiple NBA sources:
{results}

Please provide a clear, natural language summary that:
1. Directly answers the user's question
2. Highlights the most important statistics or findings
3. Provides context when helpful
4. Uses proper formatting for readability
5. Notes if any data seems incomplete or unusual

Format your response as markdown for better readability.
```

## Implementation Plan

### Phase 1: Backend (30 min)
1. Create `lib/llm-summarizer.ts`
2. Implement `summarizeResults()` function
3. Add Anthropic SDK integration
4. Test with sample data

### Phase 2: API Enhancement (15 min)
1. Modify `/api/mcp/query.ts`
2. Add summarization step after aggregator call
3. Include summary in response
4. Error handling for LLM failures

### Phase 3: Frontend Update (30 min)
1. Update `MCPQueryTest.tsx`
2. Add summary display section
3. Add collapsible raw data view
4. Improve visual styling
5. Add loading states

### Phase 4: Testing (20 min)
1. Test with player stats queries
2. Test with live game queries
3. Test with sentiment queries
4. Test with comparison queries
5. Test error scenarios

## Benefits

✅ **Better UX** - Non-technical users can understand results
✅ **Faster Insights** - No need to parse JSON manually
✅ **Contextual** - LLM understands basketball context
✅ **Flexible** - Works with any MCP server response
✅ **Optional** - Raw data still available for developers

## Configuration

**Environment Variables:**
```bash
ANTHROPIC_API_KEY=sk-ant-...  # Already configured
```

**Feature Flags:**
- No new flags needed
- Uses existing Anthropic API key
- Can be toggled per-request via `summarize` parameter

## Cost Considerations

**Per Query Cost:**
- Input tokens: ~500-1000 (results + prompt)
- Output tokens: ~200-500 (summary)
- Estimated cost: $0.005-0.015 per query

**Optimization:**
- Cache summaries (like we cache MCP results)
- Truncate very large responses
- Use Haiku for simple queries (future enhancement)

## Future Enhancements

1. **Streaming Responses** - Stream summary as it's generated
2. **Follow-up Questions** - Allow users to ask clarifying questions
3. **Multi-turn Context** - Remember conversation history
4. **Citation Links** - Link back to specific data points
5. **Comparison Mode** - Enhanced UI for player comparisons
6. **Export** - Download summaries as markdown/PDF
