# Agent Builder Migration Tool

A Python tool for migrating Elastic Agent Builder configurations (agents and tools) between Elasticsearch Serverless clusters.

## Features

- Connect to source and target Elasticsearch Serverless clusters using API keys
- Retrieve agent configurations by name
- Export tools associated with an agent (with option to exclude platform tools)
- Upload tool definitions to target cluster
- Upload agent definitions to target cluster with updated tool references
- Comprehensive error handling and logging
- Progress tracking during migration

## Prerequisites

- Python 3.7 or higher
- Access to source and target Elasticsearch Serverless clusters
- API keys with appropriate permissions:
  - Source cluster: Read permissions for Agent Builder API
  - Target cluster: Write permissions for Agent Builder API

## Installation

1. Navigate to the tools directory:
```bash
cd agent_builder/tools
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` file with your cluster credentials and agent ID:
```bash
# Source cluster configuration
SOURCE_KIBANA_URL=https://your-source-kibana.elastic.co
SOURCE_API_KEY=your-source-api-key
AGENT_ID=your-agent-id

# Target cluster configuration
TARGET_KIBANA_URL=https://your-target-kibana.elastic.co
TARGET_API_KEY=your-target-api-key

# Optional configuration
SKIP_PLATFORM_TOOLS=true
LOG_LEVEL=info
REQUEST_TIMEOUT=30
```

## Usage

### Basic Migration

Run the migration script:
```bash
python migrate_agent.py
```

The tool will:
1. Connect to the source cluster and retrieve the specified agent
2. Retrieve all tools associated with the agent (excluding platform tools by default)
3. Create each tool in the target cluster
4. Create the agent in the target cluster with updated tool references

### Configuration Options

Environment variables in `.env`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SOURCE_KIBANA_URL` | Yes | - | Source Kibana URL |
| `SOURCE_API_KEY` | Yes | - | Source cluster API key |
| `AGENT_ID` | Yes | - | ID of agent to migrate |
| `TARGET_KIBANA_URL` | Yes | - | Target Kibana URL |
| `TARGET_API_KEY` | Yes | - | Target cluster API key |
| `SKIP_PLATFORM_TOOLS` | No | true | Skip platform tools during migration |
| `LOG_LEVEL` | No | info | Logging level (debug, info, warning, error) |
| `REQUEST_TIMEOUT` | No | 30 | API request timeout in seconds |

### Logging Levels

- `debug`: Detailed information for debugging
- `info`: General informational messages (default)
- `warning`: Warning messages
- `error`: Error messages only

Set logging level in `.env`:
```bash
LOG_LEVEL=debug
```

## Example Output

```
================================================================================
Agent Builder Migration Tool
================================================================================
Source: https://source-kibana.elastic.co
Target: https://target-kibana.elastic.co
Agent ID: agent-123
Skip Platform Tools: True
================================================================================

Initializing clients...

================================================================================
STEP 1: Retrieving agent from source cluster
================================================================================
Found agent: nba_commentary_assitante (ID: agent-123)

================================================================================
STEP 2: Retrieving tools from source cluster
================================================================================
Getting tools for agent: agent-123
Found 3 tool(s) to migrate:
  - NBA Stats Tool (ID: tool-001)
  - Game Schedule Tool (ID: tool-002)
  - Player Search Tool (ID: tool-003)

================================================================================
STEP 3: Migrating tools to target cluster
================================================================================
Migrating 3 tool(s) to target cluster
[1/3] Migrating tool: NBA Stats Tool
  ✓ Successfully created tool: NBA Stats Tool (Source ID: tool-001, Target ID: tool-101)
[2/3] Migrating tool: Game Schedule Tool
  ✓ Successfully created tool: Game Schedule Tool (Source ID: tool-002, Target ID: tool-102)
[3/3] Migrating tool: Player Search Tool
  ✓ Successfully created tool: Player Search Tool (Source ID: tool-003, Target ID: tool-103)

================================================================================
STEP 4: Migrating agent to target cluster
================================================================================
Migrating agent: nba_commentary_assitante
  Updated 3 tool reference(s) in agent configuration
  ✓ Successfully created agent: nba_commentary_assitante (ID: agent-456)

================================================================================
MIGRATION COMPLETED SUCCESSFULLY
================================================================================
Agent Name: nba_commentary_assitante
Agent ID: agent-456
Tools Migrated: 3
================================================================================
```

## API Client

The `agent_builder_client.py` module provides a reusable client for interacting with the Elasticsearch Agent Builder API:

```python
from agent_builder_client import AgentBuilderClient

# Initialize client
client = AgentBuilderClient(
    kibana_url='https://your-kibana.elastic.co',
    api_key='your-api-key',
    timeout=30
)

# List all agents
agents = client.list_agents()

# Get agent by ID
agent = client.get_agent_by_id('agent-123')

# Get agent by name (client-side filtering)
agent = client.get_agent_by_name('my-agent')

# Get tools for an agent (excluding platform tools)
# Note: Pass the full agent object, not just the ID
tools = client.get_agent_tools(agent, skip_platform_tools=True)

# Create a tool
new_tool = client.create_tool({
    'name': 'My Tool',
    'description': 'Tool description',
    'type': 'custom',
    # ... other tool configuration
})

# Create an agent
new_agent = client.create_agent({
    'name': 'My Agent',
    'description': 'Agent description',
    'tools': [new_tool['id']],
    # ... other agent configuration
})
```

## Troubleshooting

### Authentication Errors

If you receive authentication errors:
- Verify your API keys are correct and have not expired
- Ensure the API keys have appropriate permissions:
  - Source: Read access to Agent Builder API
  - Target: Write access to Agent Builder API

### Agent Not Found

If the agent is not found:
- Verify the `AGENT_ID` in `.env` is correct
- Check that the agent exists in the source cluster
- Ensure your API key has permission to access the agent

### Tool Migration Failures

If tool migration fails:
- Check the target cluster doesn't already have tools with the same names
- Verify the tool configurations are valid
- Review error messages for specific validation issues

### Connection Issues

If you experience connection timeouts:
- Increase `REQUEST_TIMEOUT` in `.env`
- Verify network connectivity to both clusters
- Check firewall rules allow connections to Kibana URLs

## API Reference

This tool uses the Elasticsearch Agent Builder API. For detailed API documentation, see:
https://www.elastic.co/docs/api/doc/serverless/group/endpoint-agent-builder

### Key Endpoints Used

- `GET /api/agent_builder/agents` - List all agents
- `GET /api/agent_builder/agents/{id}` - Get agent by ID
- `POST /api/agent_builder/agents` - Create agent
- `GET /api/agent_builder/tools` - List all tools
- `GET /api/agent_builder/tools/{id}` - Get tool by ID
- `POST /api/agent_builder/tools` - Create tool

## Security Considerations

- Store API keys securely and never commit them to version control
- Use API keys with minimal required permissions
- The `.env` file is excluded from git via `.gitignore`
- API keys are transmitted over HTTPS only

## License

This tool is part of the Elastic Agent Builder NBA Demo project.
