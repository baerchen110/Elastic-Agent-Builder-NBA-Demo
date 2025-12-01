"""
Elasticsearch Agent Builder API Client

This module provides a client for interacting with the Elasticsearch Agent Builder API
to manage agents and tools across serverless clusters.
"""

import logging
from typing import Dict, List, Optional, Any
import httpx
from urllib.parse import urljoin


class AgentBuilderClient:
    """Client for interacting with Elasticsearch Agent Builder API."""

    def __init__(
        self,
        kibana_url: str,
        api_key: str,
        timeout: int = 30,
        logger: Optional[logging.Logger] = None
    ):
        """
        Initialize the Agent Builder client.

        Args:
            kibana_url: Base URL for Kibana (e.g., https://your-kibana.elastic.co)
            api_key: API key for authentication
            timeout: Request timeout in seconds
            logger: Optional logger instance
        """
        self.kibana_url = kibana_url.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout
        self.logger = logger or logging.getLogger(__name__)

        # Configure HTTP client
        self.client = httpx.Client(
            timeout=timeout,
            headers={
                'Authorization': f'ApiKey {api_key}',
                'Content-Type': 'application/json',
                'kbn-xsrf': 'true'
            }
        )

    def _build_url(self, path: str) -> str:
        """Build full URL from path."""
        return urljoin(self.kibana_url, path)

    def _make_request(
        self,
        method: str,
        path: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Make HTTP request to Agent Builder API.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            path: API endpoint path
            **kwargs: Additional arguments for httpx request

        Returns:
            Response JSON as dictionary

        Raises:
            httpx.HTTPError: If request fails
        """
        url = self._build_url(path)
        self.logger.debug(f"{method} {url}")

        response = self.client.request(method, url, **kwargs)
        response.raise_for_status()

        return response.json() if response.text else {}

    # =========================================================================
    # Agent Management Methods
    # =========================================================================

    def list_agents(self) -> List[Dict[str, Any]]:
        """
        List all agents.

        Returns:
            List of agent dictionaries
        """
        self.logger.info("Listing agents")
        response = self._make_request('GET', '/api/agent_builder/agents')
        return response.get('data', [])

    def get_agent_by_name(self, agent_name: str) -> Optional[Dict[str, Any]]:
        """
        Get agent by name.

        Args:
            agent_name: Name of the agent

        Returns:
            Agent dictionary or None if not found
        """
        self.logger.info(f"Searching for agent: {agent_name}")
        agents = self.list_agents()

        for agent in agents:
            if agent.get('name') == agent_name:
                self.logger.info(f"Found agent: {agent_name} (ID: {agent.get('id')})")
                return agent

        self.logger.warning(f"Agent not found: {agent_name}")
        return None

    def get_agent_by_id(self, agent_id: str) -> Dict[str, Any]:
        """
        Get agent by ID.

        Args:
            agent_id: Agent identifier

        Returns:
            Agent dictionary
        """
        self.logger.info(f"Getting agent by ID: {agent_id}")
        return self._make_request('GET', f'/api/agent_builder/agents/{agent_id}')

    def create_agent(self, agent_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new agent.

        Args:
            agent_config: Agent configuration dictionary

        Returns:
            Created agent dictionary
        """
        self.logger.info(f"Creating agent: {agent_config.get('name')}")
        return self._make_request(
            'POST',
            '/api/agent_builder/agents',
            json=agent_config
        )

    def update_agent(self, agent_id: str, agent_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update an existing agent.

        Args:
            agent_id: Agent identifier
            agent_config: Updated agent configuration

        Returns:
            Updated agent dictionary
        """
        self.logger.info(f"Updating agent: {agent_id}")
        return self._make_request(
            'PUT',
            f'/api/agent_builder/agents/{agent_id}',
            json=agent_config
        )

    # =========================================================================
    # Tool Management Methods
    # =========================================================================

    def list_tools(self) -> List[Dict[str, Any]]:
        """
        List all tools.

        Returns:
            List of tool dictionaries
        """
        self.logger.info("Listing tools")
        response = self._make_request('GET', '/api/agent_builder/tools')
        return response.get('data', [])

    def get_tool_by_id(self, tool_id: str) -> Dict[str, Any]:
        """
        Get tool by ID.

        Args:
            tool_id: Tool identifier

        Returns:
            Tool dictionary
        """
        self.logger.info(f"Getting tool by ID: {tool_id}")
        return self._make_request('GET', f'/api/agent_builder/tools/{tool_id}')

    def create_tool(self, tool_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new tool.

        Args:
            tool_config: Tool configuration dictionary

        Returns:
            Created tool dictionary
        """
        self.logger.info(f"Creating tool: {tool_config.get('name')}")
        return self._make_request(
            'POST',
            '/api/agent_builder/tools',
            json=tool_config
        )

    def update_tool(self, tool_id: str, tool_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update an existing tool.

        Args:
            tool_id: Tool identifier
            tool_config: Updated tool configuration

        Returns:
            Updated tool dictionary
        """
        self.logger.info(f"Updating tool: {tool_id}")
        return self._make_request(
            'PUT',
            f'/api/agent_builder/tools/{tool_id}',
            json=tool_config
        )

    def get_agent_tools(
        self,
        agent: Dict[str, Any],
        skip_platform_tools: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Get all tools associated with an agent, optionally excluding platform tools.

        Note: The agent definition contains a 'tools' field with a list of tool IDs.
        This method fetches each tool's full definition using GET /api/agent_builder/tools/{id}.

        Args:
            agent: Agent dictionary (must contain 'id' and 'tools' fields)
            skip_platform_tools: If True, exclude platform tools

        Returns:
            List of tool dictionaries
        """
        agent_id = agent.get('id')
        tool_ids = agent.get('tools', [])

        self.logger.info(f"Getting tools for agent: {agent_id}")

        if not tool_ids:
            self.logger.info(f"No tools found for agent: {agent_id}")
            return []

        self.logger.info(f"Agent has {len(tool_ids)} tool reference(s)")

        # Fetch each tool's details by ID
        tools = []
        for tool_id in tool_ids:
            try:
                self.logger.debug(f"Fetching tool: {tool_id}")
                tool = self.get_tool_by_id(tool_id)

                # Filter out platform tools if requested
                if skip_platform_tools and tool.get('type') == 'platform':
                    self.logger.debug(f"Skipping platform tool: {tool.get('name')}")
                    continue

                tools.append(tool)
            except Exception as e:
                self.logger.error(f"Error fetching tool {tool_id}: {e}")

        self.logger.info(
            f"Retrieved {len(tools)} tool(s) for agent {agent_id} "
            f"(platform tools {'excluded' if skip_platform_tools else 'included'})"
        )
        return tools

    def close(self):
        """Close the HTTP client."""
        self.client.close()

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()
