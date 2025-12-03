/**
 * LLM-based summarization of tool execution results
 * Converts raw JSON tool outputs into natural language responses
 */

import Anthropic from '@anthropic-ai/sdk';
import { QueryExecutionResult } from './types.js';

export interface SummarizationOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface StreamChunk {
  type: 'chunk' | 'complete' | 'error';
  content: string;
  fullContent?: string;
}

export type StreamCallback = (chunk: StreamChunk) => void;

/**
 * Summarizes tool execution results using Claude LLM
 *
 * @param query - Original user query
 * @param result - Tool execution results
 * @param options - Summarization options
 * @returns Natural language summary of the results
 */
export async function summarizeResults(
  query: string,
  result: QueryExecutionResult,
  options: SummarizationOptions = {}
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('[Summarizer] ANTHROPIC_API_KEY not set, returning raw results');
    return formatRawResults(result);
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(query, result);

    const response = await anthropic.messages.create({
      model: process.env.LLM_SUMMARIZER_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: options.maxTokens || 1500,
      temperature: options.temperature || 0.3,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    const textContent = response.content?.[0];
    if (!textContent || textContent.type !== 'text') {
      throw new Error('Unexpected response format from Anthropic');
    }

    return textContent.text;
  } catch (error) {
    console.error('[Summarizer] Error summarizing results:', error);
    return formatRawResults(result);
  }
}

function buildSystemPrompt(): string {
  return `You are an NBA analytics assistant that converts raw data into clear, engaging natural language responses.

Your role:
- Synthesize information from multiple data sources (Elasticsearch, NBA API, sentiment analysis)
- Provide concise, accurate answers to user queries
- Use conversational language while maintaining accuracy
- Highlight key insights and trends
- Include relevant statistics when answering

Guidelines:
- Be direct and conversational
- Start with the most important information
- Use numbers and stats to support your points
- When discussing sentiment, summarize the overall fan mood
- Keep responses focused on what the user asked
- Aim for 3-5 paragraphs maximum unless more detail is clearly needed`;
}

function buildUserPrompt(query: string, result: QueryExecutionResult): string {
  let prompt = `User question: ${query}\n\n`;
  prompt += `Tools used: ${result.toolsUsed.join(', ')}\n\n`;
  prompt += `Data from tool execution:\n`;
  prompt += `${JSON.stringify(result.results, null, 2)}\n\n`;
  prompt += `Please provide a clear, natural language answer to the user's question based on this data.`;

  return prompt;
}

function formatRawResults(result: QueryExecutionResult): string {
  let formatted = 'Here are the results:\n\n';

  for (const [serverId, serverResults] of Object.entries(result.results)) {
    if (!serverResults || serverResults.length === 0) continue;

    formatted += `**${serverId}**:\n`;
    for (const toolResult of serverResults) {
      if (toolResult.content && toolResult.content.length > 0) {
        const firstContent = toolResult.content[0];
        if (firstContent.type === 'text') {
          formatted += `${firstContent.text}\n\n`;
        }
      }
    }
  }

  return formatted || 'No results found.';
}

/**
 * Summarizes tool execution results with streaming support
 * Calls the callback function for each chunk as it's received
 *
 * @param query - Original user query
 * @param result - Tool execution results
 * @param callback - Function to call for each streamed chunk
 * @param options - Summarization options
 */
export async function summarizeResultsStream(
  query: string,
  result: QueryExecutionResult,
  callback: StreamCallback,
  options: SummarizationOptions = {}
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('[Summarizer] ANTHROPIC_API_KEY not set, returning raw results');
    const rawResults = formatRawResults(result);
    callback({ type: 'complete', content: rawResults, fullContent: rawResults });
    return;
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(query, result);

    const stream = await anthropic.messages.stream({
      model: process.env.LLM_SUMMARIZER_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: options.maxTokens || 1500,
      temperature: options.temperature || 0.3,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    let fullContent = '';

    stream.on('text', (text) => {
      fullContent += text;
      callback({
        type: 'chunk',
        content: text,
        fullContent
      });
    });

    await stream.finalMessage();

    callback({
      type: 'complete',
      content: '',
      fullContent
    });

  } catch (error) {
    console.error('[Summarizer] Error streaming results:', error);
    const rawResults = formatRawResults(result);
    callback({
      type: 'error',
      content: rawResults,
      fullContent: rawResults
    });
  }
}
