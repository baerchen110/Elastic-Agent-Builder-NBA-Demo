import requests
import json
from datetime import datetime
from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk
from dotenv import load_dotenv
import os

# Elasticsearch configuration
INDEX_NAME = "nba-game-schedule"

# NBA schedule API endpoint
NBA_SCHEDULE_URL = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json"


def create_index_with_mapping(es_client):
    """
    Create Elasticsearch index with proper mappings for NBA games
    Fixed: game_date now uses strict_date_optional_time format to accept ISO 8601 format
    """
    # Define index settings and mappings
    index_body = {
        "mappings": {
            "properties": {
                "game_id": {
                    "type": "keyword"
                },
                "home_team_name": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword"
                        }
                    }
                },
                "away_team_name": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword"
                        }
                    }
                },
                "game_date": {
                    "type": "date",
                    "format": "strict_date_optional_time||yyyy-MM-dd"
                },
                "game_datetime": {
                    "type": "date",
                    "format": "strict_date_optional_time"
                },
                "home_team_id": {
                    "type": "keyword"
                },
                "away_team_id": {
                    "type": "keyword"
                },
                "season": {
                    "type": "integer"
                },
                "postseason": {
                    "type": "boolean"
                }
            }
        }
    }

    try:
        # Delete index if it already exists
        if es_client.indices.exists(index=INDEX_NAME):
            print(f"Index '{INDEX_NAME}' already exists. Deleting...")
            es_client.indices.delete(index=INDEX_NAME)

        # Create the new index
        es_client.indices.create(index=INDEX_NAME, body=index_body)
        print(f"✓ Index '{INDEX_NAME}' created successfully with mappings")

    except Exception as e:
        print(f"✗ Error creating index: {e}")
        raise


def fetch_nba_schedule():
    """
    Fetch NBA schedule from CDN
    """
    try:
        print("Fetching NBA schedule from CDN...")
        response = requests.get(NBA_SCHEDULE_URL, timeout=30)
        response.raise_for_status()
        data = response.json()
        print(f"✓ Successfully retrieved NBA schedule")
        return data

    except requests.exceptions.RequestException as e:
        print(f"✗ Error fetching NBA schedule: {e}")
        raise


def transform_games_for_elasticsearch(nba_data):
    """
    Transform NBA schedule data into Elasticsearch documents
    Yields documents one at a time to save memory
    Fixed: Extract date portion from ISO 8601 datetime for game_date field
    """
    try:
        game_dates = nba_data.get('leagueSchedule', {}).get('gameDates', [])
        game_count = 0

        for game_date_obj in game_dates:
            games = game_date_obj.get('games', [])

            for game in games:
                # Extract game_date as ISO datetime string (works with our updated mapping)
                game_datetime_str = game.get('gameDateTimeEst', '')

                # Extract required fields
                doc = {
                    "_index": INDEX_NAME,
                    "_id": game.get('gameId'),
                    "_source": {
                        "game_id": game.get('gameId'),
                        "home_team_name": game.get('homeTeam', {}).get('teamName'),
                        "away_team_name": game.get('awayTeam', {}).get('teamName'),
                        "home_team_id": game.get('homeTeam', {}).get('teamId'),
                        "away_team_id": game.get('awayTeam', {}).get('teamId'),
                        "game_date": game_datetime_str,  # Use full ISO datetime string
                        "game_datetime": game_datetime_str,
                        "season": game.get('season'),
                        "postseason": game.get('postseason', False)
                    }
                }

                game_count += 1
                yield doc

        print(f"✓ Transformed {game_count} games for indexing")

    except Exception as e:
        print(f"✗ Error transforming games: {e}")
        raise


def index_games_to_elasticsearch(es_client, documents):
    """
    Bulk index games into Elasticsearch
    """
    try:
        print("Starting bulk indexing to Elasticsearch...")

        # Use bulk helper for efficient indexing
        success_count, error_list = bulk(
            es_client,
            documents,
            chunk_size=100,
            raise_on_error=False
        )

        print(f"✓ Bulk indexing completed")
        print(f"  - Successfully indexed: {success_count} documents")

        if error_list:
            print(f"  - Failed: {len(error_list)} documents")
            for error in error_list[:5]:  # Print first 5 errors
                print(f"    Error: {error}")

        return success_count, error_list

    except Exception as e:
        print(f"✗ Error during bulk indexing: {e}")
        raise


def verify_index(es_client):
    """
    Verify that data was successfully indexed
    Fixed: Handles Serverless Elasticsearch which doesn't support stats endpoint
    """
    try:
        print(f"\n✓ Index verification:")

        # For Serverless Elasticsearch, use count instead of stats
        try:
            count_result = es_client.count(index=INDEX_NAME)
            doc_count = count_result['count']
        except:
            # Fallback: Try to get stats if serverless count doesn't work
            stats = es_client.indices.stats(index=INDEX_NAME)
            doc_count = stats['indices'][INDEX_NAME]['primaries']['docs']['count']

        print(f"  - Total documents indexed: {doc_count}")

        # Get a sample document
        response = es_client.search(
            index=INDEX_NAME,
            size=1,
            query={"match_all": {}}
        )

        if response['hits']['hits']:
            sample_game = response['hits']['hits'][0]['_source']
            print(f"  - Sample game:")
            print(f"    {sample_game['away_team_name']} @ {sample_game['home_team_name']}")
            print(f"    Date: {sample_game['game_date']}")

    except Exception as e:
        print(f"✗ Error verifying index: {e}")
        # Don't raise - allow script to continue even if verification fails


def main():
    """
    Main function to orchestrate the entire process
    """
    start_time = datetime.now()
    print("=" * 60)
    print("NBA Schedule Elasticsearch Ingestion Script")
    print("=" * 60)

    try:
        # Step 1: Connect to Elasticsearch
        print("\n[1/5] Connecting to Elasticsearch...")
        load_dotenv()

        es_client = Elasticsearch(
            os.getenv('ELASTICSEARCH_URL'),
            api_key=os.getenv('ELASTICSEARCH_API_KEY')
        )

        es_client.info()  # Test connection
        print(f"✓ Connected to Elasticsearch")

        # Step 2: Create index with mappings
        print("\n[2/5] Creating Elasticsearch index...")
        create_index_with_mapping(es_client)

        # Step 3: Fetch NBA schedule
        print("\n[3/5] Fetching NBA schedule data...")
        nba_data = fetch_nba_schedule()

        # Step 4: Transform and index data
        print("\n[4/5] Transforming and indexing data...")
        documents = transform_games_for_elasticsearch(nba_data)
        success_count, error_list = index_games_to_elasticsearch(es_client, documents)

        # Step 5: Verify indexing
        print("\n[5/5] Verifying index...")
        verify_index(es_client)

        # Summary
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        print("\n" + "=" * 60)
        print("✓ NBA Schedule successfully ingested into Elasticsearch!")
        print(f"Total time: {duration:.2f} seconds")
        print("=" * 60)

    except Exception as e:
        print(f"\n✗ Error during ingestion: {e}")
        raise


if __name__ == "__main__":
    main()
