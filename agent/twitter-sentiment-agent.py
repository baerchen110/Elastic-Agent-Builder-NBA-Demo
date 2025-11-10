#!/usr/bin/env python3
"""
Twitter/X Sentiment Agent for NBA A2A System
Real-time sentiment analysis and trending topics
"""

import tweepy
import os
from datetime import datetime, timedelta
from elasticsearch import Elasticsearch
from typing import Dict, List, Optional
import json
from textblob import TextBlob
import re
from dotenv import load_dotenv

load_dotenv()


class TwitterSentimentAgent:
    """
    Tweepy-based agent for Twitter sentiment analysis
    Integrates with Elasticsearch for data storage
    """

    def __init__(self):
        """Initialize Tweepy client and Elasticsearch"""
        self.bearer_token = os.getenv('TWITTER_BEARER_TOKEN')
        self.client = tweepy.Client(
            bearer_token=self.bearer_token,
            wait_on_rate_limit=True  # Auto-wait on rate limit
        )

        self.es = Elasticsearch([os.getenv('ELASTICSEARCH_URL')])

    def search_player_sentiment(self, player_name: str, days: int = 7) -> Dict:
        """
        Search tweets about a specific player and analyze sentiment

        Args:
            player_name: Player name (e.g., "LeBron James")
            days: Number of days to search back

        Returns:
            Dict with sentiment analysis
        """
        print(f"\n🔍 Searching tweets for {player_name}...")

        # Construct query
        query = f'"{player_name}" -is:retweet lang:en'

        start_time = datetime.utcnow() - timedelta(days=days)

        try:
            # Search tweets
            tweets = self.client.search_recent_tweets(
                query=query,
                max_results=100,  # Max per request
                start_time=start_time,
                tweet_fields=['created_at', 'public_metrics', 'author_id'],
                expansions=['author_id'],
                user_fields=['verified', 'public_metrics']
            )

            if not tweets.data:
                return {
                    "player_name": player_name,
                    "tweet_count": 0,
                    "sentiment": "No data",
                    "sentiment_score": 0.0
                }

            # Analyze sentiment
            sentiments = []
            engagement_scores = []
            tweets_data = []

            for tweet in tweets.data:
                # Sentiment analysis
                sentiment = self._analyze_sentiment(tweet.text)
                sentiments.append(sentiment['score'])

                # Engagement metrics
                engagement = self._calculate_engagement(tweet.public_metrics)
                engagement_scores.append(engagement)

                # Store tweet data
                tweets_data.append({
                    "text": tweet.text,
                    "sentiment": sentiment['label'],
                    "sentiment_score": sentiment['score'],
                    "engagement": engagement,
                    "created_at": tweet.created_at,
                    "likes": tweet.public_metrics['like_count'],
                    "retweets": tweet.public_metrics['retweet_count'],
                    "replies": tweet.public_metrics['reply_count']
                })

            # Calculate aggregate sentiment
            avg_sentiment = sum(sentiments) / len(sentiments)
            sentiment_label = self._label_sentiment(avg_sentiment)

            result = {
                "player_name": player_name,
                "tweet_count": len(tweets.data),
                "sentiment": sentiment_label,
                "sentiment_score": round(avg_sentiment, 3),
                "positive_pct": round(sum(1 for s in sentiments if s > 0.1) / len(sentiments) * 100, 1),
                "neutral_pct": round(sum(1 for s in sentiments if -0.1 <= s <= 0.1) / len(sentiments) * 100, 1),
                "negative_pct": round(sum(1 for s in sentiments if s < -0.1) / len(sentiments) * 100, 1),
                "avg_engagement": round(sum(engagement_scores) / len(engagement_scores), 2),
                "top_engagement_tweet": max(tweets_data, key=lambda x: x['engagement'])['text'][:100],
                "analysis_date": datetime.utcnow().isoformat(),
                "tweets_sample": tweets_data[:5]  # Store sample tweets
            }

            # Index to Elasticsearch
            self._index_sentiment(result)

            return result

        except tweepy.TweepyException as e:
            print(f"❌ Tweepy error: {e}")
            return {
                "error": str(e),
                "player_name": player_name
            }

    def search_team_sentiment(self, team_name: str, team_abbreviation: str, days: int = 7) -> Dict:
        """
        Search tweets about a specific team and analyze sentiment
        """
        print(f"\n🏀 Analyzing team sentiment for {team_name}...")

        # Search for both full name and abbreviation
        query = f'({team_name} OR {team_abbreviation}) -is:retweet lang:en'

        start_time = datetime.utcnow() - timedelta(days=days)

        try:
            tweets = self.client.search_recent_tweets(
                query=query,
                max_results=100,
                start_time=start_time,
                tweet_fields=['created_at', 'public_metrics'],
                user_fields=['verified', 'public_metrics']
            )

            if not tweets.data:
                return {
                    "team_name": team_name,
                    "tweet_count": 0,
                    "sentiment": "No data"
                }

            sentiments = []
            engagement_scores = []

            for tweet in tweets.data:
                sentiment = self._analyze_sentiment(tweet.text)
                sentiments.append(sentiment['score'])

                engagement = self._calculate_engagement(tweet.public_metrics)
                engagement_scores.append(engagement)

            avg_sentiment = sum(sentiments) / len(sentiments)

            result = {
                "team_name": team_name,
                "tweet_count": len(tweets.data),
                "sentiment": self._label_sentiment(avg_sentiment),
                "sentiment_score": round(avg_sentiment, 3),
                "avg_engagement": round(sum(engagement_scores) / len(engagement_scores), 2),
                "analysis_date": datetime.utcnow().isoformat()
            }

            self._index_sentiment(result)
            return result

        except tweepy.TweepyException as e:
            print(f"❌ Error: {e}")
            return {"error": str(e)}

    def get_trending_nba_topics(self) -> Dict:
        """
        Identify trending NBA topics and hashtags
        """
        print("\n📈 Fetching trending NBA topics...")

        query = "#NBA -is:retweet lang:en"

        start_time = datetime.utcnow() - timedelta(hours=24)

        try:
            tweets = self.client.search_recent_tweets(
                query=query,
                max_results=100,
                start_time=start_time,
                tweet_fields=['created_at', 'public_metrics'],
                expansions=['author_id'],
                user_fields=['verified']
            )

            if not tweets.data:
                return {"trends": []}

            # Extract hashtags and mentions
            hashtags = {}
            mentions = {}

            for tweet in tweets.data:
                # Extract hashtags
                tweet_hashtags = re.findall(r'#(\w+)', tweet.text)
                for tag in tweet_hashtags:
                    hashtags[tag] = hashtags.get(tag, 0) + 1

                # Extract @mentions
                tweet_mentions = re.findall(r'@(\w+)', tweet.text)
                for mention in tweet_mentions:
                    mentions[mention] = mentions.get(mention, 0) + 1

            # Get top trends
            top_hashtags = sorted(hashtags.items(), key=lambda x: x, reverse=True)[:10]
            top_mentions = sorted(mentions.items(), key=lambda x: x, reverse=True)[:10]

            result = {
                "analysis_date": datetime.utcnow().isoformat(),
                "period": "24h",
                "top_hashtags": [{"tag": tag, "count": count} for tag, count in top_hashtags],
                "top_mentions": [{"mention": mention, "count": count} for mention, count in top_mentions],
                "total_tweets": len(tweets.data)
            }

            return result

        except tweepy.TweepyException as e:
            print(f"❌ Error: {e}")
            return {"error": str(e)}

    def stream_real_time_sentiment(self, keywords: List[str], duration_seconds: int = 60):
        """
        Stream real-time tweets and analyze sentiment live

        Note: Requires elevated tier or higher
        """
        print(f"\n📡 Streaming real-time sentiment for: {keywords}")

        # Create rule for filtering
        rules = [tweepy.StreamRule(value=keyword) for keyword in keywords]

        # Create listener
        class SentimentListener(tweepy.StreamingClient):
            def on_tweet(self, tweet):
                print(f"\n📥 New tweet: {tweet.text[:100]}")

                sentiment = self._analyze_sentiment(tweet.text)
                print(f"   Sentiment: {sentiment['label']} ({sentiment['score']})")

                # Could index to ES here

        try:
            # Note: Requires streaming access
            pass
        except Exception as e:
            print(f"⚠️ Streaming requires elevated access: {e}")

    def compare_player_sentiment(self, players: List[str]) -> Dict:
        """
        Compare sentiment across multiple players
        """
        print(f"\n🆚 Comparing sentiment for {len(players)} players...")

        results = []
        for player in players:
            sentiment_data = self.search_player_sentiment(player, days=3)
            results.append(sentiment_data)

        # Rank by sentiment
        ranked = sorted(results, key=lambda x: x.get('sentiment_score', 0), reverse=True)

        return {
            "comparison_date": datetime.utcnow().isoformat(),
            "players_analyzed": len(players),
            "ranking": ranked
        }

    def analyze_game_reaction(self, team1: str, team2: str, game_date: str) -> Dict:
        """
        Analyze live reactions to a specific game
        """
        print(f"\n🎮 Analyzing game reaction: {team1} vs {team2}")

        query = f'({team1} {team2}) -is:retweet lang:en'

        try:
            tweets = self.client.search_recent_tweets(
                query=query,
                max_results=100,
                tweet_fields=['created_at', 'public_metrics']
            )

            if not tweets.data:
                return {"error": "No tweets found for this game"}

            sentiments = []
            timeline = {}

            for tweet in tweets.data:
                sentiment = self._analyze_sentiment(tweet.text)
                sentiments.append(sentiment['score'])

                # Group by time
                hour = tweet.created_at.strftime('%H:00')
                if hour not in timeline:
                    timeline[hour] = []
                timeline[hour].append(sentiment['score'])

            # Calculate sentiment progression
            sentiment_progression = {
                hour: round(sum(scores) / len(scores), 2)
                for hour, scores in timeline.items()
            }

            return {
                "teams": [team1, team2],
                "game_date": game_date,
                "tweet_count": len(tweets.data),
                "overall_sentiment": self._label_sentiment(sum(sentiments) / len(sentiments)),
                "sentiment_score": round(sum(sentiments) / len(sentiments), 3),
                "sentiment_progression": sentiment_progression
            }

        except Exception as e:
            return {"error": str(e)}

    # Helper methods

    def _analyze_sentiment(self, text: str) -> Dict:
        """
        Analyze sentiment using TextBlob

        Returns polarity score: -1.0 (negative) to 1.0 (positive)
        """
        try:
            analysis = TextBlob(text)
            polarity = analysis.sentiment.polarity

            if polarity > 0.1:
                label = "positive"
            elif polarity < -0.1:
                label = "negative"
            else:
                label = "neutral"

            return {
                "score": polarity,
                "label": label,
                "subjectivity": analysis.sentiment.subjectivity
            }
        except:
            return {"score": 0, "label": "neutral"}

    def _calculate_engagement(self, metrics: Dict) -> float:
        """
        Calculate engagement score based on likes, retweets, replies

        Formula: (likes + retweets*2 + replies*3) / 6
        """
        engagement = (
                             metrics['like_count'] +
                             metrics['retweet_count'] * 2 +
                             metrics['reply_count'] * 3
                     ) / 6

        return engagement

    def _label_sentiment(self, score: float) -> str:
        """Convert sentiment score to label"""
        if score > 0.2:
            return "Very Positive"
        elif score > 0.05:
            return "Positive"
        elif score > -0.05:
            return "Neutral"
        elif score > -0.2:
            return "Negative"
        else:
            return "Very Negative"

    def _index_sentiment(self, data: Dict) -> None:
        """Index sentiment data to Elasticsearch"""
        try:
            index_name = f"nba_twitter_sentiment_{datetime.utcnow().strftime('%Y.%m.%d')}"

            self.es.index(
                index=index_name,
                document={
                    **data,
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
            print(f"✅ Indexed to {index_name}")
        except Exception as e:
            print(f"⚠️ Indexing error: {e}")


# Main execution
if __name__ == "__main__":
    agent = TwitterSentimentAgent()

    # Example: Analyze LeBron sentiment
    lebron_sentiment = agent.search_player_sentiment("LeBron James", days=7)
    print(json.dumps(lebron_sentiment, indent=2))

    # Example: Analyze Lakers sentiment
    lakers_sentiment = agent.search_team_sentiment("Lakers", "LAL", days=7)
    print(json.dumps(lakers_sentiment, indent=2))

    # Example: Get trending topics
    trends = agent.get_trending_nba_topics()
    print(json.dumps(trends, indent=2))

    # Example: Compare players
    comparison = agent.compare_player_sentiment(["LeBron James", "Luka Doncic", "Giannis"])
    print(json.dumps(comparison, indent=2))
