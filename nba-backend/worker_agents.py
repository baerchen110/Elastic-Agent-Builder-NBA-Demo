"""
Worker Agents Module - FINAL with Enhanced Error Logging
Elastic Agent Builder A2A Protocol (JSON-RPC 2.0)

Changes from previous version:
- Enhanced error logging for debugging connection issues
- Better timeout handling
- Detailed error messages for troubleshooting
"""

import logging
import asyncio
import os
import httpx
import uuid
import json

from models.state import AgentState
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()


async def call_elastic_agent_a2a(agent_url: str, query: str, api_key: str = None) -> str:
    """
    Call Elastic Agent Builder via A2A protocol (JSON-RPC 2.0)

    FIXED: Now handles result.parts directly (Elastic Agent Builder format)
    Enhanced: Better error logging for connection issues
    """

    headers = {"Content-Type": "application/json"}

    if api_key:
        if not api_key.startswith(("ApiKey ", "Bearer ")):
            headers["Authorization"] = f"ApiKey {api_key}"
        else:
            headers["Authorization"] = api_key

    # ✅ CORRECT A2A protocol payload
    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "message/send",
        "params": {
            "message": {
                "role": "user",
                "parts": [
                    {
                        "kind": "text",
                        "text": query
                    }
                ],
                "messageId": str(uuid.uuid4())
            }
        }
    }

    try:
        logger.info(f"[A2A] Calling: {agent_url}")

        # Check for common URL issues
        if ":443" in agent_url and agent_url.startswith("https://"):
            logger.warning("[A2A] ⚠️  URL contains explicit :443 port - this may cause connection issues")
            logger.warning("[A2A] Consider removing :443 from the URL")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                agent_url,
                json=payload,
                headers=headers,
                timeout=httpx.Timeout(60.0, connect=10.0)  # 60s total, 10s connect
            )

            logger.info(f"[A2A] Response status: {response.status_code}")
            response.raise_for_status()

            data = response.json()

            # Check for JSON-RPC error
            if "error" in data and data["error"]:
                error_msg = data["error"].get("message", "Unknown error")
                error_code = data["error"].get("code", "N/A")
                logger.error(f"[A2A] JSON-RPC error (code {error_code}): {error_msg}")
                return None

            # Extract response
            if "result" in data:
                result = data["result"]

                # ===== PRIMARY PATH: result.parts (Elastic Agent Builder format) =====
                if isinstance(result, dict) and "parts" in result:
                    parts = result["parts"]
                    logger.debug(f"[A2A] Found parts at top level")

                    if isinstance(parts, list) and parts:
                        for i, part in enumerate(parts):
                            if isinstance(part, dict):
                                if part.get("kind") == "text" and "text" in part:
                                    text = part.get("text", "")
                                    if text:
                                        logger.info(f"[A2A] ✅ Found text in result.parts[{i}].text")
                                        return text

                # ===== FALLBACK PATHS =====
                if isinstance(result, str):
                    logger.info(f"[A2A] ✅ Result is string")
                    return result

                if isinstance(result, dict):
                    for field_name in ["response", "content", "data", "text", "message", "output"]:
                        if field_name in result:
                            value = result[field_name]
                            if isinstance(value, str) and value.strip():
                                logger.info(f"[A2A] ✅ Found text in result.{field_name}")
                                return value
                            if isinstance(value, dict) and "text" in value:
                                text = value["text"]
                                if isinstance(text, str) and text.strip():
                                    logger.info(f"[A2A] ✅ Found text in result.{field_name}.text")
                                    return text

                # Check artifacts (standard A2A fallback)
                if "artifacts" in result:
                    artifacts = result["artifacts"]
                    if isinstance(artifacts, list) and artifacts:
                        for i, artifact in enumerate(artifacts):
                            if isinstance(artifact, dict):
                                for part_key in ["parts", "content", "text", "data"]:
                                    if part_key in artifact:
                                        parts_or_content = artifact[part_key]
                                        if isinstance(parts_or_content, str) and parts_or_content.strip():
                                            logger.info(f"[A2A] ✅ Found text in artifacts[{i}].{part_key}")
                                            return parts_or_content
                                        if isinstance(parts_or_content, list):
                                            for j, part in enumerate(parts_or_content):
                                                if isinstance(part, dict) and part.get("kind") == "text":
                                                    text = part.get("text", "")
                                                    if text:
                                                        logger.info(f"[A2A] ✅ Found text in artifacts[{i}].{part_key}[{j}].text")
                                                        return text

                logger.warning("[A2A] Could not extract text from response")
                return None

            logger.error("[A2A] No 'result' field in response")
            return None

    except httpx.TimeoutException as e:
        logger.error(f"[A2A] ⏱️  Timeout error: Agent took too long to respond")
        logger.error(f"[A2A] Agent URL: {agent_url}")
        logger.error(f"[A2A] Consider: 1) Increasing timeout, 2) Checking if agent is slow, 3) Verifying agent is deployed")
        return None

    except httpx.ConnectTimeout as e:
        logger.error(f"[A2A] 🔌 Connection timeout: Could not connect to agent")
        logger.error(f"[A2A] Agent URL: {agent_url}")
        logger.error(f"[A2A] Check: 1) URL is correct, 2) Remove :443 if present, 3) Agent exists and is deployed")
        return None

    except httpx.ConnectError as e:
        logger.error(f"[A2A] 🔌 Connection error: Cannot reach agent endpoint")
        logger.error(f"[A2A] Agent URL: {agent_url}")
        logger.error(f"[A2A] Error: {str(e)}")
        logger.error(f"[A2A] Check: 1) URL spelling, 2) Remove :443 port, 3) DNS resolution, 4) Network/firewall")
        return None

    except httpx.HTTPStatusError as e:
        logger.error(f"[A2A] HTTP error {e.response.status_code}")
        logger.error(f"[A2A] Agent URL: {agent_url}")
        logger.error(f"[A2A] Response: {e.response.text[:200]}")
        if e.response.status_code == 404:
            logger.error(f"[A2A] Agent not found - verify agent name in Kibana")
        elif e.response.status_code == 401:
            logger.error(f"[A2A] Unauthorized - check API key")
        return None

    except httpx.RequestError as e:
        logger.error(f"[A2A] ❌ Request error: {type(e).__name__}")
        logger.error(f"[A2A] Agent URL: {agent_url}")
        logger.error(f"[A2A] Error details: {str(e)}")
        logger.error(f"[A2A] Common causes: DNS failure, connection refused, timeout")
        return None

    except Exception as e:
        logger.error(f"[A2A] Unexpected exception: {type(e).__name__}: {str(e)}")
        logger.error(f"[A2A] Agent URL: {agent_url}")
        import traceback
        logger.debug(traceback.format_exc())
        return None


