#!/usr/bin/env python3
"""
Agent Builder Migration Tool

This script migrates Agent Builder configurations (agents and tools) between
Elasticsearch Serverless clusters.

Usage:
    python migrate_agent.py

Configuration is loaded from .env file with the following variables:
    - SOURCE_KIBANA_URL: Source Kibana URL
    - SOURCE_API_KEY: Source API key
    - AGENT_NAME: Name of the agent to migrate
    - TARGET_KIBANA_URL: Target Kibana URL
    - TARGET_API_KEY: Target API key
    - SKIP_PLATFORM_TOOLS: Skip platform tools (default: true)
    - LOG_LEVEL: Logging level (default: info)
"""

import os
import sys
import logging
from typing import Dict, List, Any
from dotenv import load_dotenv
from agent_builder_client import AgentBuilderClient


def setup_logging(log_level: str = 'INFO') -> logging.Logger:
    """
    Configure logging for the migration tool.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR)

    Returns:
        Configured logger instance
    """
    level = getattr(logging, log_level.upper(), logging.INFO)

    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    return logging.getLogger(__name__)


def load_config() -> Dict[str, Any]:
    """
    Load configuration from environment variables.

    Returns:
        Configuration dictionary

    Raises:
        ValueError: If required variables are missing
    """
    load_dotenv()

    required_vars = [
        'SOURCE_KIBANA_URL',
        'SOURCE_API_KEY',
        'AGENT_NAME',
        'TARGET_KIBANA_URL',
        'TARGET_API_KEY'
    ]

    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing_vars)}\n"
            f"Please ensure your .env file contains all required variables."
        )

    return {
        'source_kibana_url': os.getenv('SOURCE_KIBANA_URL'),
        'source_api_key': os.getenv('SOURCE_API_KEY'),
        'agent_name': os.getenv('AGENT_NAME'),
        'target_kibana_url': os.getenv('TARGET_KIBANA_URL'),
        'target_api_key': os.getenv('TARGET_API_KEY'),
        'skip_platform_tools': os.getenv('SKIP_PLATFORM_TOOLS', 'true').lower() == 'true',
        'log_level': os.getenv('LOG_LEVEL', 'INFO'),
        'request_timeout': int(os.getenv('REQUEST_TIMEOUT', '30'))
    }


def sanitize_tool_for_creation(tool: Dict[str, Any]) -> Dict[str, Any]:
    """
    Remove fields that shouldn't be included when creating a tool.

    Args:
        tool: Original tool dictionary

    Returns:
        Sanitized tool dictionary
    """
    # Fields to remove (typically auto-generated or read-only)
    fields_to_remove = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']

    sanitized = {k: v for k, v in tool.items() if k not in fields_to_remove}
    return sanitized


def sanitize_agent_for_creation(agent: Dict[str, Any]) -> Dict[str, Any]:
    """
    Remove fields that shouldn't be included when creating an agent.

    Args:
        agent: Original agent dictionary

    Returns:
        Sanitized agent dictionary
    """
    # Fields to remove (typically auto-generated or read-only)
    fields_to_remove = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']

    sanitized = {k: v for k, v in agent.items() if k not in fields_to_remove}
    return sanitized


def migrate_tools(
    source_tools: List[Dict[str, Any]],
    target_client: AgentBuilderClient,
    logger: logging.Logger
) -> Dict[str, str]:
    """
    Migrate tools from source to target cluster.

    Args:
        source_tools: List of tool configurations from source cluster
        target_client: Client for target cluster
        logger: Logger instance

    Returns:
        Mapping of source tool IDs to target tool IDs
    """
    tool_id_mapping = {}

    logger.info(f"Migrating {len(source_tools)} tool(s) to target cluster")

    for i, source_tool in enumerate(source_tools, 1):
        tool_name = source_tool.get('name', 'Unknown')
        source_tool_id = source_tool.get('id')

        try:
            logger.info(f"[{i}/{len(source_tools)}] Migrating tool: {tool_name}")

            # Sanitize tool configuration
            tool_config = sanitize_tool_for_creation(source_tool)

            # Create tool on target cluster
            created_tool = target_client.create_tool(tool_config)
            target_tool_id = created_tool.get('id')

            tool_id_mapping[source_tool_id] = target_tool_id

            logger.info(
                f"  ✓ Successfully created tool: {tool_name} "
                f"(Source ID: {source_tool_id}, Target ID: {target_tool_id})"
            )

        except Exception as e:
            logger.error(f"  ✗ Failed to migrate tool {tool_name}: {e}")
            raise

    return tool_id_mapping


