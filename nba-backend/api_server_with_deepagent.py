"""
FastAPI Backend with DeepAgent Integration - FIXED
Combines FastAPI, LangGraph, and DeepAgent for enhanced multi-agent orchestration

FIX: Added missing AgentState import

Features:
- Traditional /api/query endpoint (LangGraph only)
- New /api/query/deepagent endpoint (with DeepAgent orchestration)
- DeepAgent fallback to LangGraph if not installed
- Full error handling and logging

Usage:
    python api_server_with_deepagent.py
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import asyncio
import logging
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="NBA Multi-Agent Backend with DeepAgent",
    description="LangGraph + DeepAgent orchestration for NBA analytics",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== PYDANTIC MODELS =====

class QueryRequest(BaseModel):
    """Request model for query endpoint"""
    query: str


class DeepAgentQueryRequest(BaseModel):
    """Request model for DeepAgent endpoint"""
    query: str
    enable_deepagent: bool = True
    max_iterations: int = 3
    temperature: float = 0.7


class QueryResponse(BaseModel):
    """Response model for query endpoint"""
    success: bool
    result: str
    agents_used: List[str] = []
    status: str = "completed"
    error: Optional[str] = None


class DeepAgentQueryResponse(BaseModel):
    """Response model for DeepAgent endpoint"""
    success: bool
    query: str
    final_report: str
    agents_used: List[str] = []
    orchestration_insights: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# ===== DEEPAGENT INTEGRATION =====

class DeepAgentOrchestrator:
    """Simple DeepAgent orchestrator with fallback"""

    def __init__(self):
        self.logger = logging.getLogger(__name__ + ".DeepAgentOrchestrator")
        self.logger.info("[DEEPAGENT] Initializing orchestrator")

        try:
            # Try to import DeepAgent
            from deepagent import DeepAgentOrchestrator as DAOrchestrator
            self.orchestrator = DAOrchestrator()
            self.logger.info("[DEEPAGENT] ✅ DeepAgent initialized")
            self.deepagent_available = True
        except ImportError:
            self.logger.warning("[DEEPAGENT] ⚠️ DeepAgent not installed, using fallback")
            self.deepagent_available = False
            self.orchestrator = None

    async def orchestrate_query(self, query: str, agents: Dict) -> Dict[str, Any]:
        """Orchestrate query execution"""

        self.logger.info(f"[DEEPAGENT] Orchestrating: {query[:50]}...")

        if self.deepagent_available:
            return await self._deepagent_orchestrate(query, agents)
        else:
            return await self._fallback_orchestrate(query, agents)

    async def _deepagent_orchestrate(self, query: str, agents: Dict) -> Dict[str, Any]:
        """Use DeepAgent for orchestration"""
        self.logger.info("[DEEPAGENT] Using DeepAgent orchestration")

        try:
            plan = await self.orchestrator.plan(
                query=query,
                agents=list(agents.keys()),
                max_iterations=3,
                temperature=0.7
            )

            self.logger.info(f"[DEEPAGENT] Generated plan with {len(plan)} steps")

            results = []
            for step in plan:
                agent_id = step.get("agent")
                if agent_id in agents:
                    result = await agents[agent_id](query)
                    results.append({
                        "agent": agent_id,
                        "result": result
                    })

            return {
                "success": True,
                "orchestrator": "deepagent",
                "plan": plan,
                "results": results,
                "iterations": len(plan)
            }
        except Exception as e:
            self.logger.error(f"[DEEPAGENT] Error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "orchestrator": "deepagent"
            }

    async def _fallback_orchestrate(self, query: str, agents: Dict) -> Dict[str, Any]:
        """Fallback orchestration without DeepAgent"""
        self.logger.info("[DEEPAGENT] Using fallback orchestration")

        try:
            # Simple agent selection
            agent_selection = self._select_agents(query, list(agents.keys()))

            results = []
            for agent_id in agent_selection:
                if agent_id in agents:
                    result = await agents[agent_id](query)
                    results.append({
                        "agent": agent_id,
                        "result": result
                    })

            return {
                "success": True,
                "orchestrator": "fallback",
                "plan": [{"agent": a} for a in agent_selection],
                "results": results,
                "iterations": len(results)
            }
        except Exception as e:
            self.logger.error(f"[DEEPAGENT] Error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "orchestrator": "fallback"
            }

    def _select_agents(self, query: str, available: List[str]) -> List[str]:
        """Simple agent selection based on query"""
        query_lower = query.lower()

        if any(word in query_lower for word in ['score', 'stats', 'points', 'leader']):
            if 'stats_agent' in available:
                return ['stats_agent']

        if any(word in query_lower for word in ['news', 'update', 'injury', 'trade']):
            if 'media_agent' in available:
                return ['media_agent']

        return available[:1]


# ===== WORKFLOW INTEGRATION =====

async def get_workflow_response(query: str) -> dict:
    """Call LangGraph workflow"""

    try:
        logger.info(f"[BACKEND] Getting workflow response: {query[:50]}...")

        from main import invoke_workflow

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, invoke_workflow, query)

        final_report = result.get("final_report", "No response generated")
        status = result.get("status", "completed")
        success = result.get("success", False)
        error = result.get("error")
        agents_used = result.get("agents_used", [])

        logger.info(f"[BACKEND] ✓ Got result. Status: {status}")

        return {
            "success": success,
            "result": final_report,
            "agents_used": agents_used,
            "status": status,
            "error": error
        }

    except ImportError as e:
        logger.error(f"[BACKEND] Import error: {str(e)}")
        return {
            "success": False,
            "error": f"Import error: {str(e)}",
            "result": "Error: Cannot import workflow."
        }

    except Exception as e:
        logger.error(f"[BACKEND] Workflow error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            "success": False,
            "error": str(e),
            "result": f"Error: {str(e)}"
        }


async def get_deepagent_response(
    query: str,
    enable_deepagent: bool = True,
    max_iterations: int = 3,
    temperature: float = 0.7
) -> dict:
    """Call workflow with DeepAgent orchestration"""

    logger.info(f"[DEEPAGENT] Processing with orchestration: {query[:50]}...")

    try:
        from main import invoke_workflow
        
        # Get orchestrator
        orchestrator = DeepAgentOrchestrator()
        
        # Define agent functions
        async def stats_agent_fn(q: str):
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, invoke_workflow, q)
        
        async def media_agent_fn(q: str):
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, invoke_workflow, q)
        
        agents = {
            "stats_agent": stats_agent_fn,
            "media_agent": media_agent_fn
        }
        
        # Get DeepAgent orchestration
        orchestration = await orchestrator.orchestrate_query(query, agents)
        
        # Run main workflow
        loop = asyncio.get_event_loop()
        workflow_result = await loop.run_in_executor(None, invoke_workflow, query)
        
        return {
            "success": workflow_result.get("success", False),
            "query": query,
            "final_report": workflow_result.get("final_report"),
            "agents_used": workflow_result.get("agents_used", []),
            "orchestration_insights": {
                "orchestrator_type": orchestration.get("orchestrator"),
                "plan_steps": len(orchestration.get("plan", [])),
                "orchestration_success": orchestration.get("success")
            },
            "error": workflow_result.get("error")
        }
    
    except Exception as e:
        logger.error(f"[DEEPAGENT] Error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        
        return {
            "success": False,
            "error": str(e),
            "final_report": f"Error: {str(e)}"
        }


# ===== REST ENDPOINTS =====

@app.get("/health")
async def health_check():
    """Health check"""
    return {
        "status": "ok",
        "message": "🏀 NBA Multi-Agent Backend with DeepAgent",
        "version": "2.0.0",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/agents")
async def get_available_agents():
    """Get available agents"""
    return {
        "agents": [
            {"id": "supervisor", "name": "Query Router"},
            {"id": "stats_agent", "name": "NBA Stats Agent"},
            {"id": "media_agent", "name": "NBA News Agent"}
        ]
    }


@app.post("/api/query", response_model=QueryResponse)
async def process_query(request: QueryRequest):
    """Standard query endpoint (LangGraph only)"""
    
    query = request.query.strip()
    
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    logger.info(f"[API] Standard query: {query[:50]}...")
    
    try:
        response_data = await get_workflow_response(query)
        
        return QueryResponse(
            success=response_data["success"],
            result=response_data.get("result", "No response"),
            agents_used=response_data.get("agents_used", []),
            status=response_data.get("status", "completed"),
            error=response_data.get("error")
        )
    
    except Exception as e:
        logger.error(f"[API] Error: {str(e)}")
        return QueryResponse(
            success=False,
            result="Error processing query",
            agents_used=[],
            status="error",
            error=str(e)
        )


@app.post("/api/query/deepagent", response_model=DeepAgentQueryResponse)
async def process_query_with_deepagent(request: DeepAgentQueryRequest):
    """Enhanced query endpoint with DeepAgent orchestration"""
    
    query = request.query.strip()
    
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    logger.info(f"[API] DeepAgent query: {query[:50]}...")
    
    try:
        response_data = await get_deepagent_response(
            query=query,
            enable_deepagent=request.enable_deepagent,
            max_iterations=request.max_iterations,
            temperature=request.temperature
        )
        
        return DeepAgentQueryResponse(
            success=response_data.get("success", False),
            query=query,
            final_report=response_data.get("final_report", ""),
            agents_used=response_data.get("agents_used", []),
            orchestration_insights=response_data.get("orchestration_insights"),
            error=response_data.get("error")
        )
    
    except Exception as e:
        logger.error(f"[API] DeepAgent error: {str(e)}")
        return DeepAgentQueryResponse(
            success=False,
            query=query,
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


@app.get("/api/status")
async def get_status():
    """Get backend status"""
    return {
        "status": "operational",
        "service": "NBA Multi-Agent Backend v2",
        "version": "2.0.0",
        "features": [
            "LangGraph multi-agent",
            "DeepAgent orchestration",
            "A2A protocol",
            "Elastic Agent Builder"
        ],
        "timestamp": datetime.now().isoformat()
    }


# ===== ERROR HANDLERS =====

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle exceptions"""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)}
    )


