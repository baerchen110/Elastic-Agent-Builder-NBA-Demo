#!/usr/bin/env python3

"""
NBA Game Data Ingestion - ES|QL COMPATIBLE VERSION
Flattens nested object fields into top-level fields using consistent naming
"""

from nba_api.stats.endpoints import leaguegamefinder, playergamelogs
from elasticsearch import Elasticsearch, helpers
from datetime import datetime, timezone
import time
from dotenv import load_dotenv
import os

GAMES_INDEX = 'nba_games_enhanced'
PLAYER_LOGS_INDEX = 'nba_player_game_logs_enhanced'

SEASONS = ['2020-21', '2021-22', '2022-23', '2023-24', '2024-25', '2025-26']

# IMPROVED: Flattened game mapping (no nested objects)
GAMES_MAPPING = {
    "settings": {
        "index": {
            "mode": "lookup"
        }
    },
    "mappings": {
        "properties": {
            "game_id": {"type": "keyword"},
            "game_date": {"type": "date"},
            "season": {"type": "keyword"},
            "season_type": {"type": "keyword"},

            # CHANGED: Flattened home team fields (no object nesting)
            "home_team_id": {"type": "keyword"},
            "home_team_name": {"type": "keyword"},
            "home_team_abbreviation": {"type": "keyword"},
            "home_points": {"type": "integer"},
            "home_field_goals_made": {"type": "integer"},
            "home_field_goals_attempted": {"type": "integer"},
            "home_field_goal_pct": {"type": "float"},
            "home_three_pointers_made": {"type": "integer"},
            "home_three_pointers_attempted": {"type": "integer"},
            "home_three_point_pct": {"type": "float"},
            "home_free_throws_made": {"type": "integer"},
            "home_free_throws_attempted": {"type": "integer"},
            "home_free_throw_pct": {"type": "float"},
            "home_offensive_rebounds": {"type": "integer"},
            "home_defensive_rebounds": {"type": "integer"},
            "home_total_rebounds": {"type": "integer"},
            "home_assists": {"type": "integer"},
            "home_steals": {"type": "integer"},
            "home_blocks": {"type": "integer"},
            "home_turnovers": {"type": "integer"},
            "home_personal_fouls": {"type": "integer"},
            "home_plus_minus": {"type": "integer"},

            # CHANGED: Flattened away team fields (no object nesting)
            "away_team_id": {"type": "keyword"},
            "away_team_name": {"type": "keyword"},
            "away_team_abbreviation": {"type": "keyword"},
            "away_points": {"type": "integer"},
            "away_field_goals_made": {"type": "integer"},
            "away_field_goals_attempted": {"type": "integer"},
            "away_field_goal_pct": {"type": "float"},
            "away_three_pointers_made": {"type": "integer"},
            "away_three_pointers_attempted": {"type": "integer"},
            "away_three_point_pct": {"type": "float"},
            "away_free_throws_made": {"type": "integer"},
            "away_free_throws_attempted": {"type": "integer"},
            "away_free_throw_pct": {"type": "float"},
            "away_offensive_rebounds": {"type": "integer"},
            "away_defensive_rebounds": {"type": "integer"},
            "away_total_rebounds": {"type": "integer"},
            "away_assists": {"type": "integer"},
            "away_steals": {"type": "integer"},
            "away_blocks": {"type": "integer"},
            "away_turnovers": {"type": "integer"},
            "away_personal_fouls": {"type": "integer"},
            "away_plus_minus": {"type": "integer"},

            # Game result fields
            "winner": {"type": "keyword"},
            "winning_team_id": {"type": "keyword"},
            "winning_team_name": {"type": "keyword"},
            "losing_team_id": {"type": "keyword"},
            "losing_team_name": {"type": "keyword"},
            "point_differential": {"type": "integer"},
            "total_points": {"type": "integer"},  # Combined score
            "overtime": {"type": "boolean"},

            "ingested_at": {"type": "date"}
        }
    }
}

