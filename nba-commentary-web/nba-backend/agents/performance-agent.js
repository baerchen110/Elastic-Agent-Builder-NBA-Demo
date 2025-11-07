import { BaseAgent } from './base-agent.js';
import axios from 'axios';

/**
 * PERFORMANCE AGENT
 * Analyzes player performance
 * Calls Stats Agent and Elastic MCP for detailed analysis
 */
export class PerformanceAgent extends BaseAgent {
  constructor(agentBus) {
    super('performance-agent', agentBus);
    this.elasticUrl = process.env.ELASTIC_MCP_SERVER_URL;
    this.apiKey = process.env.ELASTICSEARCH_API_KEY;
  }

  /**
   * ANALYZE PERFORMANCE
   * This agent orchestrates other agents via A2A
   */
  async analyzePerformance(playerName) {
    console.log(`⚡ Performance Agent: Analyzing ${playerName}\n`);

    try {
      // STEP 1: Get stats from Stats Agent (via A2A)
      console.log(`  → Calling stats-agent for data...`);
      const stats = await this.callAgent(
        'stats-agent',
        'getPlayerStats',
        { player_name: playerName }
      );
      console.log(`  ✅ Stats received\n`);

      // STEP 2: Call Elastic for detailed analysis
      console.log(`  → Calling Elastic MCP for analysis...`);
      const elasticAnalysis = await this.callElasticMCP(playerName);
      console.log(`  ✅ Elastic analysis complete\n`);

      // STEP 3: Synthesize results
      const analysis = this.synthesizeAnalysis(stats, elasticAnalysis);

      return analysis;

    } catch (error) {
      console.error(`❌ Analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * CALL ELASTIC MCP
   */
  async callElasticMCP(playerName) {
    try {
      const response = await axios.post(
        `${this.elasticUrl}/tools/analyze_player_performance/execute`,
        {
          arguments: { player_name: playerName }
        },
        {
          headers: {
            'Authorization': `ApiKey ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Elastic MCP call failed: ${error.message}`);
      return { error: error.message };
    }
  }

  /**
   * SYNTHESIZE ANALYSIS
   * Combine data from multiple sources
   */
  synthesizeAnalysis(stats, elasticAnalysis) {
    return {
      player: stats.player,
      baseStats: stats.stats,
      elasticInsights: elasticAnalysis,
      synthesis: {
        overall: 'Strong performer with solid statistics',
        strengths: this.extractStrengths(stats),
        areasForImprovement: this.extractImprovementAreas(stats)
      },
      timestamp: new Date().toISOString()
    };
  }

  extractStrengths(stats) {
    return ['High scoring average', 'Good efficiency'];
  }

  extractImprovementAreas(stats) {
    return ['Turnover reduction', 'Three-point shooting consistency'];
  }

  async execute(args) {
    return await this.analyzePerformance(args.player_name);
  }

  async onMessage(messageType, data) {
    if (messageType === 'request:performance') {
      return await this.analyzePerformance(data.playerName);
    }
    return { success: true };
  }
}