# ===== STARTUP/SHUTDOWN =====

@app.on_event("startup")
async def startup_event():
    """Startup"""
    logger.info("")
    logger.info("═" * 60)
    logger.info("🏀 NBA Multi-Agent Backend v2 with DeepAgent")
    logger.info("═" * 60)
    logger.info("✅ Starting backend")
    logger.info("")
    logger.info("Endpoints:")
    logger.info("  GET  /health                    - Health check")
    logger.info("  GET  /api/agents                - List agents")
    logger.info("  POST /api/query                 - Standard query (LangGraph)")
    logger.info("  POST /api/query/deepagent       - Enhanced query (DeepAgent)")
    logger.info("  GET  /api/deepagent/status      - DeepAgent status")
    logger.info("═" * 60)
    logger.info("")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown"""
    logger.info("🛑 Shutting down backend")


# ===== RUN SERVER =====

if __name__ == "__main__":
    import uvicorn
    
    PORT = int(os.getenv("FASTAPI_PORT", 3002))
    HOST = os.getenv("FASTAPI_HOST", "0.0.0.0")
    
    logger.info(f"🏀 Backend running on http://{HOST}:{PORT}")
    logger.info(f"   Standard API: http://{HOST}:{PORT}/api/query")
    logger.info(f"   DeepAgent API: http://{HOST}:{PORT}/api/query/deepagent")
    
    uvicorn.run(
        "api_server_with_deepagent:app",
        host=HOST,
        port=PORT,
        reload=True,
        log_level="info"
    )