# Player logs mapping (already flat - just minor improvements)
PLAYER_LOGS_MAPPING = {
    "mappings": {
        "properties": {
            "game_id": {"type": "keyword"},
            "game_date": {"type": "date"},
            "season": {"type": "keyword"},
            "season_type": {"type": "keyword"},

            # Player info
            "player_id": {"type": "keyword"},
            "player_name": {"type": "keyword"},

            # Team info
            "team_id": {"type": "keyword"},
            "team_name": {"type": "keyword"},
            "team_abbreviation": {"type": "keyword"},

            # Opponent info
            "opponent_team_id": {"type": "keyword"},
            "opponent_team_name": {"type": "keyword"},
            "opponent_abbreviation": {"type": "keyword"},

            # Game context
            "is_home_game": {"type": "boolean"},
            "matchup": {"type": "text"},
            "game_result": {"type": "keyword"},

            # Player stats
            "minutes_played": {"type": "float"},
            "points": {"type": "integer"},
            "field_goals_made": {"type": "integer"},
            "field_goals_attempted": {"type": "integer"},
            "field_goal_pct": {"type": "float"},
            "three_pointers_made": {"type": "integer"},
            "three_pointers_attempted": {"type": "integer"},
            "three_point_pct": {"type": "float"},
            "free_throws_made": {"type": "integer"},
            "free_throws_attempted": {"type": "integer"},
            "free_throw_pct": {"type": "float"},
            "offensive_rebounds": {"type": "integer"},
            "defensive_rebounds": {"type": "integer"},
            "total_rebounds": {"type": "integer"},
            "assists": {"type": "integer"},
            "steals": {"type": "integer"},
            "blocks": {"type": "integer"},
            "turnovers": {"type": "integer"},
            "personal_fouls": {"type": "integer"},
            "plus_minus": {"type": "integer"},

            # Advanced stats
            "fantasy_points": {"type": "float"},
            "double_double": {"type": "boolean"},
            "triple_double": {"type": "boolean"},

            "ingested_at": {"type": "date"}
        }
    }
}


def create_indices(es):
    """Create both indices with flattened mappings"""
    if not es.indices.exists(index=GAMES_INDEX):
        es.indices.create(index=GAMES_INDEX, body=GAMES_MAPPING)
        print(f"✅ Created index: {GAMES_INDEX}")
    else:
        print(f"Index {GAMES_INDEX} already exists")

    if not es.indices.exists(index=PLAYER_LOGS_INDEX):
        es.indices.create(index=PLAYER_LOGS_INDEX, body=PLAYER_LOGS_MAPPING)
        print(f"✅ Created index: {PLAYER_LOGS_INDEX}")
    else:
        print(f"Index {PLAYER_LOGS_INDEX} already exists")


def get_existing_game_ids(es):
    """Fetch all existing game IDs from the games index"""
    print(f"Checking for existing games in {GAMES_INDEX}...")
    try:
        query = {
            "_source": False,
            "query": {"match_all": {}}
        }
        existing_ids = set()

        response = es.search(
            index=GAMES_INDEX,
            body=query,
            scroll='2m',
            size=1000
        )

        scroll_id = response['_scroll_id']
        hits = response['hits']['hits']
        for hit in hits:
            existing_ids.add(hit['_id'])

        while len(hits) > 0:
            response = es.scroll(scroll_id=scroll_id, scroll='2m')
            scroll_id = response['_scroll_id']
            hits = response['hits']['hits']
            for hit in hits:
                existing_ids.add(hit['_id'])

        es.clear_scroll(scroll_id=scroll_id)
        print(f"Found {len(existing_ids)} existing games")
        return existing_ids

    except Exception as e:
        print(f"Error fetching existing game IDs: {str(e)}")
        return set()


