"""
Supervisor Node Handler for LangGraph
Properly converts supervisor routing response to AgentState
Routes to appropriate agents based on user query

CRITICAL FIX: The supervisor.route() returns a dict with string keys,
but we need to return an AgentState object with the updated attributes.
"""

import logging
from models.state import AgentState
from supervisor import get_supervisor

logger = logging.getLogger(__name__)


def supervisor_node(state: AgentState) -> AgentState:
    """
    Supervisor node: routes queries to appropriate agents

    CRITICAL: Must return AgentState object with updated fields
    The supervisor.route() returns a dict, we convert it to state updates

    Args:
        state: Current AgentState (will be an AgentState instance from LangGraph)

    Returns:
        Updated AgentState with routing decision
    """

    logger.info("[NODE:SUPERVISOR] Processing supervisor decision")
    logger.info(f"[NODE:SUPERVISOR] State type: {type(state)}")
    logger.info(f"[NODE:SUPERVISOR] State: {state}")

    try:
        # Get supervisor instance
        supervisor = get_supervisor()

        # Get routing decision - this returns a DICT
        # IMPORTANT: state should be AgentState object here
        if not isinstance(state, AgentState):
            logger.error(f"[NODE:SUPERVISOR] ERROR: state is {type(state)}, not AgentState!")
            logger.error(f"[NODE:SUPERVISOR] state value: {state}")
            raise TypeError(f"Expected AgentState, got {type(state)}")

        user_message = state.user_message or ""

        if not user_message:
            logger.warning("[NODE:SUPERVISOR] No user message provided")
            state.next_node = "synthesize"
            state.supervisor_reasoning = "No user message provided"
            state.status = "supervisor_complete"
            state.progress = 25
            return state

        # route() returns: {"next_node": "...", "supervisor_reasoning": "...", "success": bool}
        result = supervisor.route(user_message)

        logger.info(f"[NODE:SUPERVISOR] ✓ Routed to: {result['next_node']}")
        logger.info(f"[NODE:SUPERVISOR] Reasoning: {result['supervisor_reasoning']}")

        # Convert dict result to state attributes
        state.next_node = result.get("next_node", "stats_agent")
        state.supervisor_reasoning = result.get("supervisor_reasoning", "")
        state.status = "supervisor_complete"
        state.progress = 25

        return state

    except Exception as e:
        logger.error(f"[NODE:SUPERVISOR] ✗ Error: {str(e)}")
        logger.error(f"[NODE:SUPERVISOR] Error type: {type(e).__name__}")
        import traceback
        logger.error(f"[NODE:SUPERVISOR] Traceback: {traceback.format_exc()}")

        # Try to set error even if state is malformed
        try:
            if isinstance(state, AgentState):
                state.next_node = "synthesize"
                state.error = f"Supervisor error: {str(e)}"
                state.status = "supervisor_error"
                state.progress = 0
                return state
            else:
                logger.critical(f"[NODE:SUPERVISOR] Cannot update state - it is {type(state)}")
                raise
        except Exception as e2:
            logger.critical(f"[NODE:SUPERVISOR] Failed to handle error: {str(e2)}")
            raise
