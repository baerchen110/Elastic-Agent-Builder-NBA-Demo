from elasticsearch import Elasticsearch
from dotenv import load_dotenv
import os

load_dotenv()

es = Elasticsearch(
    os.getenv('ELASTICSEARCH_URL'),
    api_key=os.getenv('ELASTICSEARCH_API_KEY')
)


def create_player_stats_index():
    """Create index for season player statistics"""
    index_name = os.getenv('ES_INDEX_PLAYER_STATS', 'nba-player-stats')

    mapping = {
        "mappings": {
            "properties": {
                "player_id": {"type": "keyword"},
                "player_name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "team_id": {"type": "keyword"},
                "team_abbreviation": {"type": "keyword"},
                "season": {"type": "keyword"},
                "games_played": {"type": "integer"},
                "minutes": {"type": "float"},
                "points": {"type": "float"},
                "assists": {"type": "float"},
                "rebounds": {"type": "float"},
                "offensive_rebounds": {"type": "float"},
                "defensive_rebounds": {"type": "float"},
                "steals": {"type": "float"},
                "blocks": {"type": "float"},
                "turnovers": {"type": "float"},
                "fg_pct": {"type": "float"},
                "fg3_pct": {"type": "float"},
                "ft_pct": {"type": "float"},
                "timestamp": {"type": "date"}
            }
        }
    }

    if es.indices.exists(index=index_name):
        print(f"Index {index_name} already exists. Deleting...")
        es.indices.delete(index=index_name)

    es.indices.create(index=index_name, body=mapping)
    print(f"✓ Created {index_name} index")


def create_live_games_index():
    """Create index for live game data"""
    index_name = os.getenv('ES_INDEX_LIVE_GAMES', 'nba-live-games')

    mapping = {
        "mappings": {
            "properties": {
                "game_id": {"type": "keyword"},
                "game_date": {"type": "date"},
                "home_team_id": {"type": "keyword"},
                "home_team_name": {"type": "text"},
                "home_team_score": {"type": "integer"},
                "away_team_id": {"type": "keyword"},
                "away_team_name": {"type": "text"},
                "away_team_score": {"type": "integer"},
                "period": {"type": "integer"},
                "game_status": {"type": "keyword"},
                "game_status_text": {"type": "text"},
                "timestamp": {"type": "date"}
            }
        }
    }

    if es.indices.exists(index=index_name):
        print(f"Index {index_name} already exists. Deleting...")
        es.indices.delete(index=index_name)

    es.indices.create(index=index_name, body=mapping)
    print(f"✓ Created {index_name} index")


def create_player_game_logs_index():
    """Create index for individual game logs"""
    index_name = os.getenv('ES_INDEX_GAME_LOGS', 'nba-player-game-logs')

    mapping = {
        "mappings": {
            "properties": {
                "player_id": {"type": "keyword"},
                "player_name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "game_id": {"type": "keyword"},
                "game_date": {"type": "date"},
                "matchup": {"type": "text"},
                "wl": {"type": "keyword"},
                "minutes": {"type": "float"},
                "points": {"type": "integer"},
                "fgm": {"type": "integer"},
                "fga": {"type": "integer"},
                "fg_pct": {"type": "float"},
                "fg3m": {"type": "integer"},
                "fg3a": {"type": "integer"},
                "fg3_pct": {"type": "float"},
                "ftm": {"type": "integer"},
                "fta": {"type": "integer"},
                "ft_pct": {"type": "float"},
                "rebounds": {"type": "integer"},
                "assists": {"type": "integer"},
                "steals": {"type": "integer"},
                "blocks": {"type": "integer"},
                "turnovers": {"type": "integer"},
                "plus_minus": {"type": "integer"},
                "season": {"type": "keyword"},
                "timestamp": {"type": "date"}
            }
        }
    }

    if es.indices.exists(index=index_name):
        print(f"Index {index_name} already exists. Deleting...")
        es.indices.delete(index=index_name)

    es.indices.create(index=index_name, body=mapping)
    print(f"✓ Created {index_name} index")


if __name__ == '__main__':
    print("Creating Elasticsearch indexes...")
    create_player_stats_index()
    create_live_games_index()
    create_player_game_logs_index()
    print("\n✓ All indexes created successfully!")
