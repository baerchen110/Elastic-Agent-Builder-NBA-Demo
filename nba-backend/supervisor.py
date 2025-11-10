"""
Supervisor Agent Module
Coordinates routing of user queries to appropriate specialized agents
Uses Azure OpenAI as the LLM backbone for intelligent routing decisions
"""

import os
import json
import logging
from typing import Literal, Optional, Dict, Any
from langchain_openai import AzureChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


class RouteDecision(BaseModel):
    """Structured output for supervisor routing decision."""
    next_agent: Literal["stats_agent", "media_agent", "both", "synthesize"]
    reasoning: str = Field(description="Why this routing decision was made")
    needs_more_info: bool = False


class SupervisorAgent:
    """
    Supervisor Agent that routes queries to appropriate specialized agents.

    Routes to:
    - stats_agent: NBA statistics, player performance, game analysis
    - media_agent: Media recommendations, entertainment content
    - both: Combined queries requiring both agents
    - synthesize: Combine previous results
    """

    def __init__(self):
        """Initialize supervisor with Azure OpenAI client"""
        self.llm = self._create_llm()
        self.routing_history = []

    def _create_llm(self) -> AzureChatOpenAI:
        """Create Azure OpenAI LLM client with correct configuration"""

        # Get credentials from environment
        api_key = os.getenv("AZURE_OPENAI_API_KEY")
        endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
        api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")

        # Validate credentials
        if not all([api_key, endpoint, deployment]):
            error_msg = (
                "Missing Azure OpenAI credentials. Ensure these environment variables are set:\n"
                "  - AZURE_OPENAI_API_KEY: Your Azure OpenAI API key\n"
                "  - AZURE_OPENAI_ENDPOINT: Your Azure OpenAI endpoint (e.g., https://resource.openai.azure.com/)\n"
                "  - AZURE_OPENAI_DEPLOYMENT_NAME: Your deployment name in Azure"
            )
            logger.error(error_msg)
            raise ValueError(error_msg)

        logger.info(f"[SUPERVISOR] Initializing Azure OpenAI LLM")
        logger.info(f"  Endpoint: {endpoint}")
        logger.info(f"  Deployment: {deployment}")
        logger.info(f"  API Version: {api_version}")

        try:
            # Create client with CORRECT parameter names for LangChain v0.1+
            llm = AzureChatOpenAI(
                azure_endpoint=endpoint,
                azure_deployment=deployment,
                api_version=api_version,
                api_key=api_key,
                temperature=0.7,
                max_tokens=2000,
                timeout=60,
                max_retries=2
            )
            logger.info("[SUPERVISOR] ✓ Azure OpenAI LLM initialized successfully")
            return llm
        except Exception as e:
            logger.error(f"[SUPERVISOR] ✗ Failed to initialize LLM: {str(e)}")
            raise

    def _get_system_prompt(self) -> str:
        """Get the system prompt for the supervisor"""
        return """You are an intelligent NBA and media assistant coordinator supervisor.

Your responsibility is to analyze user queries and route them to the most appropriate agent(s):

ROUTING OPTIONS:
1. "stats_agent" - For queries about:
   - NBA player statistics and performance metrics
   - Game results and box scores
   - Team statistics and records
   - Historical NBA data and trends
   - Player comparisons and rankings
   - Clutch performance analysis
   - Team chemistry and performance indicators

2. "media_agent" - For queries about:
   - Media recommendations and content suggestions
   - Entertainment and entertainment-related topics
   - Streaming recommendations
   - Content availability and platforms

3. "both" - When query requires BOTH agents:
   - "Show me highlights of top scorers" (needs stats + media)
   - "Recommend NBA content about LeBron" (needs stats context + media)
   - Multi-faceted queries requiring stats and media combined

4. "synthesize" - When combining results from previously gathered data:
   - "Compare the results" (when previous agents have run)
   - "Summarize what we found" (aggregating previous results)

ANALYSIS PROCESS:
1. Carefully read the user's query
2. Identify the primary intent (statistics, media, or both)
3. Check if this is a synthesis request (combining previous results)
4. Route to the most appropriate agent(s)

IMPORTANT:
- Only return valid JSON, no markdown code blocks
- Ensure your reasoning is concise and clear
- If unsure, default to "stats_agent" for NBA-related queries

Return ONLY valid JSON (no markdown, no code blocks):
{
    "next_agent": "stats_agent" | "media_agent" | "both" | "synthesize",
    "reasoning": "Clear explanation of why this agent(s) was chosen",
    "needs_more_info": false
}"""

    def _clean_response(self, response_text: str) -> str:
        """
        Clean LLM response by removing markdown code blocks.

        Args:
            response_text: Raw text from LLM

        Returns:
            Cleaned JSON string
        """
        # Remove markdown code blocks if present
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        # Also try removing 'json' prefix if it appears after code block markers
        if response_text.startswith("json"):
            response_text = response_text[4:].strip()

        return response_text

    def _parse_routing_decision(self, response_text: str) -> Dict[str, Any]:
        """
        Parse and validate routing decision from LLM response.

        Args:
            response_text: LLM response text

        Returns:
            Dictionary with routing decision

        Raises:
            json.JSONDecodeError: If JSON parsing fails
            ValueError: If routing decision is invalid
        """
        # Clean response
        cleaned = self._clean_response(response_text)

        logger.debug(f"[SUPERVISOR] Cleaned response: {cleaned[:200]}")

        # Parse JSON
        try:
            decision = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(f"[SUPERVISOR] JSON parsing failed: {str(e)}")
            logger.error(f"[SUPERVISOR] Response text: {cleaned}")
            raise

        # Validate required fields
        if "next_agent" not in decision:
            raise ValueError("Missing 'next_agent' field in routing decision")

        next_agent = decision.get("next_agent")
        valid_agents = ["stats_agent", "media_agent", "both", "synthesize"]

        if next_agent not in valid_agents:
            raise ValueError(
                f"Invalid agent: {next_agent}. Must be one of: {valid_agents}"
            )

        return decision

    def route(self, user_message: str) -> Dict[str, Any]:
        """
        Route a user query to the appropriate agent(s).

        Args:
            user_message: The user's query

        Returns:
            Dictionary containing:
            - next_node: Which agent to route to
            - reasoning: Why this agent was chosen
            - success: Whether routing succeeded
        """

        logger.info(f"[SUPERVISOR] Processing query: {user_message[:100]}...")

        try:
            # Build messages for LLM
            messages: list[BaseMessage] = [
                SystemMessage(content=self._get_system_prompt()),
                HumanMessage(content=f"Route this query: {user_message}")
            ]

            logger.debug(f"[SUPERVISOR] Invoking Azure OpenAI for routing decision")

            # Get routing decision from LLM
            response = self.llm.invoke(messages)
            response_text = response.content.strip()

            logger.debug(f"[SUPERVISOR] Raw response: {response_text[:300]}")

            # Parse routing decision
            decision = self._parse_routing_decision(response_text)

            next_agent = decision.get("next_agent", "stats_agent")
            reasoning = decision.get("reasoning", "")

            # Log routing decision
            logger.info(f"[SUPERVISOR] ✓ Routing to: {next_agent}")
            logger.info(f"[SUPERVISOR] Reasoning: {reasoning}")

            # Store in history
            self.routing_history.append({
                "query": user_message,
                "decision": next_agent,
                "reasoning": reasoning
            })

            return {
                "next_node": next_agent,
                "supervisor_reasoning": reasoning,
                "success": True
            }

        except json.JSONDecodeError as e:
            logger.error(f"[SUPERVISOR] ✗ JSON parsing error: {str(e)}")
            logger.warning("[SUPERVISOR] Falling back to stats_agent due to parsing error")

            return {
                "next_node": "stats_agent",
                "supervisor_reasoning": f"Error parsing routing decision: {str(e)}. Defaulting to stats_agent.",
                "success": False
            }

        except ValueError as e:
            logger.error(f"[SUPERVISOR] ✗ Validation error: {str(e)}")
            logger.warning("[SUPERVISOR] Falling back to stats_agent due to validation error")

            return {
                "next_node": "stats_agent",
                "supervisor_reasoning": f"Error in routing decision: {str(e)}. Defaulting to stats_agent.",
                "success": False
            }

        except Exception as e:
            logger.error(f"[SUPERVISOR] ✗ Unexpected error: {str(e)}")
            logger.error(f"[SUPERVISOR] Exception type: {type(e).__name__}")
            logger.warning("[SUPERVISOR] Falling back to stats_agent due to unexpected error")

            return {
                "next_node": "stats_agent",
                "supervisor_reasoning": f"Unexpected error during routing: {str(e)}. Defaulting to stats_agent.",
                "success": False
            }

    def get_history(self) -> list[Dict[str, Any]]:
        """Get routing history"""
        return self.routing_history

    def clear_history(self) -> None:
        """Clear routing history"""
        self.routing_history = []


