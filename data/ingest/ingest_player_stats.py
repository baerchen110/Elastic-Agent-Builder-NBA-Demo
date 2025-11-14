from nba_api.stats.endpoints import leaguedashplayerstats
from elasticsearch import Elasticsearch, helpers
from dotenv import load_dotenv
from datetime import datetime
import pandas as pd
import os
import time

load_dotenv()

es = Elasticsearch(
    os.getenv('ELASTICSEARCH_URL'),
    api_key=os.getenv('ELASTICSEARCH_API_KEY')
)


def fetch_season_player_stats(season='2024-25'):
    """Fetch current season player statistics from NBA API"""
    print(f"Fetching player stats for {season} season...")

    try:
        # Get player stats from NBA API
        player_stats = leaguedashplayerstats.LeagueDashPlayerStats(
            season=season,
            season_type_all_star='Regular Season',
            per_mode_detailed='PerGame'
        )

        # Convert to DataFrame
        df = player_stats.get_data_frames()[0]
        print(f"✓ Fetched {len(df)} players")
        return df

    except Exception as e:
        print(f"✗ Error fetching  {e}")
        return None


def prepare_bulk_actions(df, season='2024-25'):
    """Prepare bulk index actions for Elasticsearch"""
    actions = []

    for _, row in df.iterrows():
        action = {
            "_index": os.getenv('ES_INDEX_PLAYER_STATS', 'nba-player-stats'),
            "_source": {
                "player_id": str(row['PLAYER_ID']),
                "player_name": row['PLAYER_NAME'],
                "team_id": str(row['TEAM_ID']),
                "team_abbreviation": row['TEAM_ABBREVIATION'],
                "season": season,
                "games_played": int(row['GP']) if pd.notna(row['GP']) else 0,
                "minutes": float(row['MIN']) if pd.notna(row['MIN']) else 0.0,
                "points": float(row['PTS']) if pd.notna(row['PTS']) else 0.0,
                "assists": float(row['AST']) if pd.notna(row['AST']) else 0.0,
                "rebounds": float(row['REB']) if pd.notna(row['REB']) else 0.0,
                "offensive_rebounds": float(row['OREB']) if pd.notna(row['OREB']) else 0.0,
                "defensive_rebounds": float(row['DREB']) if pd.notna(row['DREB']) else 0.0,
                "steals": float(row['STL']) if pd.notna(row['STL']) else 0.0,
                "blocks": float(row['BLK']) if pd.notna(row['BLK']) else 0.0,
                "turnovers": float(row['TOV']) if pd.notna(row['TOV']) else 0.0,
                "fg_pct": float(row['FG_PCT']) if pd.notna(row['FG_PCT']) else 0.0,
                "fg3_pct": float(row['FG3_PCT']) if pd.notna(row['FG3_PCT']) else 0.0,
                "ft_pct": float(row['FT_PCT']) if pd.notna(row['FT_PCT']) else 0.0,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        actions.append(action)

    return actions


def bulk_index_data(actions):
    """Use helpers.bulk to efficiently index data"""
    try:
        success, failed = helpers.bulk(
            es,
            actions,
            chunk_size=int(os.getenv('ES_BULK_CHUNK_SIZE_PLAYER_STATS', '500')),
            request_timeout=30
        )
        print(f"✓ Successfully indexed {success} documents")
        if failed:
            print(f"✗ Failed to index {failed} documents")
        return success
    except Exception as e:
        print(f"✗ Bulk indexing error: {e}")
        return 0


def main():
    season = '2025-26'

    # Fetch data from NBA API
    df = fetch_season_player_stats(season)

    if df is not None:
        # Prepare bulk actions
        print("Preparing bulk index actions...")
        actions = prepare_bulk_actions(df, season)

        # Bulk index to Elasticsearch
        print(f"Indexing {len(actions)} documents to Elasticsearch...")
        bulk_index_data(actions)

        print("\n✓ Data ingestion complete!")
        print(f"Total players indexed: {len(actions)}")
    else:
        print("✗ No data to index")


if __name__ == '__main__':
    main()
