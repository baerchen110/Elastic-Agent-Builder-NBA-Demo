"""
Agent State Definition for LangGraph
Pydantic model that represents the complete state of the multi-agent workflow
"""

from typing import List, Optional, Any
from pydantic import BaseModel, Field
from langchain_core.messages import BaseMessage


class AgentState(BaseModel):
    """Complete state for multi-agent NBA analytics workflow"""

    # User input
    user_message: str = Field(default="", description="User's query message")
    messages: List[BaseMessage] = Field(default_factory=list, description="Message history")

    # Routing/Supervision
    next_node: str = Field(default="supervisor", description="Next node to execute")
    supervisor_reasoning: str = Field(default="", description="Supervisor's routing reasoning")

    # Workflow tracking
    status: str = Field(default="initialized", description="Current workflow status")
    progress: int = Field(default=0, description="Workflow progress (0-100)")
    workflow_step: int = Field(default=0, description="Current workflow step number")
    agent_history: List[str] = Field(default_factory=list, description="List of agents that have run")
    current_agent: str = Field(default="", description="Currently executing agent")

    # Agent responses
    stats_agent_response: str = Field(default="", description="Response from stats agent")
    media_agent_response: str = Field(default="", description="Response from media agent")

    # Final outputs
    final_report: str = Field(default="", description="Final synthesized report")
    insights: List[str] = Field(default_factory=list, description="Key insights from analysis")
    success: bool = Field(default=False, description="Whether workflow succeeded")
    error: Optional[str] = Field(default=None, description="Error message if workflow failed")

    class Config:
        """Pydantic configuration"""
        arbitrary_types_allowed = True  # Allow BaseMessage types