# Module-level singleton instance
_supervisor_instance: Optional[SupervisorAgent] = None


def get_supervisor() -> SupervisorAgent:
    """Get or create supervisor instance (singleton pattern)"""
    global _supervisor_instance
    if _supervisor_instance is None:
        logger.info("[SUPERVISOR] Creating new supervisor instance")
        _supervisor_instance = SupervisorAgent()
    return _supervisor_instance


def supervisor(state: dict) -> dict:
    """
    Supervisor node function for LangGraph.

    This is the entry point for LangGraph workflows.

    Args:
        state: LangGraph state dictionary containing:
            - user_message: The user's query
            - workflow_step: Current step in workflow

    Returns:
        Dictionary with routing decision:
            - next_node: Which agent to route to
            - supervisor_reasoning: Why this decision was made
    """

    user_message = state.get("user_message", "")
    workflow_step = state.get("workflow_step", 0)

    if not user_message:
        logger.warning("[SUPERVISOR] No user message provided")
        return {
            "next_node": "synthesize",
            "supervisor_reasoning": "No user message provided"
        }

    # Get supervisor instance and route
    sup = get_supervisor()
    result = sup.route(user_message)

    return {
        "next_node": result["next_node"],
        "supervisor_reasoning": result["supervisor_reasoning"]
    }