def migrate_agent(
    source_agent: Dict[str, Any],
    tool_id_mapping: Dict[str, str],
    target_client: AgentBuilderClient,
    logger: logging.Logger
) -> Dict[str, Any]:
    """
    Migrate agent from source to target cluster.

    Args:
        source_agent: Agent configuration from source cluster
        tool_id_mapping: Mapping of source tool IDs to target tool IDs
        target_client: Client for target cluster
        logger: Logger instance

    Returns:
        Created agent dictionary
    """
    agent_name = source_agent.get('name', 'Unknown')
    logger.info(f"Migrating agent: {agent_name}")

    try:
        # Sanitize agent configuration
        agent_config = sanitize_agent_for_creation(source_agent)

        # Update tool references to use new tool IDs
        if 'tools' in agent_config and agent_config['tools']:
            original_tool_ids = agent_config['tools']
            updated_tool_ids = [
                tool_id_mapping.get(tool_id, tool_id)
                for tool_id in original_tool_ids
            ]
            agent_config['tools'] = updated_tool_ids

            logger.info(
                f"  Updated {len(updated_tool_ids)} tool reference(s) in agent configuration"
            )

        # Create agent on target cluster
        created_agent = target_client.create_agent(agent_config)

        logger.info(
            f"  ✓ Successfully created agent: {agent_name} "
            f"(ID: {created_agent.get('id')})"
        )

        return created_agent

    except Exception as e:
        logger.error(f"  ✗ Failed to migrate agent {agent_name}: {e}")
        raise


def main():
    """Main execution function."""
    try:
        # Load configuration
        config = load_config()
        logger = setup_logging(config['log_level'])

        logger.info("=" * 80)
        logger.info("Agent Builder Migration Tool")
        logger.info("=" * 80)
        logger.info(f"Source: {config['source_kibana_url']}")
        logger.info(f"Target: {config['target_kibana_url']}")
        logger.info(f"Agent: {config['agent_name']}")
        logger.info(f"Skip Platform Tools: {config['skip_platform_tools']}")
        logger.info("=" * 80)

        # Initialize clients
        logger.info("\nInitializing clients...")
        with AgentBuilderClient(
            config['source_kibana_url'],
            config['source_api_key'],
            timeout=config['request_timeout'],
            logger=logger
        ) as source_client, AgentBuilderClient(
            config['target_kibana_url'],
            config['target_api_key'],
            timeout=config['request_timeout'],
            logger=logger
        ) as target_client:

            # Step 1: Get agent from source cluster
            logger.info("\n" + "=" * 80)
            logger.info("STEP 1: Retrieving agent from source cluster")
            logger.info("=" * 80)

            source_agent = source_client.get_agent_by_name(config['agent_name'])
            if not source_agent:
                raise ValueError(f"Agent not found: {config['agent_name']}")

            agent_id = source_agent.get('id')
            logger.info(f"Found agent: {config['agent_name']} (ID: {agent_id})")

            # Step 2: Get tools from source cluster
            logger.info("\n" + "=" * 80)
            logger.info("STEP 2: Retrieving tools from source cluster")
            logger.info("=" * 80)

            source_tools = source_client.get_agent_tools(
                agent_id,
                skip_platform_tools=config['skip_platform_tools']
            )

            if source_tools:
                logger.info(f"Found {len(source_tools)} tool(s) to migrate:")
                for tool in source_tools:
                    logger.info(f"  - {tool.get('name')} (ID: {tool.get('id')})")
            else:
                logger.info("No tools to migrate")

            # Step 3: Migrate tools to target cluster
            logger.info("\n" + "=" * 80)
            logger.info("STEP 3: Migrating tools to target cluster")
            logger.info("=" * 80)

            tool_id_mapping = {}
            if source_tools:
                tool_id_mapping = migrate_tools(source_tools, target_client, logger)
            else:
                logger.info("Skipping tool migration (no tools found)")

            # Step 4: Migrate agent to target cluster
            logger.info("\n" + "=" * 80)
            logger.info("STEP 4: Migrating agent to target cluster")
            logger.info("=" * 80)

            created_agent = migrate_agent(
                source_agent,
                tool_id_mapping,
                target_client,
                logger
            )

            # Summary
            logger.info("\n" + "=" * 80)
            logger.info("MIGRATION COMPLETED SUCCESSFULLY")
            logger.info("=" * 80)
            logger.info(f"Agent Name: {created_agent.get('name')}")
            logger.info(f"Agent ID: {created_agent.get('id')}")
            logger.info(f"Tools Migrated: {len(source_tools)}")
            logger.info("=" * 80)

            return 0

    except KeyboardInterrupt:
        logger.error("\n\nMigration cancelled by user")
        return 130

    except Exception as e:
        logger.error(f"\n\nMigration failed: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
