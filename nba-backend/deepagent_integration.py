"""
DeepAgent Integration with LangGraph Backend
Integrates DeepAgent orchestration layer with your existing LangGraph multi-agent system

DeepAgent capabilities:
- Superior agent routing and orchestration
- Enhanced reasoning and planning
- Multi-step workflow optimization
- Better error recovery and retry logic
- Advanced state management

Architecture:
    Browser (React)
        ↓
    Node.js server.js (Port 3001)
        ↓
    FastAPI Backend (Port 3002)
        ↓
    DeepAgent Orchestration Layer ← NEW
        ↓
    LangGraph Multi-Agent System
        ↓
    Elastic Agent Builder (A2A Protocol)

Usage:
    pip install deepagent>=0.1.0
    python deepagent_integration.py
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ===== DEEPAGENT ORCHESTRATION LAYER =====

class DeepAgentOrchestrator:
    """
    Orchestration layer using DeepAgent for superior agent coordination
    
    Features:
    - Intelligent agent routing
    - Multi-step planning
    - Dynamic agent selection
    - Response aggregation
    - Error recovery
    """
    
    def __init__(self):
        """Initialize DeepAgent orchestrator"""
        self.logger = logging.getLogger(__name__ + ".DeepAgentOrchestrator")
        self.logger.info("[DEEPAGENT] Initializing orchestrator")
        
        # Import DeepAgent
        try:
            from deepagent import DeepAgentOrchestrator as DAOrchestrator
            self.orchestrator = DAOrchestrator()
            self.logger.info("[DEEPAGENT] ✅ DeepAgent initialized")
            self.deepagent_available = True
        except ImportError:
            self.logger.warning("[DEEPAGENT] ⚠️ DeepAgent not installed, using fallback")
            self.deepagent_available = False
            self.orchestrator = None
    
    async def orchestrate_query(
        self,
        query: str,
        agents: Dict[str, callable],
        max_iterations: int = 3,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """
        Orchestrate query execution using DeepAgent
        
        Args:
            query: User query
            agents: Dict of agent_id -> agent_callable
            max_iterations: Max planning iterations
            temperature: LLM temperature for planning
            
        Returns:
            Orchestrated response with plan and results
        """
        self.logger.info(f"[DEEPAGENT] Orchestrating query: {query[:50]}...")
        
        try:
            if self.deepagent_available and self.orchestrator:
                return await self._deepagent_orchestrate(
                    query, agents, max_iterations, temperature
                )
            else:
                return await self._fallback_orchestrate(query, agents)
        
        except Exception as e:
            self.logger.error(f"[DEEPAGENT] Orchestration error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "plan": [],
                "results": []
            }
    
    async def _deepagent_orchestrate(
        self,
        query: str,
        agents: Dict[str, callable],
        max_iterations: int,
        temperature: float
    ) -> Dict[str, Any]:
        """
        Use DeepAgent for orchestration
        """
        self.logger.info("[DEEPAGENT] Using DeepAgent orchestration")
        
        try:
            # Generate orchestration plan
            plan = await self.orchestrator.plan(
                query=query,
                agents=list(agents.keys()),
                max_iterations=max_iterations,
                temperature=temperature
            )
            
            self.logger.info(f"[DEEPAGENT] Generated plan with {len(plan)} steps")
            
            # Execute plan
            results = []
            for step_idx, step in enumerate(plan):
                self.logger.info(f"[DEEPAGENT] Executing step {step_idx + 1}: {step.get('agent')}")
                
                agent_id = step.get("agent")
                step_query = step.get("query", query)
                
                if agent_id in agents:
                    agent_fn = agents[agent_id]
                    result = await agent_fn(step_query)
                    
                    results.append({
                        "step": step_idx + 1,
                        "agent": agent_id,
                        "query": step_query,
                        "result": result,
                        "timestamp": datetime.now().isoformat()
                    })
            
            return {
                "success": True,
                "orchestrator": "deepagent",
                "plan": plan,
                "results": results,
                "iterations": len(plan)
            }
        
        except Exception as e:
            self.logger.error(f"[DEEPAGENT] Error in _deepagent_orchestrate: {str(e)}")
            raise
    
    async def _fallback_orchestrate(
        self,
        query: str,
        agents: Dict[str, callable]
    ) -> Dict[str, Any]:
        """
        Fallback orchestration without DeepAgent
        Uses simple routing and sequential execution
        """
        self.logger.info("[DEEPAGENT] Using fallback orchestration (DeepAgent not available)")
        
        try:
            # Simple agent selection based on query keywords
            agent_selection = self._select_agents(query, list(agents.keys()))
            
            self.logger.info(f"[DEEPAGENT] Selected agents: {agent_selection}")
            
            # Execute selected agents
            results = []
            for agent_id in agent_selection:
                if agent_id in agents:
                    agent_fn = agents[agent_id]
                    result = await agent_fn(query)
                    
                    results.append({
                        "agent": agent_id,
                        "result": result,
                        "timestamp": datetime.now().isoformat()
                    })
            
            return {
                "success": True,
                "orchestrator": "fallback",
                "plan": [{"agent": a, "query": query} for a in agent_selection],
                "results": results,
                "iterations": len(results)
            }
        
        except Exception as e:
            self.logger.error(f"[DEEPAGENT] Error in _fallback_orchestrate: {str(e)}")
            raise
    
    def _select_agents(self, query: str, available_agents: List[str]) -> List[str]:
        """
        Simple heuristic agent selection based on query
        """
        query_lower = query.lower()
        selected = []
        
        # Stats keywords
        if any(word in query_lower for word in [
            'score', 'stats', 'points', 'performance', 'leader', 'top',
            'average', 'shooting', 'rebounds', 'assists'
        ]):
            if 'stats_agent' in available_agents:
                selected.append('stats_agent')
        
        # Media/News keywords
        if any(word in query_lower for word in [
            'news', 'update', 'injury', 'trade', 'media', 'recent',
            'latest', 'happening', 'event'
        ]):
            if 'media_agent' in available_agents:
                selected.append('media_agent')
        
        # If no agents selected, use all
        if not selected:
            selected = available_agents[:1]  # Default to first agent
        
        return selected


# ===== INTEGRATION WITH LANGGRAPH =====

async def execute_with_deepagent(
    query: str,
    langgraph_workflow,
    enable_deepagent: bool = True
) -> Dict[str, Any]:
    """
    Execute LangGraph workflow with optional DeepAgent orchestration
    
    Args:
        query: User query
        langgraph_workflow: Your LangGraph MultiAgentWorkflow instance
        enable_deepagent: Whether to use DeepAgent orchestration
        
    Returns:
        Combined response with DeepAgent insights
    """
    
    logger.info(f"[INTEGRATION] Executing query with DeepAgent: {enable_deepagent}")
    
    try:
        if enable_deepagent:
            # Initialize DeepAgent orchestrator
            orchestrator = DeepAgentOrchestrator()
            
            # Define agent functions that call LangGraph
            agents = {
                "stats_agent": lambda q: langgraph_workflow.run(q, agent_route="stats"),
                "media_agent": lambda q: langgraph_workflow.run(q, agent_route="media"),
                "supervisor": lambda q: langgraph_workflow.run(q)
            }
            
            # Get orchestration plan from DeepAgent
            orchestration = await orchestrator.orchestrate_query(
                query=query,
                agents=agents,
                max_iterations=3,
                temperature=0.7
            )
            
            logger.info(f"[INTEGRATION] DeepAgent orchestration complete")
            
            # Run the original workflow
            workflow_result = langgraph_workflow.run(query)
            
            # Combine DeepAgent insights with workflow result
            return {
                "success": True,
                "query": query,
                "workflow_result": workflow_result,
                "deepagent_orchestration": orchestration,
                "final_report": workflow_result.get("final_report"),
                "agents_used": workflow_result.get("agents_used"),
                "orchestration_insights": {
                    "plan_steps": len(orchestration.get("plan", [])),
                    "agents_analyzed": list(orchestration.get("results", [])),
                    "orchestrator_type": orchestration.get("orchestrator")
                }
            }
        else:
            # Run without DeepAgent
            return langgraph_workflow.run(query)
    
    except Exception as e:
        logger.error(f"[INTEGRATION] Error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        
        return {
            "success": False,
            "error": str(e),
            "workflow_result": None,
            "deepagent_orchestration": None
        }


# ===== FASTAPI INTEGRATION =====

def create_deepagent_endpoints(app):
    """
    Add DeepAgent endpoints to FastAPI app
    
    Usage:
        from fastapi import FastAPI
        app = FastAPI()
        create_deepagent_endpoints(app)
    """
    
    from fastapi import HTTPException
    from pydantic import BaseModel
    from typing import Optional
    
    class DeepAgentQueryRequest(BaseModel):
        query: str
        enable_deepagent: bool = True
        max_iterations: int = 3
        temperature: float = 0.7
    
    class DeepAgentQueryResponse(BaseModel):
        success: bool
        query: str
        final_report: str
        agents_used: List[str] = []
        orchestration_insights: Optional[Dict[str, Any]] = None
        error: Optional[str] = None
    
    @app.post("/api/query/deepagent", response_model=DeepAgentQueryResponse)
    async def process_query_with_deepagent(request: DeepAgentQueryRequest):
        """
        Process query with DeepAgent orchestration
        """
        from main import invoke_workflow
        
        logger.info(f"[API] DeepAgent query endpoint: {request.query[:50]}...")
        
        try:
            # Get workflow
            from main import get_workflow
            workflow = get_workflow()
            
            # Execute with DeepAgent
            result = await execute_with_deepagent(
                query=request.query,
                langgraph_workflow=workflow,
                enable_deepagent=request.enable_deepagent
            )
            
            return DeepAgentQueryResponse(
                success=result.get("success", False),
                query=request.query,
                final_report=result.get("final_report", ""),
                agents_used=result.get("agents_used", []),
                orchestration_insights=result.get("orchestration_insights"),
                error=result.get("error")
            )
        
        except Exception as e:
            logger.error(f"[API] DeepAgent error: {str(e)}")
            
            return DeepAgentQueryResponse(
                success=False,
                query=request.query,
                final_report="Error processing query",
                agents_used=[],
                orchestration_insights=None,
                error=str(e)
            )
    
    @app.get("/api/deepagent/status")
    async def deepagent_status():
        """Get DeepAgent status"""
        orchestrator = DeepAgentOrchestrator()
        
        return {
            "deepagent_available": orchestrator.deepagent_available,
            "status": "ready" if orchestrator.deepagent_available else "fallback",
            "timestamp": datetime.now().isoformat()
        }
    
    logger.info("[API] ✅ DeepAgent endpoints registered")
    
    return app


# ===== TESTING =====

async def test_deepagent_integration():
    """Test DeepAgent integration"""
    
    print("\n" + "=" * 70)
    print("Testing DeepAgent Integration")
    print("=" * 70)
    
    orchestrator = DeepAgentOrchestrator()
    
    # Mock agents for testing
    async def mock_stats_agent(query: str) -> str:
        return f"Stats for: {query}"
    
    async def mock_media_agent(query: str) -> str:
        return f"Media for: {query}"
    
    agents = {
        "stats_agent": mock_stats_agent,
        "media_agent": mock_media_agent
    }
    
    query = "Who are the top NBA scorers?"
    
    result = await orchestrator.orchestrate_query(
        query=query,
        agents=agents
    )
    
    print(f"\n✅ Orchestration Result:")
    print(f"   Success: {result.get('success')}")
    print(f"   Orchestrator: {result.get('orchestrator')}")
    print(f"   Iterations: {result.get('iterations')}")
    print(f"   Results: {len(result.get('results', []))}")


if __name__ == "__main__":
    # Test the integration
    asyncio.run(test_deepagent_integration())
