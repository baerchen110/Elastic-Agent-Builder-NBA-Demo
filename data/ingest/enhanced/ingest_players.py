#!/usr/bin/env python3

"""
NBA Player Data Ingestion - ES|QL COMPATIBLE VERSION
Uses two-index architecture to eliminate nested fields:
1. nba_players_enhanced - Core player information
2. nba_player_season_stats - Season-by-season stats (separate index)
"""

from nba_api.stats.static import players
from nba_api.stats.endpoints import commonplayerinfo, playercareerstats
from elasticsearch import Elasticsearch, helpers
from datetime import datetime, timezone
from dotenv import load_dotenv
import time
import os
import json

load_dotenv()

es = Elasticsearch(
    os.getenv('ELASTICSEARCH_URL'),
    api_key=os.getenv('ELASTICSEARCH_API_KEY')
)

PLAYERS_INDEX = 'nba_players_enhanced'
PLAYER_SEASONS_INDEX = 'nba_player_season_stats'

# IMPROVED: Core player info without nested fields
PLAYER_MAPPING = {
    "settings": {
        "index": {
            "mode": "lookup"
        }
    },
    "mappings": {
        "properties": {
            "player_id": {"type": "keyword"},
            "full_name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
            "first_name": {"type": "text"},
            "last_name": {"type": "text"},
            "display_name": {"type": "text"},
            "jersey": {"type": "keyword"},
            "position": {"type": "keyword"},
            "height": {"type": "keyword"},
            "weight": {"type": "keyword"},
            "birthdate": {"type": "date", "format": "yyyy-MM-dd||epoch_millis||strict_date_optional_time"},
            "age": {"type": "integer"},
            "country": {"type": "keyword"},
            "school": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
            "draft_year": {"type": "integer"},
            "draft_round": {"type": "integer"},
            "draft_number": {"type": "integer"},
            "team_id": {"type": "keyword"},
            "team_name": {"type": "keyword"},
            "team_abbreviation": {"type": "keyword"},
            "seasons_played": {"type": "integer"},
            "current_season_active": {"type": "boolean"},

            # REMOVED: career_stats object and season_stats nested
            # ADDED: Flattened career averages (ES|QL friendly)
            "career_games_played": {"type": "integer"},
            "career_points_per_game": {"type": "float"},
            "career_rebounds_per_game": {"type": "float"},
            "career_assists_per_game": {"type": "float"},
            "career_steals_per_game": {"type": "float"},
            "career_blocks_per_game": {"type": "float"},
            "career_field_goal_pct": {"type": "float"},
            "career_three_point_pct": {"type": "float"},
            "career_free_throw_pct": {"type": "float"},

            # Latest season stats (flattened)
            "latest_season": {"type": "keyword"},
            "latest_season_team": {"type": "keyword"},
            "latest_season_ppg": {"type": "float"},
            "latest_season_rpg": {"type": "float"},
            "latest_season_apg": {"type": "float"},
            "latest_season_games": {"type": "integer"},

            "active": {"type": "boolean"},
            "ingested_at": {"type": "date"},
            "data_source": {"type": "keyword"}
        }
    }
}

# NEW: Separate index for player season stats
PLAYER_SEASON_MAPPING = {
    "mappings": {
        "properties": {
            # Composite ID: player_id + season_id
            "player_id": {"type": "keyword"},
            "player_name": {"type": "keyword"},
            "season_id": {"type": "keyword"},
            "season_year_start": {"type": "integer"},
            "team_id": {"type": "keyword"},
            "team_abbreviation": {"type": "keyword"},
            "player_age": {"type": "integer"},

            # Game counts
            "games_played": {"type": "integer"},
            "games_started": {"type": "integer"},
            "minutes_played": {"type": "float"},

            # Shooting stats
            "field_goals_made": {"type": "integer"},
            "field_goals_attempted": {"type": "integer"},
            "field_goal_pct": {"type": "float"},
            "three_pointers_made": {"type": "integer"},
            "three_pointers_attempted": {"type": "integer"},
            "three_point_pct": {"type": "float"},
            "free_throws_made": {"type": "integer"},
            "free_throws_attempted": {"type": "integer"},
            "free_throw_pct": {"type": "float"},

            # Rebounding stats
            "offensive_rebounds": {"type": "integer"},
            "defensive_rebounds": {"type": "integer"},
            "total_rebounds": {"type": "integer"},

            # Other stats
            "assists": {"type": "integer"},
            "steals": {"type": "integer"},
            "blocks": {"type": "integer"},
            "turnovers": {"type": "integer"},
            "personal_fouls": {"type": "integer"},
            "points": {"type": "integer"},

            # Per-game averages (flattened)
            "ppg": {"type": "float"},
            "rpg": {"type": "float"},
            "apg": {"type": "float"},
            "spg": {"type": "float"},
            "bpg": {"type": "float"},
            "mpg": {"type": "float"},

            "ingested_at": {"type": "date"}
        }
    }
}