def get_existing_player_log_ids(es):
    """Fetch all existing player log IDs"""
    print(f"Checking for existing player logs in {PLAYER_LOGS_INDEX}...")
    try:
        query = {
            "_source": False,
            "query": {"match_all": {}}
        }
        existing_ids = set()

        response = es.search(
            index=PLAYER_LOGS_INDEX,
            body=query,
            scroll='2m',
            size=1000
        )

        scroll_id = response['_scroll_id']
        hits = response['hits']['hits']
        for hit in hits:
            existing_ids.add(hit['_id'])

        while len(hits) > 0:
            response = es.scroll(scroll_id=scroll_id, scroll='2m')
            scroll_id = response['_scroll_id']
            hits = response['hits']['hits']
            for hit in hits:
                existing_ids.add(hit['_id'])

        es.clear_scroll(scroll_id=scroll_id)
        print(f"Found {len(existing_ids)} existing player logs")
        return existing_ids

    except Exception as e:
        print(f"Error fetching existing player log IDs: {str(e)}")
        return set()


def fetch_games_for_season(season):
    """Fetch all games for a given season"""
    print(f"Fetching games for season {season}...")
    try:
        game_finder = leaguegamefinder.LeagueGameFinder(
            season_nullable=season,
            league_id_nullable='00'
        )

        games_result = game_finder.get_data_frames()
        if isinstance(games_result, list):
            games_df = games_result[0]
        else:
            games_df = games_result

        if games_df is not None and not games_df.empty:
            print(f"Found {len(games_df)} game records")
            return games_df
        else:
            print(f"No games found for season {season}")
            return None

    except Exception as e:
        print(f"Error fetching games for {season}: {str(e)}")
        return None


