/**
 * LLM Summarizer Service
 * Transforms raw MCP responses into human-friendly summaries using Claude
 */

import Anthropic from '@anthropic-ai/sdk';

export interface SummarizationInput {
  query: string;
  intent: string;
  toolsUsed: string[];
  results: any;
  executionTime: number;
  cached?: boolean;
}

export interface SummarizationResult {
  summary: string;
  error?: string;
}

const SYSTEM_PROMPT = `You are an expert NBA data analyst assistant. Your role is to interpret technical data from multiple NBA data sources (Elasticsearch, NBA APIs, social sentiment) and present it in a clear, engaging, and accurate way for basketball fans and analysts.

Guidelines:
- Be conversational but precise with numbers and facts
- Highlight key statistics, trends, and insights
- Use proper basketball terminology (PPG, APG, RPG, FG%, etc.)
- When comparing players, provide balanced analysis
- Note any data quality issues or limitations
- Format numbers clearly (e.g., "23.5 PPG", "48.2% FG", "6.2 RPG")
- Use markdown formatting for better readability
- Keep responses focused and scannable (use bullet points, headers)
- If sentiment data is included, interpret the buzz/narrative clearly

Important:
- Do NOT make up statistics - only use data from the provided results
- If data is missing or incomplete, acknowledge it
- Be specific about timeframes when relevant (season, last 5 games, today, etc.)`;

const USER_PROMPT_TEMPLATE = (input: SummarizationInput): string => `
The user asked: **"${input.query}"**

The system analyzed this as a **${input.intent}** query and used these tools:
${input.toolsUsed.map((tool, idx) => `${idx + 1}. \`${tool}\``).join('\n')}

Query completed in ${input.executionTime}ms${input.cached ? ' (from cache)' : ''}.

Here's the raw data from the NBA data sources:
\`\`\`json
${JSON.stringify(input.results, null, 2)}
\`\`\`

Please provide a clear, natural language summary that:
1. **Directly answers the user's question** - Start with the most relevant information
2. **Highlights key numbers** - Present important statistics prominently
3. **Provides context** - Explain what the numbers mean if helpful
4. **Uses proper formatting** - Organize with headers, bullets, or tables as appropriate
5. **Notes limitations** - Mention if data is incomplete, outdated, or from fallback sources

Format your response in markdown for readability. Structure it logically based on the query type:
- **Player stats**: Lead with key averages, then details
- **Live games**: Start with scores, then game status and key performances
- **Comparisons**: Use tables or side-by-side format
- **Sentiment**: Lead with the overall signal, then breakdown by source
- **Trends**: Show the trajectory clearly (improving/declining/stable)

Keep it concise but informative. Aim for 150-300 words unless the query requires more detail.`;

/**
 * Generate a human-friendly summary of MCP results using Claude
 */
export async function summarizeResults(input: SummarizationInput): Promise<SummarizationResult> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return {
        summary: '',
        error: 'Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.'
      };
    }

    const anthropic = new Anthropic({ apiKey });

    // Truncate very large results to avoid token limits
    const truncatedInput = {
      ...input,
      results: truncateResults(input.results, 8000)
    };

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: USER_PROMPT_TEMPLATE(truncatedInput)
        }
      ]
    });

    const summary = message.content
      .filter((block) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n\n');

    if (!summary || summary.trim().length === 0) {
      return {
        summary: '',
        error: 'LLM returned empty summary'
      };
    }

    return { summary };
  } catch (error: any) {
    console.error('[LLM Summarizer] Error:', error);
    return {
      summary: '',
      error: `Failed to generate summary: ${error.message || 'Unknown error'}`
    };
  }
}

/**
 * Truncate results to avoid exceeding token limits
 * Keeps structure but limits depth and array sizes
 */
function truncateResults(results: any, maxLength: number): any {
  const stringified = JSON.stringify(results);

  if (stringified.length <= maxLength) {
    return results;
  }

  // Try to intelligently truncate
  if (Array.isArray(results)) {
    // Keep first 5 items of arrays
    return results.slice(0, 5).map(item => truncateResults(item, Math.floor(maxLength / 5)));
  }

  if (typeof results === 'object' && results !== null) {
    const truncated: any = {};
    const keys = Object.keys(results);
    const maxKeysToKeep = Math.min(keys.length, 20);

    for (let i = 0; i < maxKeysToKeep; i++) {
      const key = keys[i];
      truncated[key] = truncateResults(results[key], Math.floor(maxLength / maxKeysToKeep));
    }

    if (keys.length > maxKeysToKeep) {
      truncated['__truncated__'] = `... ${keys.length - maxKeysToKeep} more fields`;
    }

    return truncated;
  }

  return results;
}

/**
 * Validate if summarization should be performed
 */
export function shouldSummarize(results: any): boolean {
  // Don't summarize if results are empty or trivial
  if (!results || (typeof results === 'object' && Object.keys(results).length === 0)) {
    return false;
  }

  // Don't summarize if results are just error messages
  if (results.error || results.errors) {
    return false;
  }

  return true;
}