def create_indices():
    """Create both indices"""
    if es.indices.exists(index=PLAYERS_INDEX):
        print(f"Index {PLAYERS_INDEX} already exists")
    else:
        es.indices.create(index=PLAYERS_INDEX, body=PLAYER_MAPPING)
        print(f"✅ Created index: {PLAYERS_INDEX}")

    if es.indices.exists(index=PLAYER_SEASONS_INDEX):
        print(f"Index {PLAYER_SEASONS_INDEX} already exists")
    else:
        es.indices.create(index=PLAYER_SEASONS_INDEX, body=PLAYER_SEASON_MAPPING)
        print(f"✅ Created index: {PLAYER_SEASONS_INDEX}")


def fetch_active_players():
    """Fetch only active NBA players"""
    print("📥 Fetching active players from NBA API...")
    active_players = players.get_active_players()
    print(f"✅ Found {len(active_players)} active players")
    return active_players


def safe_float(value, decimals=1):
    """Safely convert to float with rounding"""
    if value is None or value == '':
        return 0.0
    try:
        return round(float(value), decimals)
    except (ValueError, TypeError):
        return 0.0


def safe_int(value):
    """Safely convert to integer"""
    if value is None or value == '':
        return 0
    try:
        return int(value)
    except (ValueError, TypeError):
        return 0


def parse_season_year(season_id):
    """Extract start year from season_id like '2024-25'"""
    try:
        return int(season_id.split('-')[0])
    except:
        return None


def transform_season_stats(player_id, player_name, season_data):
    """Transform season stats into separate documents"""
    season_docs = []

    for season in season_data:
        gp = safe_int(season.get('GP', 0))
        if gp == 0:
            continue

        season_id = season.get('SEASON_ID', '')
        season_year = parse_season_year(season_id)

        season_doc = {
            "_index": PLAYER_SEASONS_INDEX,
            "_id": f"{player_id}_{season_id}",
            "player_id": str(player_id),
            "player_name": player_name,
            "season_id": season_id,
            "season_year_start": season_year,
            "team_id": str(season.get('TEAM_ID', '')),
            "team_abbreviation": season.get('TEAM_ABBREVIATION', ''),
            "player_age": safe_int(season.get('PLAYER_AGE', 0)),
            "games_played": gp,
            "games_started": safe_int(season.get('GS', 0)),
            "minutes_played": safe_float(season.get('MIN', 0)),
            "field_goals_made": safe_int(season.get('FGM', 0)),
            "field_goals_attempted": safe_int(season.get('FGA', 0)),
            "field_goal_pct": safe_float(season.get('FG_PCT', 0) * 100 if season.get('FG_PCT') else 0),
            "three_pointers_made": safe_int(season.get('FG3M', 0)),
            "three_pointers_attempted": safe_int(season.get('FG3A', 0)),
            "three_point_pct": safe_float(season.get('FG3_PCT', 0) * 100 if season.get('FG3_PCT') else 0),
            "free_throws_made": safe_int(season.get('FTM', 0)),
            "free_throws_attempted": safe_int(season.get('FTA', 0)),
            "free_throw_pct": safe_float(season.get('FT_PCT', 0) * 100 if season.get('FT_PCT') else 0),
            "offensive_rebounds": safe_int(season.get('OREB', 0)),
            "defensive_rebounds": safe_int(season.get('DREB', 0)),
            "total_rebounds": safe_int(season.get('REB', 0)),
            "assists": safe_int(season.get('AST', 0)),
            "steals": safe_int(season.get('STL', 0)),
            "blocks": safe_int(season.get('BLK', 0)),
            "turnovers": safe_int(season.get('TOV', 0)),
            "personal_fouls": safe_int(season.get('PF', 0)),
            "points": safe_int(season.get('PTS', 0)),
            "ppg": safe_float(season.get('PTS', 0) / gp if gp > 0 else 0),
            "rpg": safe_float(season.get('REB', 0) / gp if gp > 0 else 0),
            "apg": safe_float(season.get('AST', 0) / gp if gp > 0 else 0),
            "spg": safe_float(season.get('STL', 0) / gp if gp > 0 else 0),
            "bpg": safe_float(season.get('BLK', 0) / gp if gp > 0 else 0),
            "mpg": safe_float(season.get('MIN', 0) / gp if gp > 0 else 0),
            "ingested_at": datetime.now(timezone.utc).isoformat()
        }

        season_docs.append(season_doc)

    return season_docs