def process_games_to_single_docs(games_df, season, existing_game_ids):
    """
    IMPROVED: Convert to flattened structure
    """
    if games_df is None or games_df.empty:
        return []

    game_groups = games_df.groupby('GAME_ID')
    game_docs = []
    skipped_count = 0

    for game_id, group in game_groups:
        if str(game_id) in existing_game_ids:
            skipped_count += 1
            continue

        if len(group) != 2:
            continue

        group_sorted = group.sort_values('MATCHUP')
        row1 = group_sorted.iloc[0]
        row2 = group_sorted.iloc[1]

        if ' vs. ' in str(row1.get('MATCHUP', '')):
            home_row, away_row = row1, row2
        elif ' @ ' in str(row1.get('MATCHUP', '')):
            home_row, away_row = row2, row1
        else:
            home_row, away_row = row1, row2

        home_points = int(home_row.get('PTS', 0))
        away_points = int(away_row.get('PTS', 0))
        is_home_winner = home_row.get('WL') == 'W'

        # CHANGED: Flattened structure instead of nested objects
        game_doc = {
            '_index': GAMES_INDEX,
            '_id': game_id,
            'game_id': game_id,
            'game_date': home_row.get('GAME_DATE'),
            'season': season,
            'season_type': home_row.get('SEASON_ID', '').split('-')[
                -1] if 'SEASON_ID' in home_row else 'Regular Season',

            # Home team fields (flattened with prefix)
            'home_team_id': str(home_row.get('TEAM_ID', '')),
            'home_team_name': home_row.get('TEAM_NAME', ''),
            'home_team_abbreviation': home_row.get('TEAM_ABBREVIATION', ''),
            'home_points': home_points,
            'home_field_goals_made': int(home_row.get('FGM', 0)),
            'home_field_goals_attempted': int(home_row.get('FGA', 0)),
            'home_field_goal_pct': float(home_row.get('FG_PCT', 0)),
            'home_three_pointers_made': int(home_row.get('FG3M', 0)),
            'home_three_pointers_attempted': int(home_row.get('FG3A', 0)),
            'home_three_point_pct': float(home_row.get('FG3_PCT', 0)),
            'home_free_throws_made': int(home_row.get('FTM', 0)),
            'home_free_throws_attempted': int(home_row.get('FTA', 0)),
            'home_free_throw_pct': float(home_row.get('FT_PCT', 0)),
            'home_offensive_rebounds': int(home_row.get('OREB', 0)),
            'home_defensive_rebounds': int(home_row.get('DREB', 0)),
            'home_total_rebounds': int(home_row.get('REB', 0)),
            'home_assists': int(home_row.get('AST', 0)),
            'home_steals': int(home_row.get('STL', 0)),
            'home_blocks': int(home_row.get('BLK', 0)),
            'home_turnovers': int(home_row.get('TOV', 0)),
            'home_personal_fouls': int(home_row.get('PF', 0)),
            'home_plus_minus': int(home_row.get('PLUS_MINUS', 0)),

            # Away team fields (flattened with prefix)
            'away_team_id': str(away_row.get('TEAM_ID', '')),
            'away_team_name': away_row.get('TEAM_NAME', ''),
            'away_team_abbreviation': away_row.get('TEAM_ABBREVIATION', ''),
            'away_points': away_points,
            'away_field_goals_made': int(away_row.get('FGM', 0)),
            'away_field_goals_attempted': int(away_row.get('FGA', 0)),
            'away_field_goal_pct': float(away_row.get('FG_PCT', 0)),
            'away_three_pointers_made': int(away_row.get('FG3M', 0)),
            'away_three_pointers_attempted': int(away_row.get('FG3A', 0)),
            'away_three_point_pct': float(away_row.get('FG3_PCT', 0)),
            'away_free_throws_made': int(away_row.get('FTM', 0)),
            'away_free_throws_attempted': int(away_row.get('FTA', 0)),
            'away_free_throw_pct': float(away_row.get('FT_PCT', 0)),
            'away_offensive_rebounds': int(away_row.get('OREB', 0)),
            'away_defensive_rebounds': int(away_row.get('DREB', 0)),
            'away_total_rebounds': int(away_row.get('REB', 0)),
            'away_assists': int(away_row.get('AST', 0)),
            'away_steals': int(away_row.get('STL', 0)),
            'away_blocks': int(away_row.get('BLK', 0)),
            'away_turnovers': int(away_row.get('TOV', 0)),
            'away_personal_fouls': int(away_row.get('PF', 0)),
            'away_plus_minus': int(away_row.get('PLUS_MINUS', 0)),

            # Game result fields
            'winner': 'home' if is_home_winner else 'away',
            'winning_team_id': str(home_row.get('TEAM_ID', '')) if is_home_winner else str(away_row.get('TEAM_ID', '')),
            'winning_team_name': home_row.get('TEAM_NAME', '') if is_home_winner else away_row.get('TEAM_NAME', ''),
            'losing_team_id': str(away_row.get('TEAM_ID', '')) if is_home_winner else str(home_row.get('TEAM_ID', '')),
            'losing_team_name': away_row.get('TEAM_NAME', '') if is_home_winner else home_row.get('TEAM_NAME', ''),
            'point_differential': abs(home_points - away_points),
            'total_points': home_points + away_points,
            'overtime': False,

            'ingested_at': datetime.now(timezone.utc).isoformat()
        }

        game_docs.append(game_doc)

    if skipped_count > 0:
        print(f"Skipped {skipped_count} existing games")

    return game_docs


def ingest_games(es, season, existing_game_ids):
    """Ingest game-level data for a season"""
    games_df = fetch_games_for_season(season)
    if games_df is None or games_df.empty:
        return 0

    game_docs = process_games_to_single_docs(games_df, season, existing_game_ids)

    if not game_docs:
        print(f"No new games to ingest for {season}")
        return 0

    print(f"Ingesting {len(game_docs)} new games for {season}...")
    try:
        success, failed = helpers.bulk(
            es,
            game_docs,
            raise_on_error=False,
            stats_only=False
        )

        print(f"✅ Ingested {success} games, {len(failed)} failed")
        if failed:
            print(f"First error: {failed[0]}")

        return success

    except Exception as e:
        print(f"Error during bulk ingestion: {str(e)}")
        return 0


