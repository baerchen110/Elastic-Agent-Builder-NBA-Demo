import dotenv from 'dotenv';
import { ElasticMCPClient } from '../src/servers/elastic-client.js';
import { summarizeToolMetadata } from '../src/tool-metadata.js';

(async () => {
  dotenv.config({ path: '../../.env.local' });

  const client = new ElasticMCPClient();

  try {
    await client.connect();

    const tools = await client.listTools();

    console.log(`\nFetched ${tools.length} tools from Elastic MCP`);
    console.log('='.repeat(80));

    for (const tool of tools) {
      const metadata: any = tool as any;
      const labels = metadata?.metadata?.labels || metadata?.labels || [];
      const categories = metadata?.metadata?.categories || metadata?.categories || [];
      const summary = summarizeToolMetadata(tool);

      console.log(`🔧 ${tool.name}`);
      console.log(`   Description: ${tool.description || '—'}`);

      if (Array.isArray(labels) && labels.length > 0) {
        console.log(`   Labels: ${labels.join(', ')}`);
      }

      if (Array.isArray(categories) && categories.length > 0) {
        console.log(`   Categories: ${categories.join(', ')}`);
      }

      if (tool.inputSchema) {
        const required = tool.inputSchema.required || [];
        const props = Object.keys(tool.inputSchema.properties || {});
        if (required.length > 0) {
          console.log(`   Required parameters: ${required.join(', ')}`);
        }
        if (props.length > 0) {
          console.log(`   Parameters: ${props.join(', ')}`);
        }
      }

      if (summary.synopsis) {
        console.log(`   Synopsis: ${summary.synopsis}`);
      }

      if (summary.labels.length > 0 || summary.categories.length > 0 || summary.derivedTags.length > 0) {
        const tagParts: string[] = [];
        if (summary.labels.length > 0) {
          tagParts.push(`labels: ${summary.labels.join(', ')}`);
        }
        if (summary.categories.length > 0) {
          tagParts.push(`categories: ${summary.categories.join(', ')}`);
        }
        if (summary.derivedTags.length > 0) {
          tagParts.push(`derived: ${summary.derivedTags.join(', ')}`);
        }
        console.log(`   Tags: ${tagParts.join(' | ')}`);
      }

      console.log('-'.repeat(80));
    }
  } catch (error) {
    console.error('Failed to inspect Elastic tools:', error);
  } finally {
    await client.disconnect();
  }
})();
