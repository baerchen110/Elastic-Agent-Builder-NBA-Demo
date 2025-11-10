import os
import asyncio
from functools import partial
from dotenv import load_dotenv

from langchain_openai import AzureChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import InMemorySaver

from models.state import AgentState
from supervisor_node import supervisor_node
from worker_agents import (
    stats_agent_node,
    media_agent_node,
    stats_and_media_node
)
from synthesizer import synthesize_node  # ← Import function directly

load_dotenv()


def create_workflow():
    """Build and return the compiled LangGraph workflow."""

    # Initialize Azure OpenAI
    llm = AzureChatOpenAI(
        model="gpt-4o",
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
        temperature=0.7,
        max_tokens=2000
    )

    # Create the workflow graph
    workflow = StateGraph(AgentState)

    # Create supervisor with LLM
    supervisor = supervisor_node(llm)  # ← Pass LLM to supervisor

    # Add nodes
    workflow.add_node("supervisor", supervisor)
    workflow.add_node(
        "stats_agent",
        lambda state: asyncio.run(stats_agent_node(state))
    )
    workflow.add_node(
        "media_agent",
        lambda state: asyncio.run(media_agent_node(state))
    )
    workflow.add_node(
        "both_agents",
        lambda state: asyncio.run(stats_and_media_node(state))
    )

    # ✅ ADD SYNTHESIZER DIRECTLY - NO WRAPPING
    workflow.add_node("synthesize", synthesize_node)

    # Add edges
    workflow.add_edge(START, "supervisor")

    # Supervisor conditionally routes to agents
    def route_based_decision(state: AgentState) -> str:
        next_node = state.get("next_node", "stats_agent")
        return next_node

    workflow.add_conditional_edges(
        "supervisor",
        route_based_decision,
        {
            "stats_agent": "stats_agent",
            "media_agent": "media_agent",
            "both_agents": "both_agents",
            "synthesize": "synthesize"
        }
    )

    # Worker agents always go to synthesis
    workflow.add_edge("stats_agent", "synthesize")
    workflow.add_edge("media_agent", "synthesize")
    workflow.add_edge("both_agents", "synthesize")

    # Synthesis always ends
    workflow.add_edge("synthesize", END)

    # Compile with memory checkpoint
    checkpointer = InMemorySaver()
    compiled_graph = workflow.compile(checkpointer=checkpointer)

    return compiled_graph


if __name__ == "__main__":
    graph = create_workflow()
    print("LangGraph workflow created successfully!")