def fetch_player_logs_for_season(season):
    """Fetch player game logs for a season"""
    print(f"Fetching player game logs for season {season}...")
    try:
        player_logs = playergamelogs.PlayerGameLogs(
            season_nullable=season,
            league_id_nullable='00'
        )

        logs_result = player_logs.get_data_frames()
        if isinstance(logs_result, list):
            logs_df = logs_result[0]
        else:
            logs_df = logs_result

        if logs_df is not None and not logs_df.empty:
            print(f"Found {len(logs_df)} player game log entries")
            return logs_df
        else:
            print(f"No player logs found for season {season}")
            return None

    except Exception as e:
        print(f"Error fetching player logs for {season}: {str(e)}")
        return None


def process_player_logs(logs_df, season, existing_player_log_ids):
    """Convert player logs DataFrame to documents"""
    if logs_df is None or logs_df.empty:
        return []

    player_docs = []
    skipped_count = 0

    for _, row in logs_df.iterrows():
        try:
            doc_id = f"{row.get('PLAYER_ID')}_{row.get('GAME_ID')}"

            if doc_id in existing_player_log_ids:
                skipped_count += 1
                continue

            matchup = str(row.get('MATCHUP', ''))
            is_home = ' vs. ' in matchup

            if ' vs. ' in matchup:
                opponent_abbr = matchup.split(' vs. ')[-1].strip()
            elif ' @ ' in matchup:
                opponent_abbr = matchup.split(' @ ')[-1].strip()
            else:
                opponent_abbr = ''

            stats_10_plus = sum([
                1 if row.get('PTS', 0) >= 10 else 0,
                1 if row.get('REB', 0) >= 10 else 0,
                1 if row.get('AST', 0) >= 10 else 0,
                1 if row.get('STL', 0) >= 10 else 0,
                1 if row.get('BLK', 0) >= 10 else 0
            ])

            doc = {
                '_index': PLAYER_LOGS_INDEX,
                '_id': doc_id,
                'game_id': str(row.get('GAME_ID', '')),
                'game_date': row.get('GAME_DATE'),
                'season': season,
                'season_type': row.get('SEASON_YEAR', season),
                'player_id': str(row.get('PLAYER_ID', '')),
                'player_name': row.get('PLAYER_NAME', ''),
                'team_id': str(row.get('TEAM_ID', '')),
                'team_name': row.get('TEAM_NAME', ''),
                'team_abbreviation': row.get('TEAM_ABBREVIATION', ''),
                'opponent_abbreviation': opponent_abbr,
                'is_home_game': is_home,
                'matchup': matchup,
                'game_result': row.get('WL', ''),
                'minutes_played': float(row.get('MIN', 0)) if row.get('MIN') else 0,
                'points': int(row.get('PTS', 0)),
                'field_goals_made': int(row.get('FGM', 0)),
                'field_goals_attempted': int(row.get('FGA', 0)),
                'field_goal_pct': float(row.get('FG_PCT', 0)) if row.get('FG_PCT') else 0,
                'three_pointers_made': int(row.get('FG3M', 0)),
                'three_pointers_attempted': int(row.get('FG3A', 0)),
                'three_point_pct': float(row.get('FG3_PCT', 0)) if row.get('FG3_PCT') else 0,
                'free_throws_made': int(row.get('FTM', 0)),
                'free_throws_attempted': int(row.get('FTA', 0)),
                'free_throw_pct': float(row.get('FT_PCT', 0)) if row.get('FT_PCT') else 0,
                'offensive_rebounds': int(row.get('OREB', 0)),
                'defensive_rebounds': int(row.get('DREB', 0)),
                'total_rebounds': int(row.get('REB', 0)),
                'assists': int(row.get('AST', 0)),
                'steals': int(row.get('STL', 0)),
                'blocks': int(row.get('BLK', 0)),
                'turnovers': int(row.get('TOV', 0)),
                'personal_fouls': int(row.get('PF', 0)),
                'plus_minus': int(row.get('PLUS_MINUS', 0)),
                'fantasy_points': float(row.get('FANTASY_PTS', 0)) if 'FANTASY_PTS' in row else None,
                'double_double': stats_10_plus >= 2,
                'triple_double': stats_10_plus >= 3,
                'ingested_at': datetime.now(timezone.utc).isoformat()
            }

            player_docs.append(doc)

        except Exception as e:
            print(f"Error processing player log row: {str(e)}")
            continue

    if skipped_count > 0:
        print(f"Skipped {skipped_count} existing player logs")

    return player_docs


