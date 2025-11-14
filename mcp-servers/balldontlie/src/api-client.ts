/**
 * BallDontLie API Client
 * Wrapper for https://api.balldontlie.io/v1
 */

import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.BALLDONTLIE_API_BASE_URL || 'https://api.balldontlie.io/v1';

export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  height: string;
  weight: string;
  jersey_number: string;
  college: string;
  country: string;
  draft_year: number;
  draft_round: number;
  draft_number: number;
  team: Team;
}

export interface Team {
  id: number;
  conference: string;
  division: string;
  city: string;
  name: string;
  full_name: string;
  abbreviation: string;
}

export interface Game {
  id: number;
  date: string;
  season: number;
  status: string;
  period: number;
  time: string;
  postseason: boolean;
  home_team: Team;
  visitor_team: Team;
  home_team_score: number;
  visitor_team_score: number;
}

export interface SeasonAverage {
  season: number;
  player_id: number;
  games_played: number;
  min: string;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  turnover: number;
  pf: number;
  pts: number;
  fg_pct: number;
  fg3_pct: number;
  ft_pct: number;
}

export class BallDontLieAPI {
  private client: AxiosInstance;

  constructor(apiKey?: string) {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: apiKey ? { 'Authorization': apiKey } : {},
      timeout: parseInt(process.env.BALLDONTLIE_API_TIMEOUT_MS || '10000', 10)
    });
  }

  /**
   * Search for players by name
   */
  async getPlayers(params: { search?: string; per_page?: number; page?: number } = {}): Promise<Player[]> {
    try {
      const response = await this.client.get('/players', { params });
      return response.data.data || [];
    } catch (error: any) {
      console.error('[BallDontLie API] Error fetching players:', error.message);
      throw new Error(`Failed to fetch players: ${error.message}`);
    }
  }

  /**
   * Get player by ID
   */
  async getPlayer(playerId: number): Promise<Player> {
    try {
      const response = await this.client.get(`/players/${playerId}`);
      return response.data;
    } catch (error: any) {
      console.error('[BallDontLie API] Error fetching player:', error.message);
      throw new Error(`Failed to fetch player ${playerId}: ${error.message}`);
    }
  }

  /**
   * Get season averages for a player
   */
  async getSeasonAverages(playerId: number, season?: number): Promise<SeasonAverage[]> {
    try {
      const params: any = { player_ids: [playerId] };
      if (season) {
        params.season = season;
      }

      const response = await this.client.get('/season_averages', { params });
      return response.data.data || [];
    } catch (error: any) {
      console.error('[BallDontLie API] Error fetching season averages:', error.message);
      throw new Error(`Failed to fetch season averages: ${error.message}`);
    }
  }

  /**
   * Get games by date
   */
  async getGames(params: {
    dates?: string[];
    season?: number;
    team_ids?: number[];
    per_page?: number;
    page?: number;
  } = {}): Promise<Game[]> {
    try {
      const queryParams: any = { ...params };

      // Convert dates array to comma-separated string
      if (params.dates && params.dates.length > 0) {
        queryParams.dates = params.dates;
      }

      // Convert team_ids array to comma-separated string
      if (params.team_ids && params.team_ids.length > 0) {
        queryParams.team_ids = params.team_ids;
      }

      const response = await this.client.get('/games', { params: queryParams });
      return response.data.data || [];
    } catch (error: any) {
      console.error('[BallDontLie API] Error fetching games:', error.message);
      throw new Error(`Failed to fetch games: ${error.message}`);
    }
  }

  /**
   * Get all teams
   */
  async getTeams(): Promise<Team[]> {
    try {
      const response = await this.client.get('/teams', {
        params: { per_page: parseInt(process.env.BALLDONTLIE_TEAMS_PER_PAGE || '100', 10) }
      });
      return response.data.data || [];
    } catch (error: any) {
      console.error('[BallDontLie API] Error fetching teams:', error.message);
      throw new Error(`Failed to fetch teams: ${error.message}`);
    }
  }
}
