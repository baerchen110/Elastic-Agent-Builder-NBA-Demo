def synthesize_node(state: AgentState) -> AgentState:
    """
    Synthesize results from agents into final report
    """
    logger.info("[NODE:SYNTHESIZE] Synthesizing results")

    try:
        # ✅ UPDATE STATE FIRST
        state.progress = 100
        state.status = "completed" if not state.error else "error"
        state.success = not bool(state.error)

        # ✅ THEN generate report (uses updated values)
        report_parts = []
        report_parts.append("# Multi-Agent NBA Analytics Report\n")
        report_parts.append(f"## Query\n{state.user_message}\n")

        # Workflow summary
        report_parts.append("## Workflow Summary")
        report_parts.append(f"- **Agents Used**: {' → '.join(state.agent_history) or 'None'}")
        report_parts.append(f"- **Status**: {state.status}")
        report_parts.append(f"- **Progress**: {state.progress}%\n")  # ← Now 100%

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

        state.final_report = final_report
        state.messages = state.messages + [AIMessage(content=final_report)]

        logger.info(f"[NODE:SYNTHESIZE] Final: Status={state.status}, Progress={state.progress}%")

        return state

    except Exception as e:
        logger.error(f"[NODE:SYNTHESIZE] ✗ Error: {str(e)}")

        state.error = f"Synthesis error: {str(e)}"
        state.status = "synthesis_error"
        state.success = False
        state.progress = 100
        state.final_report = f"# Error During Synthesis\n\n{str(e)}\n\n**Query**: {state.user_message}"

        return state