# Test and debugging
if __name__ == "__main__":
    import sys

    # Setup logging for debugging
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    print("\n" + "=" * 70)
    print("SUPERVISOR AGENT - Test Mode")
    print("=" * 70 + "\n")

    # Test queries
    test_queries = [
        "Who are the top NBA scorers this season?",
        "What NBA documentaries should I watch?",
        "Show me highlights of the clutch performers",
        "Compare LeBron and Luka",
        "Recommend NBA content"
    ]

    try:
        # Get supervisor instance
        sup = get_supervisor()

        print("Testing supervisor routing...\n")

        for i, query in enumerate(test_queries, 1):
            print(f"[{i}] Query: {query}")

            result = sup.route(query)

            print(f"    → Route to: {result['next_node']}")
            print(f"    → Reasoning: {result['supervisor_reasoning']}")
            print(f"    → Success: {result['success']}")
            print()

        print("=" * 70)
        print("Routing History:")
        print("=" * 70)

        for i, entry in enumerate(sup.get_history(), 1):
            print(f"\n[{i}] Query: {entry['query']}")
            print(f"    Decision: {entry['decision']}")
            print(f"    Reasoning: {entry['reasoning']}")

        print("\n" + "=" * 70)
        print("✓ All tests completed successfully!")
        print("=" * 70 + "\n")

    except Exception as e:
        print(f"\n✗ Error during testing: {str(e)}")
        print(f"Exception type: {type(e).__name__}")
        sys.exit(1)