def transform_player_data(player_basic, player_info, career_stats):
    """Transform player data to ES|QL-friendly structure"""

    player_doc = {
        "player_id": str(player_basic['id']),
        "full_name": player_basic['full_name'],
        "first_name": player_basic.get('first_name', ''),
        "last_name": player_basic.get('last_name', ''),
        "display_name": player_basic['full_name'],
        "active": True,
        "current_season_active": True,
        "data_source": "nba_api",
        "ingested_at": datetime.now(timezone.utc).isoformat()
    }

    # Add detailed info
    if player_info and 'CommonPlayerInfo' in player_info:
        info_list = player_info['CommonPlayerInfo']
        info = info_list[0] if isinstance(info_list, list) and len(info_list) > 0 else {}

        birthdate = info.get('BIRTHDATE', '')
        if birthdate and birthdate.strip():
            if 'T' in birthdate:
                birthdate = birthdate.split('T')[0]
        else:
            birthdate = None

        player_doc.update({
            "jersey": str(info.get('JERSEY', '')) if info.get('JERSEY') else '',
            "position": info.get('POSITION', '') or '',
            "height": info.get('HEIGHT', '') or '',
            "weight": info.get('WEIGHT', '') or '',
            "birthdate": birthdate,
            "country": info.get('COUNTRY', '') or '',
            "school": info.get('SCHOOL', '') or '',
            "draft_year": int(info.get('DRAFT_YEAR')) if info.get('DRAFT_YEAR') and str(
                info.get('DRAFT_YEAR')).strip() and str(info.get('DRAFT_YEAR')) != 'Undrafted' else None,
            "draft_round": int(info.get('DRAFT_ROUND')) if info.get('DRAFT_ROUND') and str(
                info.get('DRAFT_ROUND')).isdigit() else None,
            "draft_number": int(info.get('DRAFT_NUMBER')) if info.get('DRAFT_NUMBER') and str(
                info.get('DRAFT_NUMBER')).isdigit() else None,
            "team_id": str(info.get('TEAM_ID', '')) if info.get('TEAM_ID') else '',
            "team_name": info.get('TEAM_NAME', '') or '',
            "team_abbreviation": info.get('TEAM_ABBREVIATION', '') or '',
            "seasons_played": int(info.get('SEASON_EXP', 0)) if info.get('SEASON_EXP') is not None else 0
        })

    season_docs = []

    # CHANGED: Extract flattened career stats instead of object
    if career_stats:
        if 'CareerTotalsRegularSeason' in career_stats:
            career_list = career_stats['CareerTotalsRegularSeason']
            career = career_list[0] if isinstance(career_list, list) and len(career_list) > 0 else {}

            games = career.get('GP', 1) or 1
            player_doc.update({
                "career_games_played": safe_int(career.get('GP', 0)),
                "career_points_per_game": safe_float(career.get('PTS', 0) / games),
                "career_rebounds_per_game": safe_float(career.get('REB', 0) / games),
                "career_assists_per_game": safe_float(career.get('AST', 0) / games),
                "career_steals_per_game": safe_float(career.get('STL', 0) / games),
                "career_blocks_per_game": safe_float(career.get('BLK', 0) / games),
                "career_field_goal_pct": safe_float(career.get('FG_PCT', 0) * 100 if career.get('FG_PCT') else 0),
                "career_three_point_pct": safe_float(career.get('FG3_PCT', 0) * 100 if career.get('FG3_PCT') else 0),
                "career_free_throw_pct": safe_float(career.get('FT_PCT', 0) * 100 if career.get('FT_PCT') else 0)
            })

        # Season-by-season stats -> separate documents
        if 'SeasonTotalsRegularSeason' in career_stats:
            season_list = career_stats['SeasonTotalsRegularSeason']
            if isinstance(season_list, list) and len(season_list) > 0:
                season_docs = transform_season_stats(
                    player_basic['id'],
                    player_basic['full_name'],
                    season_list
                )

                # Add latest season info to player doc
                if season_docs:
                    # Sort by season_id to get latest
                    latest = max(season_docs, key=lambda x: x.get('season_id', ''))
                    player_doc.update({
                        "latest_season": latest.get('season_id', ''),
                        "latest_season_team": latest.get('team_abbreviation', ''),
                        "latest_season_ppg": latest.get('ppg', 0),
                        "latest_season_rpg": latest.get('rpg', 0),
                        "latest_season_apg": latest.get('apg', 0),
                        "latest_season_games": latest.get('games_played', 0)
                    })

    return player_doc, season_docs


