import { BaseAgent } from './base-agent.js';
import axios from 'axios';

/**
 * STATS AGENT
 * Responsible for retrieving NBA player statistics
 * Other agents call this when they need stats
 */
export class StatsAgent extends BaseAgent {
  constructor(agentBus) {
    super('stats-agent', agentBus);
    this.mcpUrl = process.env.BALLDONTLIE_MCP_URL;
    this.apiKey = process.env.BALLDONTLIE_API_KEY;
  }

  /**
   * GET PLAYER STATS
   * Fetch stats from BALLDONTLIE MCP
   */
  async getPlayerStats(playerName) {
    console.log(`📊 Stats Agent: Fetching stats for ${playerName}`);

    try {
      // Call BALLDONTLIE MCP Server
      const response = await axios.get(
        `${this.mcpUrl}/tools/player_statistics/execute`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          data: { arguments: { name: playerName } }
        }
      );

      console.log(`✅ Stats retrieved for ${playerName}`);

      return {
        player: playerName,
        stats: response.data,
        source: 'BALLDONTLIE',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Stats fetch failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * EXECUTE (Standard interface)
   */
  async execute(args) {
    return await this.getPlayerStats(args.player_name);
  }

  /**
   * ON MESSAGE
   * Handle incoming A2A messages
   */
  async onMessage(messageType, data) {
    if (messageType === 'request:stats') {
      return await this.getPlayerStats(data.playerName);
    }
    return { success: true };
  }
}
