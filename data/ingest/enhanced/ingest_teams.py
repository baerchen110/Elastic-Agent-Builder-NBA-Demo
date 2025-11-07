#!/usr/bin/env python3

"""
NBA Team Data Ingestion - ES|QL COMPATIBLE VERSION
Eliminates nested fields using a two-index architecture:
1. nba_teams_enhanced - Core team information
2. nba_team_season_stats - Season-by-season stats (separate index)
"""

from nba_api.stats.static import teams
from nba_api.stats.endpoints import teamdetails, teaminfocommon, teamyearbyyearstats
from elasticsearch import Elasticsearch, helpers
from datetime import datetime, UTC
from dotenv import load_dotenv
import time
import os

load_dotenv()

es = Elasticsearch(
    os.getenv('ELASTICSEARCH_URL'),
    api_key=os.getenv('ELASTICSEARCH_API_KEY')
)

# Two separate indices
TEAMS_INDEX = 'nba_teams_enhanced'
TEAM_SEASONS_INDEX = 'nba_team_season_stats'

SEASONS = ['2020-21', '2021-22', '2022-23', '2023-24', '2024-25', '2025-26']

# IMPROVED: Core team info without nested fields
TEAM_MAPPING = {
    "settings": {
        "index": {
            "mode": "lookup"
        }
    },
    "mappings": {
        "properties": {
            "team_id": {"type": "keyword"},
            "team_name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
            "abbreviation": {"type": "keyword"},
            "nickname": {"type": "text"},
            "city": {"type": "keyword"},
            "state": {"type": "keyword"},
            "year_founded": {"type": "integer"},
            "arena": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
            "arena_capacity": {"type": "integer"},
            "owner": {"type": "text"},
            "general_manager": {"type": "text"},
            "head_coach": {"type": "text"},
            "conference": {"type": "keyword"},
            "division": {"type": "keyword"},
            "current_season": {"type": "keyword"},

            # REMOVED: season_stats nested field
            # ADDED: Aggregated career totals (ES|QL friendly)
            "total_seasons_played": {"type": "integer"},
            "total_wins": {"type": "integer"},
            "total_losses": {"type": "integer"},
            "career_win_pct": {"type": "float"},
            "championships_won": {"type": "integer"},
            "playoff_appearances": {"type": "integer"},

            # Latest season summary (flattened)
            "latest_season": {"type": "keyword"},
            "latest_season_wins": {"type": "integer"},
            "latest_season_losses": {"type": "integer"},
            "latest_season_win_pct": {"type": "float"},

            "ingested_at": {"type": "date"},
            "data_source": {"type": "keyword"}
        }
    }
}

# NEW: Separate index for season stats (ES|QL friendly)
TEAM_SEASON_MAPPING = {
    "mappings": {
        "properties": {
            # Composite ID: team_id + season
            "team_id": {"type": "keyword"},
            "team_name": {"type": "keyword"},
            "team_abbreviation": {"type": "keyword"},
            "season": {"type": "keyword"},
            "season_year_start": {"type": "integer"},  # For range queries
            "season_year_end": {"type": "integer"},

            # Stats
            "wins": {"type": "integer"},
            "losses": {"type": "integer"},
            "win_pct": {"type": "float"},
            "playoff_appearance": {"type": "boolean"},
            "champion": {"type": "boolean"},
            "conference_finals": {"type": "boolean"},
            "nba_finals": {"type": "boolean"},

            "ingested_at": {"type": "date"}
        }
    }
}


def create_indices():
    """Create both indices"""
    # Teams index
    if es.indices.exists(index=TEAMS_INDEX):
        print(f"Index {TEAMS_INDEX} already exists")
    else:
        es.indices.create(index=TEAMS_INDEX, body=TEAM_MAPPING)
        print(f"✅ Created index: {TEAMS_INDEX}")

    # Team seasons index
    if es.indices.exists(index=TEAM_SEASONS_INDEX):
        print(f"Index {TEAM_SEASONS_INDEX} already exists")
    else:
        es.indices.create(index=TEAM_SEASONS_INDEX, body=TEAM_SEASON_MAPPING)
        print(f"✅ Created index: {TEAM_SEASONS_INDEX}")


