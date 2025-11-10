import httpx
import json
import os
from typing import Optional, Dict, Any
import asyncio


class A2AClient:
    """Client for communicating with A2A-compatible agents."""

    def __init__(
            self,
            agent_url: str,
            api_key: Optional[str] = None,
            timeout: float = 30.0
    ):
        self.agent_url = agent_url
        self.api_key = api_key
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)

    async def fetch_agent_card(self) -> Dict[str, Any]:
        """Fetch agent card from A2A endpoint."""
        try:
            headers = self._get_headers()
            response = await self.client.get(
                f"{self.agent_url}/.well-known/agent.json",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.RequestError as e:
            print(f"Error fetching agent card: {e}")
            return {}

    async def send_message(
            self,
            message: str,
            session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send a message to the A2A agent."""
        try:
            headers = self._get_headers()

            # A2A protocol message format
            payload = {
                "jsonrpc": "2.0",
                "method": "tasks/send",
                "params": {
                    "id": session_id or "default-session",
                    "message": {
                        "role": "user",
                        "parts": [{"type": "text", "text": message}]
                    }
                }
            }

            response = await self.client.post(
                self.agent_url,
                json=payload,
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.RequestError as e:
            print(f"Error sending message to agent: {e}")
            return {"error": str(e)}

    async def send_message_stream(
            self,
            message: str,
            session_id: Optional[str] = None
    ) -> Any:
        """Stream a message to the A2A agent (for streaming responses)."""
        try:
            headers = self._get_headers()
            headers["Accept"] = "text/event-stream"

            payload = {
                "jsonrpc": "2.0",
                "method": "tasks/sendSubscribe",
                "params": {
                    "id": session_id or "default-session",
                    "message": {
                        "role": "user",
                        "parts": [{"type": "text", "text": message}]
                    }
                }
            }

            async with self.client.stream(
                    "POST",
                    self.agent_url,
                    json=payload,
                    headers=headers
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        yield json.loads(line[5:])
        except httpx.RequestError as e:
            print(f"Error streaming from agent: {e}")
            yield {"error": str(e)}

    def _get_headers(self) -> Dict[str, str]:
        """Build request headers with authentication if needed."""
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def close(self):
        """Close the async client."""
        await self.client.aclose()
