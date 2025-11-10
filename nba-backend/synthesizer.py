"""
Synthesizer Module - FINAL FIX (No Type Hints on Function Signature)
Combines results from multiple agents into a final report

FIX: Removed type hints from function signature to avoid LangGraph type evaluation errors
"""

import logging
from langchain_core.messages import AIMessage

logger = logging.getLogger(__name__)


def synthesize_node(state):
    """
    Synthesize results from agents into final report

    Args:
        state: Current AgentState with agent responses

    Returns:
        Updated AgentState with final report
    """

    logger.info("[NODE:SYNTHESIZE] Synthesizing results")

    try:
        # ✅ UPDATE STATE FIRST
        state.progress = 100
        state.status = "completed" if not state.error else "error"
        state.success = not bool(state.error)

        # ✅ THEN generate report
        report_parts = []
        report_parts.append("# Multi-Agent NBA Analytics Report\n")
        report_parts.append(f"## Query\n{state.user_message}\n")

        # Workflow summary
        report_parts.append("## Workflow Summary")
        report_parts.append(f"- **Agents Used**: {' → '.join(state.agent_history) or 'None'}")
        report_parts.append(f"- **Status**: {state.status}")
        report_parts.append(f"- **Progress**: {state.progress}%\n")

        # Error handling
        if state.error:
            report_parts.append(f"## Error\n{state.error}\n")

        # Stats results
        if state.stats_agent_response:
            report_parts.append("## NBA Statistics\n")
            report_parts.append(state.stats_agent_response)
            report_parts.append("\n")

        # Media results
        if state.media_agent_response:
            report_parts.append("## Media Recommendations\n")
            report_parts.append(state.media_agent_response)
            report_parts.append("\n")

        # Insights
        if state.insights:
            report_parts.append("## Key Insights\n")
            for insight in state.insights:
                report_parts.append(f"- {insight}\n")

        # Generate final report
        final_report = "\n".join(report_parts)

        logger.info("[NODE:SYNTHESIZE] ✓ Report generated successfully")

        # Update state
        state.final_report = final_report
        state.messages = state.messages + [AIMessage(content=final_report)]

        logger.info(f"[NODE:SYNTHESIZE] Final: Status={state.status}, Progress={state.progress}%")

        return state

    except Exception as e:
        logger.error(f"[NODE:SYNTHESIZE] ✗ Error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

        state.error = f"Synthesis error: {str(e)}"
        state.status = "synthesis_error"
        state.success = False
        state.progress = 100
        state.final_report = f"# Error During Synthesis\n\n{str(e)}\n\n**Query**: {state.user_message}"

        return state


def create_synthesizer(llm=None):
    """Factory function for compatibility - returns the synthesize_node function"""
    return synthesize_node


__all__ = ['synthesize_node', 'create_synthesizer']