def fetch_all_teams():
    print("📥 Fetching all teams from NBA API...")
    all_teams = teams.get_teams()
    print(f"✅ Found {len(all_teams)} teams")
    return all_teams


def fetch_team_details(team_id):
    """Fetch team details, info, and historical stats"""
    try:
        team_details = teamdetails.TeamDetails(team_id=team_id)
        details_dict = team_details.get_normalized_dict()

        team_info = teaminfocommon.TeamInfoCommon(team_id=team_id)
        info_dict = team_info.get_normalized_dict()

        team_stats = teamyearbyyearstats.TeamYearByYearStats(team_id=team_id)
        stats_dict = team_stats.get_normalized_dict()

        time.sleep(0.6)
        return details_dict, info_dict, stats_dict

    except Exception as e:
        print(f"❌ Error fetching team {team_id}: {e}")
        return None, None, None


def parse_season_years(season_str):
    """Convert '2024-25' to (2024, 2025) for range queries"""
    try:
        parts = season_str.split('-')
        if len(parts) == 2:
            start_year = int(parts[0])
            end_year = int('20' + parts[1]) if len(parts[1]) == 2 else int(parts[1])
            return start_year, end_year
    except:
        pass
    return None, None


def transform_team_data(team_basic, team_details, team_info, team_stats):
    """Transform to ES|QL-friendly structure"""

    # Base team document (flattened)
    team_doc = {
        "team_id": str(team_basic['id']),
        "team_name": team_basic['full_name'],
        "abbreviation": team_basic['abbreviation'],
        "nickname": team_basic['nickname'],
        "city": team_basic['city'],
        "state": team_basic['state'],
        "year_founded": team_basic['year_founded'],
        "current_season": "2025-26",
        "data_source": "nba_api",
        "ingested_at": datetime.now(UTC).isoformat()
    }

    # Add team background info
    if team_details and 'TeamBackground' in team_details:
        bg_list = team_details['TeamBackground']
        if bg_list and len(bg_list) > 0:
            bg = bg_list[0]
            team_doc.update({
                "arena": bg.get('ARENA', ''),
                "arena_capacity": bg.get('ARENACAPACITY'),
                "owner": bg.get('OWNER', ''),
                "general_manager": bg.get('GENERALMANAGER', ''),
                "head_coach": bg.get('HEADCOACH', '')
            })

    # Add conference/division info
    if team_info and 'TeamInfoCommon' in team_info:
        info_list = team_info['TeamInfoCommon']
        if info_list and len(info_list) > 0:
            info = info_list[0]
            team_doc.update({
                "conference": info.get('TEAM_CONFERENCE', ''),
                "division": info.get('TEAM_DIVISION', '')
            })

    # CHANGED: Calculate aggregated stats instead of nested array
    season_docs = []  # For separate index
    total_wins = 0
    total_losses = 0
    championships = 0
    playoff_apps = 0
    seasons_count = 0
    latest_season = None

    if team_stats and 'TeamStats' in team_stats:
        stats_list = team_stats['TeamStats']

        for stat in stats_list:
            season_year = stat.get('YEAR')

            # Only process requested seasons
            if season_year in SEASONS:
                wins = stat.get('WINS', 0)
                losses = stat.get('LOSSES', 0)
                playoff_app = stat.get('PO_WINS', 0) > 0 or stat.get('PO_LOSSES', 0) > 0
                is_champion = stat.get('NBA_FINALS_APPEARANCE', '') == 'LEAGUE CHAMPION'
                conf_finals = stat.get('CONF_COUNT', 0) > 0
                nba_finals = 'NBA_FINALS_APPEARANCE' in stat and stat.get('NBA_FINALS_APPEARANCE', '') != ''

                # Aggregate for team document
                total_wins += wins
                total_losses += losses
                if is_champion:
                    championships += 1
                if playoff_app:
                    playoff_apps += 1
                seasons_count += 1

                # Track latest season
                if not latest_season or season_year > latest_season:
                    latest_season = season_year
                    team_doc["latest_season"] = season_year
                    team_doc["latest_season_wins"] = wins
                    team_doc["latest_season_losses"] = losses
                    team_doc["latest_season_win_pct"] = stat.get('WIN_PCT', 0.0)

                # Create separate season document
                start_year, end_year = parse_season_years(season_year)
                season_doc = {
                    "_index": TEAM_SEASONS_INDEX,
                    "_id": f"{team_basic['id']}_{season_year}",  # Composite ID
                    "team_id": str(team_basic['id']),
                    "team_name": team_basic['full_name'],
                    "team_abbreviation": team_basic['abbreviation'],
                    "season": season_year,
                    "season_year_start": start_year,
                    "season_year_end": end_year,
                    "wins": wins,
                    "losses": losses,
                    "win_pct": stat.get('WIN_PCT', 0.0),
                    "playoff_appearance": playoff_app,
                    "champion": is_champion,
                    "conference_finals": conf_finals,
                    "nba_finals": nba_finals,
                    "ingested_at": datetime.now(UTC).isoformat()
                }
                season_docs.append(season_doc)

    # Add aggregated stats to team document
    team_doc["total_seasons_played"] = seasons_count
    team_doc["total_wins"] = total_wins
    team_doc["total_losses"] = total_losses
    team_doc["career_win_pct"] = total_wins / (total_wins + total_losses) if (total_wins + total_losses) > 0 else 0.0
    team_doc["championships_won"] = championships
    team_doc["playoff_appearances"] = playoff_apps

    return team_doc, season_docs


