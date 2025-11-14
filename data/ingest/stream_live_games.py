from nba_api.live.nba.endpoints import scoreboard
from elasticsearch import Elasticsearch
from dotenv import load_dotenv
from datetime import datetime
import time
import os

load_dotenv()

es = Elasticsearch(
    os.getenv('ELASTICSEARCH_URL'),
    api_key=os.getenv('ELASTICSEARCH_API_KEY')
)


def fetch_live_scoreboard():
    """Fetch live game data from NBA API"""
    try:
        games = scoreboard.ScoreBoard()
        games_dict = games.get_dict()
        return games_dict.get('scoreboard', {}).get('games', [])
    except Exception as e:
        print(f"Error fetching scoreboard: {e}")
        return []


def index_live_game(game_data):
    """Index a single game to Elasticsearch"""
    try:
        doc = {
            "game_id": game_data.get('gameId'),
            "game_date": game_data.get('gameTimeUTC'),
            "home_team_id": game_data.get('homeTeam', {}).get('teamId'),
            "home_team_name": game_data.get('homeTeam', {}).get('teamName'),
            "home_team_score": game_data.get('homeTeam', {}).get('score', 0),
            "away_team_id": game_data.get('awayTeam', {}).get('teamId'),
            "away_team_name": game_data.get('awayTeam', {}).get('teamName'),
            "away_team_score": game_data.get('awayTeam', {}).get('score', 0),
            "period": game_data.get('period', 0),
            "game_status": game_data.get('gameStatus'),
            "game_status_text": game_data.get('gameStatusText'),
            "timestamp": datetime.utcnow().isoformat()
        }

        es.index(
            index=os.getenv('ES_INDEX_LIVE_GAMES', 'nba-live-games'),
            id=game_data.get('gameId'),
            document=doc
        )

        return True
    except Exception as e:
        print(f"Error indexing game: {e}")
        return False


def stream_live_games(interval=30):
    """Continuously stream live game updates"""
    print("Starting live game streaming...")
    print(f"Updating every {interval} seconds")
    print("Press Ctrl+C to stop\n")

    try:
        while True:
            games = fetch_live_scoreboard()

            if games:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Found {len(games)} games")

                for game in games:
                    home_team = game.get('homeTeam', {}).get('teamTricode', 'N/A')
                    away_team = game.get('awayTeam', {}).get('teamTricode', 'N/A')
                    home_score = game.get('homeTeam', {}).get('score', 0)
                    away_score = game.get('awayTeam', {}).get('score', 0)
                    status = game.get('gameStatusText', 'N/A')

                    print(f"  {away_team} @ {home_team}: {away_score}-{home_score} ({status})")

                    index_live_game(game)

                print(f"✓ Updated {len(games)} games\n")
            else:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] No live games currently\n")

            time.sleep(interval)

    except KeyboardInterrupt:
        print("\n\nStopping live game streaming...")
        print("✓ Shutdown complete")


if __name__ == '__main__':
    # Run once to get current games
    print("Fetching current games...\n")
    games = fetch_live_scoreboard()

    if games:
        for game in games:
            index_live_game(game)
        print(f"✓ Indexed {len(games)} games")
    else:
        print("No games found (this is normal outside of game times)")

    # Uncomment to run continuous streaming
    # stream_live_games(interval=30)
