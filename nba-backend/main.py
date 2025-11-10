"""
Main Application Entry Point
Multi-Agent NBA Analytics System with LangGraph + Elastic Agent Builder + Azure OpenAI

FULLY CORRECTED VERSION - Handles AddableValuesDict from LangGraph
"""

import os
import sys
import logging
import uuid
import asyncio
from pathlib import Path

# Add project root to Python path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

# Load environment variables first
from dotenv import load_dotenv
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# LangGraph imports FIRST
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import InMemorySaver

# Local imports
try:
    from models.state import AgentState
    from supervisor_node import supervisor_node
    from worker_agents import stats_agent_node, media_agent_node, stats_and_media_node
    from synthesizer import synthesize_node

    logger.info("[MAIN] ✓ All imports successful")
except ImportError as e:
    logger.error(f"[MAIN] ✗ Import Error: {str(e)}")
    print(f"\n❌ Import Error: {str(e)}")
    print("\nMake sure these files exist:")
    print("  - models/state.py")
    print("  - models/__init__.py")
    print("  - supervisor.py")
    print("  - supervisor_node.py")
    print("  - worker_agents.py")
    print("  - synthesizer.py")
    sys.exit(1)


class MultiAgentWorkflow:
    """
    Main workflow orchestrator for multi-agent NBA analytics system.
    """

    def __init__(self):
        """Initialize the workflow"""
        logger.info("[WORKFLOW] Initializing multi-agent workflow")
        self.workflow = self._build_workflow()
        self.compiled_graph = self._compile_workflow()
        logger.info("[WORKFLOW] ✓ Workflow initialized successfully")

    def _build_workflow(self) -> StateGraph:
        """Build the LangGraph StateGraph"""

        logger.info("[WORKFLOW] Building StateGraph")

        # Create graph with AgentState
        graph = StateGraph(AgentState)

        # Add nodes
        graph.add_node("supervisor", supervisor_node)
        graph.add_node("stats_agent", self._stats_agent_node)
        graph.add_node("media_agent", self._media_agent_node)
        graph.add_node("both_agents", self._both_agents_node)
        graph.add_node("synthesize", synthesize_node)

        # Add edges - START always goes to supervisor
        graph.add_edge(START, "supervisor")

        # Conditional routing from supervisor
        def route_supervisor(state: AgentState) -> str:
            """Route based on supervisor's decision"""
            next_node = state.next_node
            logger.info(f"[ROUTE] Supervisor routing to: {next_node}")
            return next_node

        # Add conditional edges
        graph.add_conditional_edges(
            "supervisor",
            route_supervisor,
            {
                "stats_agent": "stats_agent",
                "media_agent": "media_agent",
                "both": "both_agents",
                "synthesize": "synthesize"
            }
        )

        # All agent nodes route to synthesis
        graph.add_edge("stats_agent", "synthesize")
        graph.add_edge("media_agent", "synthesize")
        graph.add_edge("both_agents", "synthesize")

        # Synthesis goes to end
        graph.add_edge("synthesize", END)

        logger.info("[WORKFLOW] ✓ StateGraph built successfully")
        return graph

    def _compile_workflow(self) -> object:
        """Compile workflow with checkpointing"""

        logger.info("[WORKFLOW] Compiling workflow with memory checkpointer")

        # Use in-memory checkpointer for development
        checkpointer = InMemorySaver()
        compiled = self.workflow.compile(checkpointer=checkpointer)

        logger.info("[WORKFLOW] ✓ Workflow compiled successfully")
        return compiled

    @staticmethod
    def _stats_agent_node(state: AgentState) -> AgentState:
        """Stats agent node wrapper"""

        logger.info("[NODE:STATS_AGENT] Starting stats agent")

        try:
            # Run async stats agent
            result = asyncio.run(stats_agent_node(state))

            # Update state
            for key, value in result.items():
                if hasattr(state, key):
                    setattr(state, key, value)

            state.status = "stats_agent_complete"
            state.progress = 60
            state.current_agent = "stats_agent"
            state.agent_history = state.agent_history + ["stats_agent"]

            logger.info("[NODE:STATS_AGENT] ✓ Stats agent completed")
            return state

        except Exception as e:
            logger.error(f"[NODE:STATS_AGENT] ✗ Error: {str(e)}")
            state.error = f"Stats agent error: {str(e)}"
            state.status = "stats_agent_error"
            state.stats_agent_response = f"Error: {str(e)}"
            state.progress = 50
            return state

    @staticmethod
    def _media_agent_node(state: AgentState) -> AgentState:
        """Media agent node wrapper"""

        logger.info("[NODE:MEDIA_AGENT] Starting media agent")

        try:
            # Run async media agent
            result = asyncio.run(media_agent_node(state))

            # Update state
            for key, value in result.items():
                if hasattr(state, key):
                    setattr(state, key, value)

            state.status = "media_agent_complete"
            state.progress = 60
            state.current_agent = "media_agent"
            state.agent_history = state.agent_history + ["media_agent"]

            logger.info("[NODE:MEDIA_AGENT] ✓ Media agent completed")
            return state

        except Exception as e:
            logger.error(f"[NODE:MEDIA_AGENT] ✗ Error: {str(e)}")
            state.error = f"Media agent error: {str(e)}"
            state.status = "media_agent_error"
            state.media_agent_response = f"Error: {str(e)}"
            state.progress = 50
            return state

    @staticmethod
    def _both_agents_node(state: AgentState) -> AgentState:
        """Both agents node wrapper"""

        logger.info("[NODE:BOTH_AGENTS] Starting parallel execution")

        try:
            # Run both agents in parallel
            result = asyncio.run(stats_and_media_node(state))

            # Update state
            for key, value in result.items():
                if hasattr(state, key):
                    setattr(state, key, value)

            state.status = "both_agents_complete"
            state.progress = 70
            state.current_agent = "both_agents"
            state.agent_history = state.agent_history + ["stats_agent", "media_agent"]

            logger.info("[NODE:BOTH_AGENTS] ✓ Parallel execution completed")
            return state

        except Exception as e:
            logger.error(f"[NODE:BOTH_AGENTS] ✗ Error: {str(e)}")
            state.error = f"Parallel agents error: {str(e)}"
            state.status = "both_agents_error"
            state.stats_agent_response = f"Error: {str(e)}"
            state.media_agent_response = f"Error: {str(e)}"
            state.progress = 50
            return state

    def run(self, query: str, thread_id=None, verbose: bool = False) -> dict:
        """
        Run the workflow for a given query.

        Args:
            query: User's query string
            thread_id: Optional thread ID for checkpointing
            verbose: Whether to print verbose output

        Returns:
            Dictionary containing workflow results
        """

        logger.info(f"[WORKFLOW] Running query: {query}")

        if verbose:
            print(f"\n{'='*70}")
            print(f"User Query: {query}")
            print(f"{'='*70}\n")

        try:
            # Initialize state
            initial_state = AgentState(
                user_message=query,
                messages=[HumanMessage(content=query)],
                status="initialized",
                progress=10
            )

            # Create config with thread ID
            if thread_id is None:
                thread_id = str(uuid.uuid4())

            config = {"configurable": {"thread_id": thread_id}}

            logger.info(f"[WORKFLOW] Thread ID: {thread_id}")
            logger.info("[WORKFLOW] Invoking compiled graph")

            # Run workflow - result will be AddableValuesDict or dict-like
            result = self.compiled_graph.invoke(initial_state, config=config)

            # Convert result to dict (handle both AgentState and AddableValuesDict)
            if isinstance(result, dict):
                result_dict = dict(result)
            else:
                # Try to convert to dict
                try:
                    result_dict = result.model_dump() if hasattr(result, 'model_dump') else dict(result)
                except:
                    result_dict = dict(result)

            if verbose:
                print(f"\n{'='*70}")
                print("Final Report:")
                print(f"{'='*70}\n")
                print(result_dict.get("final_report", "No report generated"))
                print(f"\n{'='*70}\n")

            logger.info("[WORKFLOW] ✓ Workflow completed successfully")

            # Ensure 100% for completed workflows
            final_progress = result_dict.get("progress", 0)
            final_status = result_dict.get("status", "unknown")

            if final_status == "completed":
                final_progress = 100
                logger.info("[WORKFLOW] Progress set to 100% for completed workflow")

            return {
                "thread_id": thread_id,
                "success": result_dict.get("success", False),
                "status": final_status,
                "progress": final_progress,  # ← Now will be 100
                "final_report": result_dict.get("final_report", ""),
                "agents_used": result_dict.get("agent_history", []),
                "error": result_dict.get("error")
            }


        except Exception as e:
            logger.error(f"[WORKFLOW] ✗ Workflow failed: {str(e)}")
            logger.error(f"[WORKFLOW] Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"[WORKFLOW] Traceback: {traceback.format_exc()}")

            error_result = {
                "thread_id": thread_id or "unknown",
                "success": False,
                "status": "error",
                "progress": 0,
                "final_report": f"# Workflow Execution Failed\n\n{str(e)}",
                "error": str(e)
            }

            if verbose:
                print(f"\n{'='*70}")
                print("Error:")
                print(f"{'='*70}\n")
                print(f"Error: {str(e)}\n")
                print(f"{'='*70}\n")

            return error_result


def run_agent(query: str, thread_id=None, verbose: bool = True) -> dict:
    """
    Convenience function to run agent with a single call.

    Args:
        query: User's query
        thread_id: Optional thread ID
        verbose: Print output to console

    Returns:
        Workflow results
    """

    logger.info(f"[MAIN] run_agent called with query: {query}")

    try:
        workflow = MultiAgentWorkflow()
        result = workflow.run(query, thread_id=thread_id, verbose=verbose)
        return result
    except Exception as e:
        logger.error(f"[MAIN] ✗ run_agent failed: {str(e)}")
        raise


# Global workflow instance (created once at startup)
_workflow_instance = None


def get_workflow():
    """Get or create the global workflow instance"""
    global _workflow_instance
    if _workflow_instance is None:
        logger.info("[INVOKE] Creating workflow instance")
        _workflow_instance = MultiAgentWorkflow()
    return _workflow_instance


def invoke_workflow(query: str, thread_id=None, verbose: bool = False) -> dict:
    """
    Invoke the workflow with a query

    This function is called by FastAPI backend (api_server_corrected.py)

    Args:
        query: User's query string
        thread_id: Optional thread ID for tracking
        verbose: Whether to print verbose output

    Returns:
        Dictionary with workflow results
    """
    logger.info(f"[INVOKE] Processing query: {query[:50]}...")

    try:
        # Get workflow instance
        workflow = get_workflow()

        # Run the workflow
        result = workflow.run(query, thread_id=thread_id, verbose=verbose)

        logger.info(f"[INVOKE] ✓ Workflow completed. Status: {result.get('status')}")

        return result

    except Exception as e:
        logger.error(f"[INVOKE] ✗ Exception: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

        return {
            "success": False,
            "status": "error",
            "progress": 0,
            "final_report": f"Error: {str(e)}",
            "agents_used": [],
            "error": str(e)
        }



def main():
    """Main entry point for CLI usage"""

    logger.info("[MAIN] Application started")

    print("\n" + "="*70)
    print("Multi-Agent NBA Analytics System")
    print("="*70 + "\n")

    # Get query from command line or prompt
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        logger.info(f"[MAIN] Query from CLI: {query}")
    else:
        query = input("Enter your query: ").strip()
        logger.info(f"[MAIN] Query from input: {query}")

    if not query:
        print("Error: No query provided")
        logger.error("[MAIN] No query provided")
        sys.exit(1)

    try:
        result = run_agent(query, verbose=True)

        print(f"{'='*70}")
        print("Workflow Summary:")
        print(f"{'='*70}")
        print(f"Success: {result.get('success')}")
        print(f"Status: {result.get('status')}")
        print(f"Agents Used: {', '.join(result.get('agents_used', []))}")

        if result.get('error'):
            print(f"Error: {result.get('error')}")

        print(f"{'='*70}\n")

        logger.info("[MAIN] ✓ Application completed successfully")
        sys.exit(0)

    except Exception as e:
        logger.error(f"[MAIN] ✗ Application failed: {str(e)}")
        print(f"\nError: {str(e)}\n")
        sys.exit(1)



if __name__ == "__main__":
    main()