def bulk_ingest_teams(teams_list):
    print(f"\n📤 Ingesting {len(teams_list)} teams...")

    team_actions = []
    season_actions = []

    for idx, team in enumerate(teams_list):
        print(f"  Processing team {idx + 1}/{len(teams_list)}: {team['full_name']}")

        team_details, team_info, team_stats = fetch_team_details(team['id'])
        team_doc, season_docs = transform_team_data(team, team_details, team_info, team_stats)

        # Team document action
        team_actions.append({
            "_index": TEAMS_INDEX,
            "_id": team_doc["team_id"],
            "_source": team_doc
        })

        # Season documents actions
        season_actions.extend(season_docs)

    # Bulk index teams
    helpers.bulk(es, team_actions)
    print(f"\n✅ Ingested {len(team_actions)} teams to {TEAMS_INDEX}")

    # Bulk index seasons
    if season_actions:
        helpers.bulk(es, season_actions)
        print(f"✅ Ingested {len(season_actions)} team-season records to {TEAM_SEASONS_INDEX}")


def main():
    print("=" * 60)
    print("NBA TEAM DATA INGESTION - ES|QL COMPATIBLE")
    print("=" * 60)

    create_indices()
    all_teams = fetch_all_teams()
    bulk_ingest_teams(all_teams)

    team_count = es.count(index=TEAMS_INDEX)['count']
    season_count = es.count(index=TEAM_SEASONS_INDEX)['count']

    print(f"\n✅ Index {TEAMS_INDEX} has {team_count} teams")
    print(f"✅ Index {TEAM_SEASONS_INDEX} has {season_count} season records")
    print("\n" + "=" * 60)
    print("INGESTION COMPLETE")
    print("=" * 60)

    print("\n📊 Example ES|QL Queries:")
    print("\n1. Get teams with most championships:")
    print(f'FROM {TEAMS_INDEX} | SORT championships_won DESC | LIMIT 10')

    print("\n2. Best season performance across all teams:")
    print(f'FROM {TEAM_SEASONS_INDEX} | WHERE playoff_appearance == true | SORT win_pct DESC | LIMIT 10')

    print("\n3. Team performance by season:")
    print(f'FROM {TEAM_SEASONS_INDEX} | WHERE team_abbreviation == "LAL" | SORT season')


if __name__ == "__main__":
    main()
