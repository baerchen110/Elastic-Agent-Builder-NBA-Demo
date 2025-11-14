from nba_api.stats.endpoints import playergamelog
from elasticsearch import Elasticsearch, helpers
from dotenv import load_dotenv
from datetime import datetime, timezone
import pandas as pd
import os
import time

load_dotenv()

es = Elasticsearch(
    os.getenv('ELASTICSEARCH_URL'),
    api_key=os.getenv('ELASTICSEARCH_API_KEY')
)

# Popular players to track (expand this list as needed)
TRACKED_PLAYERS = {
    '2544': 'LeBron James',
    '203999': 'Nikola Jokic',
    '201939': 'Stephen Curry',
    '1629029': 'Luka Doncic',
    '203507': 'Giannis Antetokounmpo',
    '1628369': 'Jayson Tatum',
    '203954': 'Joel Embiid',
    '1630163': 'Anthony Edwards',
    '1629630': 'Shai Gilgeous-Alexander',
    '203081': 'Damian Lillard'
}


def parse_game_date(date_str):
    """Parse NBA API date format to ISO 8601"""
    try:
        # NBA API returns dates like "Apr 11, 2025"
        parsed_date = datetime.strptime(str(date_str), "%b %d, %Y")
        return parsed_date.strftime("%Y-%m-%d")
    except Exception as e:
        print(f"Warning: Could not parse date '{date_str}': {e}")
        return datetime.now(timezone.utc).isoformat()


def fetch_player_game_log(player_id, player_name, season=None):
    """Fetch game log for a specific player"""
    if season is None:
        season = os.getenv('NBA_CURRENT_SEASON', '2024-25')

    try:
        print(f"Fetching game logs for {player_name} (season: {season})...")
        game_log = playergamelog.PlayerGameLog(
            player_id=player_id,
            season=season,
            season_type_all_star='Regular Season'
        )

        df = game_log.get_data_frames()[0]
        print(f" ✓ Found {len(df)} games")

        # Respect NBA API rate limits
        time.sleep(0.6)
        return df

    except Exception as e:
        print(f" ✗ Error fetching {player_name}: {e}")
        return None


def prepare_game_log_actions(df, player_name):
    """Prepare bulk actions for game logs"""
    actions = []

    for _, row in df.iterrows():
        # Handle MIN column - could be string like "1:23" format
        minutes = 0.0
        if pd.notna(row.get('MIN')):
            min_val = row['MIN']
            if isinstance(min_val, str):
                try:
                    # Parse "MM:SS" format to decimal minutes
                    parts = min_val.split(':')
                    if len(parts) == 2:
                        minutes = float(parts[0]) + float(parts[1]) / 60
                    else:
                        minutes = float(min_val)
                except:
                    minutes = 0.0
            else:
                minutes = float(min_val)

        action = {
            "_index": os.getenv('ES_INDEX_GAME_LOGS', 'nba-player-game-logs'),
            "_source": {
                "player_id": str(row['Player_ID']),
                "player_name": player_name,
                "game_id": str(row['Game_ID']),
                "game_date": parse_game_date(row['GAME_DATE']),  # Parse to ISO 8601
                "matchup": str(row['MATCHUP']),
                "wl": str(row['WL']),
                "minutes": minutes,
                "points": int(row['PTS']) if pd.notna(row['PTS']) else 0,
                "fgm": int(row['FGM']) if pd.notna(row['FGM']) else 0,
                "fga": int(row['FGA']) if pd.notna(row['FGA']) else 0,
                "fg_pct": float(row['FG_PCT']) if pd.notna(row['FG_PCT']) else 0.0,
                "fg3m": int(row['FG3M']) if pd.notna(row['FG3M']) else 0,
                "fg3a": int(row['FG3A']) if pd.notna(row['FG3A']) else 0,
                "fg3_pct": float(row['FG3_PCT']) if pd.notna(row['FG3_PCT']) else 0.0,
                "ftm": int(row['FTM']) if pd.notna(row['FTM']) else 0,
                "fta": int(row['FTA']) if pd.notna(row['FTA']) else 0,
                "ft_pct": float(row['FT_PCT']) if pd.notna(row['FT_PCT']) else 0.0,
                "oreb": int(row['OREB']) if pd.notna(row['OREB']) else 0,
                "dreb": int(row['DREB']) if pd.notna(row['DREB']) else 0,
                "rebounds": int(row['REB']) if pd.notna(row['REB']) else 0,
                "assists": int(row['AST']) if pd.notna(row['AST']) else 0,
                "steals": int(row['STL']) if pd.notna(row['STL']) else 0,
                "blocks": int(row['BLK']) if pd.notna(row['BLK']) else 0,
                "turnovers": int(row['TOV']) if pd.notna(row['TOV']) else 0,
                "fouls": int(row['PF']) if pd.notna(row['PF']) else 0,
                "plus_minus": int(row['PLUS_MINUS']) if pd.notna(row['PLUS_MINUS']) else 0,
                "season": str(row['SEASON_ID']),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
        actions.append(action)

    return actions


def main():
    all_actions = []

    for player_id, player_name in TRACKED_PLAYERS.items():
        df = fetch_player_game_log(player_id, player_name,"2025-2026")

        if df is not None and not df.empty:
            actions = prepare_game_log_actions(df, player_name)
            all_actions.extend(actions)

    if all_actions:
        print(f"\nIndexing {len(all_actions)} game logs to Elasticsearch...")
        try:
            # Use Elasticsearch.options() instead of deprecated request_timeout parameter
            success, failed = helpers.bulk(
                es,
                all_actions,
                chunk_size=int(os.getenv('ES_BULK_CHUNK_SIZE_GAME_LOGS', '500')),
                raise_on_error=False  # Don't raise exception, capture failed docs
            )

            print(f"✓ Successfully indexed {success} game logs")
            if failed:
                print(f"✗ Failed to index {len(failed)} documents")
                print("\nFirst error sample:")
                if isinstance(failed, list) and len(failed) > 0:
                    print(failed[0]['error']['reason'])

        except Exception as e:
            print(f"✗ Bulk indexing error: {e}")
    else:
        print("✗ No game logs to index")


if __name__ == '__main__':
    main()