def fetch_player_details(player_id, max_retries=5, initial_timeout=30):
    """Fetch detailed player information with improved retry logic"""
    for attempt in range(max_retries):
        timeout = initial_timeout * (1.5 ** attempt)
        try:
            player_info = commonplayerinfo.CommonPlayerInfo(
                player_id=player_id,
                timeout=int(timeout)
            )
            info_dict = player_info.get_normalized_dict()

            career_stats = playercareerstats.PlayerCareerStats(
                player_id=player_id,
                timeout=int(timeout)
            )
            career_dict = career_stats.get_normalized_dict()

            time.sleep(0.4)
            return info_dict, career_dict

        except KeyError as e:
            if attempt == 0:
                print(f"  ⚠️ Player {player_id} has incomplete data: {e}")
            return None, None

        except Exception as e:
            error_msg = str(e)
            if 'timeout' in error_msg.lower() or 'timed out' in error_msg.lower():
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    print(f"  ⏳ Timeout for player {player_id}, retry {attempt + 2}/{max_retries} in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                else:
                    print(f"  ❌ Player {player_id} timed out after {max_retries} attempts")
                    return None, None
            else:
                if attempt == 0:
                    print(f"  ❌ Error for player {player_id}: {error_msg[:100]}")
                return None, None

    return None, None


def save_checkpoint(filename, processed_ids):
    """Save processed player IDs to checkpoint file"""
    with open(filename, 'w') as f:
        json.dump(list(processed_ids), f)


def load_checkpoint(filename):
    """Load processed player IDs from checkpoint file"""
    if os.path.exists(filename):
        with open(filename, 'r') as f:
            return set(json.load(f))
    return set()


def bulk_ingest_players(players_list, batch_size=25, checkpoint_file='ingest_checkpoint.json'):
    """Bulk ingest players with checkpointing"""
    print(f"\n📤 Ingesting {len(players_list)} active players...")
    print(f"  Batch size: {batch_size} | Checkpoint: {checkpoint_file}")

    processed_ids = load_checkpoint(checkpoint_file)
    if processed_ids:
        print(f"  ℹ️ Resuming from checkpoint: {len(processed_ids)} already processed")

    player_actions = []
    season_actions = []
    successful_count = 0
    failed_count = 0
    skipped_count = len(processed_ids)

    for idx, player in enumerate(players_list):
        player_id = str(player['id'])

        if player_id in processed_ids:
            continue

        if idx % 10 == 0:
            print(
                f"\n  Progress: {idx}/{len(players_list)} | ✅ {successful_count} | ❌ {failed_count} | ⏭️ {skipped_count}")

        print(f"  Processing: {player['full_name']} (ID: {player_id})")

        try:
            player_info, career_stats = fetch_player_details(player_id)
            player_doc, season_docs = transform_player_data(player, player_info, career_stats)

            player_actions.append({
                "_index": PLAYERS_INDEX,
                "_id": player_doc["player_id"],
                "_source": player_doc
            })

            season_actions.extend(season_docs)

            # Bulk index when batch is full
            if len(player_actions) >= batch_size:
                try:
                    # Index players
                    success_p, errors_p = helpers.bulk(es, player_actions, raise_on_error=False, stats_only=False)
                    successful_count += success_p

                    # Index seasons
                    if season_actions:
                        success_s, errors_s = helpers.bulk(es, season_actions, raise_on_error=False, stats_only=False)

                    # Update checkpoint
                    for action in player_actions:
                        processed_ids.add(action["_id"])
                    save_checkpoint(checkpoint_file, processed_ids)

                    if errors_p:
                        failed_count += len(errors_p)
                        print(f"  ⚠️ {len(errors_p)} players failed")
                    else:
                        print(f"  ✅ Batch ingested: {success_p} players, {len(season_actions)} season records")

                    player_actions = []
                    season_actions = []

                except Exception as e:
                    print(f"  ❌ Bulk error: {e}")
                    failed_count += len(player_actions)
                    player_actions = []
                    season_actions = []

        except Exception as e:
            print(f"  ❌ Error processing {player['full_name']}: {e}")
            failed_count += 1
            continue

    # Process remaining actions
    if player_actions:
        try:
            success_p, errors_p = helpers.bulk(es, player_actions, raise_on_error=False, stats_only=False)
            successful_count += success_p

            if season_actions:
                success_s, errors_s = helpers.bulk(es, season_actions, raise_on_error=False, stats_only=False)

            for action in player_actions:
                processed_ids.add(action["_id"])
            save_checkpoint(checkpoint_file, processed_ids)

            if errors_p:
                failed_count += len(errors_p)
            else:
                print(f"  ✅ Final batch: {success_p} players, {len(season_actions)} season records")

        except Exception as e:
            print(f"  ❌ Final bulk error: {e}")

    print(f"\n{'=' * 60}")
    print(f"✅ Successfully ingested: {successful_count} players")
    print(f"⏭️ Skipped (checkpoint): {skipped_count} players")
    if failed_count > 0:
        print(f"⚠️ Failed to ingest: {failed_count} players")
    print(f"{'=' * 60}")

    if failed_count == 0 and os.path.exists(checkpoint_file):
        os.remove(checkpoint_file)
        print(f"🧹 Removed checkpoint file")


def main():
    """Main ingestion flow"""
    print("=" * 60)
    print("NBA PLAYER DATA INGESTION - ES|QL COMPATIBLE")
    print("=" * 60)

    create_indices()
    active_players = fetch_active_players()
    bulk_ingest_players(active_players, batch_size=25)

    player_count = es.count(index=PLAYERS_INDEX)['count']
    season_count = es.count(index=PLAYER_SEASONS_INDEX)['count']

    print(f"\n✅ Index {PLAYERS_INDEX} has {player_count} players")
    print(f"✅ Index {PLAYER_SEASONS_INDEX} has {season_count} season records")
    print("\n" + "=" * 60)
    print("INGESTION COMPLETE")
    print("=" * 60)

    print("\n📊 Example ES|QL Queries:")
    print("\n1. Top scorers (career average):")
    print(f'FROM {PLAYERS_INDEX} | SORT career_points_per_game DESC | LIMIT 10')

    print("\n2. Player season progression:")
    print(f'FROM {PLAYER_SEASONS_INDEX} | WHERE player_name == "LeBron James" | SORT season_year_start')

    print("\n3. Best seasons by PPG:")
    print(f'FROM {PLAYER_SEASONS_INDEX} | WHERE games_played > 50 | SORT ppg DESC | LIMIT 10')


if __name__ == "__main__":
    main()