async def stats_agent_node(state: AgentState) -> dict:
    """Stats Agent: Gathers NBA statistics from Elastic Agent Builder via A2A"""
    logger.info("[STATS_AGENT] Processing query")
    logger.info(f"[STATS_AGENT] Query: {state.user_message}")

    agent_url = os.getenv("ELASTIC_STATS_AGENT_URL")
    api_key = os.getenv("ELASTIC_API_KEY")

    if not agent_url:
        logger.warning("[STATS_AGENT] ELASTIC_STATS_AGENT_URL not configured")
        logger.info("[STATS_AGENT] Using mock data for demo")

        mock_response = """## Top NBA Scorers 2024-2025 Season

1. **Shai Gilgeous-Alexander** (Oklahoma City Thunder) - 32.7 PPG
2. **Luka Dončić** (Dallas Mavericks) - 33.9 PPG
3. **LeBron James** (Los Angeles Lakers) - 28.7 PPG"""

        return {"stats_agent_response": mock_response, "next_node": "synthesize"}

    try:
        stats_response = await call_elastic_agent_a2a(agent_url, state.user_message, api_key)

        if stats_response:
            logger.info(f"[STATS_AGENT] ✅ Got response from agent ({len(stats_response)} chars)")
            return {"stats_agent_response": stats_response, "next_node": "synthesize"}
        else:
            logger.warning("[STATS_AGENT] Agent returned no data, using mock fallback")
            mock_response = "## Top NBA Scorers (Mock Data)\n\nNote: Using mock data - agent did not return text."
            return {"stats_agent_response": mock_response, "next_node": "synthesize"}

    except Exception as e:
        logger.error(f"[STATS_AGENT] Exception: {str(e)}")
        return {"stats_agent_response": f"Error: {str(e)}", "error": str(e), "next_node": "synthesize"}


async def media_agent_node(state: AgentState) -> dict:
    """Media Agent: Handles media recommendations via A2A protocol"""
    logger.info("[MEDIA_AGENT] Processing query")
    logger.info(f"[MEDIA_AGENT] Query: {state.user_message}")

    agent_url = os.getenv("ELASTIC_MEDIA_AGENT_URL")
    api_key = os.getenv("ELASTIC_API_KEY")

    if not agent_url:
        logger.warning("[MEDIA_AGENT] ELASTIC_MEDIA_AGENT_URL not configured")
        logger.info("[MEDIA_AGENT] Using mock data for demo")

        media_response = """## Recommended NBA Media

### Documentaries
- "The Last Dance" (ESPN)
- NBA League Pass"""

        return {"media_agent_response": media_response, "next_node": "synthesize"}

    try:
        media_response = await call_elastic_agent_a2a(agent_url, state.user_message, api_key)

        if media_response:
            logger.info(f"[MEDIA_AGENT] ✅ Got response from agent ({len(media_response)} chars)")
            return {"media_agent_response": media_response, "next_node": "synthesize"}
        else:
            logger.warning("[MEDIA_AGENT] Agent returned no data, using mock fallback")
            mock_response = "## Recommended NBA Media (Mock Data)\n\nNote: Using mock data - agent did not return text."
            return {"media_agent_response": mock_response, "next_node": "synthesize"}

    except Exception as e:
        logger.error(f"[MEDIA_AGENT] Exception: {str(e)}")
        return {"media_agent_response": f"Error: {str(e)}", "error": str(e), "next_node": "synthesize"}


async def stats_and_media_node(state: AgentState) -> dict:
    """Execute both stats and media agents in parallel"""
    logger.info("[BOTH_AGENTS] Running stats and media agents in parallel")

    try:
        stats_task = stats_agent_node(state)
        media_task = media_agent_node(state)

        stats_result, media_result = await asyncio.gather(stats_task, media_task)

        logger.info("[BOTH_AGENTS] ✅ Parallel execution completed")

        return {
            "stats_agent_response": stats_result.get("stats_agent_response", ""),
            "media_agent_response": media_result.get("media_agent_response", ""),
            "next_node": "synthesize"
        }

    except Exception as e:
        logger.error(f"[BOTH_AGENTS] Exception: {str(e)}")
        return {
            "stats_agent_response": f"Error: {str(e)}",
            "media_agent_response": f"Error: {str(e)}",
            "error": str(e),
            "next_node": "synthesize"
        }