def ingest_player_logs(es, season, existing_player_log_ids):
    """Ingest player game logs for a season"""
    logs_df = fetch_player_logs_for_season(season)
    if logs_df is None or logs_df.empty:
        return 0

    player_docs = process_player_logs(logs_df, season, existing_player_log_ids)

    if not player_docs:
        print(f"No new player logs to ingest for {season}")
        return 0

    print(f"Ingesting {len(player_docs)} new player game logs for {season}...")

    batch_size = 1000
    total_success = 0

    for i in range(0, len(player_docs), batch_size):
        batch = player_docs[i:i + batch_size]
        try:
            success, failed = helpers.bulk(
                es,
                batch,
                raise_on_error=False,
                stats_only=False
            )

            total_success += success
            if failed:
                print(f"Batch {i // batch_size + 1}: {len(failed)} documents failed")

            time.sleep(0.5)

        except Exception as e:
            print(f"Error in batch {i // batch_size + 1}: {str(e)}")

    print(f"✅ Successfully ingested {total_success} player game logs")
    return total_success


def main():
    """Main ingestion pipeline"""
    print("=" * 60)
    print("NBA GAME DATA INGESTION - ES|QL COMPATIBLE")
    print("=" * 60)

    load_dotenv()
    es = Elasticsearch(
        os.getenv('ELASTICSEARCH_URL'),
        api_key=os.getenv('ELASTICSEARCH_API_KEY')
    )

    create_indices(es)
    print()

    existing_game_ids = get_existing_game_ids(es)
    existing_player_log_ids = get_existing_player_log_ids(es)
    print()

    total_games = 0
    total_player_logs = 0

    for season in SEASONS:
        print(f"\n{'=' * 60}")
        print(f"PROCESSING SEASON: {season}")
        print(f"{'=' * 60}")

        games_count = ingest_games(es, season, existing_game_ids)
        total_games += games_count

        if games_count > 0:
            time.sleep(1)

        time.sleep(1)

        logs_count = ingest_player_logs(es, season, existing_player_log_ids)
        total_player_logs += logs_count

        time.sleep(2)

    print(f"\n{'=' * 60}")
    print("INGESTION COMPLETE")
    print(f"{'=' * 60}")
    print(f"New games ingested: {total_games}")
    print(f"New player game logs ingested: {total_player_logs}")
    print(f"{'=' * 60}")

    print("\n📊 Example ES|QL Queries:")
    print("\n1. High-scoring games:")
    print(f'FROM {GAMES_INDEX} | WHERE total_points > 230 | SORT total_points DESC | LIMIT 10')

    print("\n2. Close games (within 5 points):")
    print(f'FROM {GAMES_INDEX} | WHERE point_differential <= 5 | STATS count = COUNT(*) BY winner')

    print("\n3. Player triple-doubles:")
    print(f'FROM {PLAYER_LOGS_INDEX} | WHERE triple_double == true | SORT game_date DESC')


if __name__ == "__main__":
    main()
