"""
FINAL CORRECTED FastAPI Backend - REST Server for Multi-Agent NBA Chatbot
Integrates with Node.js server.js via REST API

FIXES:
- ✅ Properly handles invoke_workflow() from main.py
- ✅ Pydantic validation fixed (Optional[str] for error field)
- ✅ Full error handling and logging
- ✅ Production-ready

Usage:
    python api_server.py

The server listens on:
- HTTP REST API: http://localhost:3002
- Health check: http://localhost:3002/health

Node.js server.js (port 3001) calls this backend on port 3002
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
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
    title="NBA Multi-Agent FastAPI Backend",
    description="REST backend for multi-agent NBA analytics",
    version="1.0.0"
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


class QueryResponse(BaseModel):
    """Response model for query endpoint"""
    success: bool
    result: str
    agents_used: List[str] = []
    status: str = "completed"
    error: Optional[str] = None  # ✅ FIXED: Optional allows None


# ===== WORKFLOW INTEGRATION =====

async def get_workflow_response(query: str) -> dict:
    """
    Call your LangGraph workflow and get the response

    This integrates with your main.py invoke_workflow function
    """
    try:
        logger.info(f"[BACKEND] Getting workflow response for: {query[:50]}...")

        # Import here to avoid circular imports
        from main import invoke_workflow

        logger.info(f"[BACKEND] invoke_workflow imported successfully")

        # Run the workflow in executor (non-blocking)
        loop = asyncio.get_event_loop()
        logger.info(f"[BACKEND] Calling invoke_workflow...")

        result = await loop.run_in_executor(
            None,
            invoke_workflow,
            query  # Pass query as positional arg
        )

        logger.info(f"[BACKEND] invoke_workflow returned")
        logger.info(f"[BACKEND] Result keys: {list(result.keys()) if isinstance(result, dict) else 'not a dict'}")

        # Extract the final report
        final_report = result.get("final_report", "No response generated")
        status = result.get("status", "completed")
        success = result.get("success", False)
        error = result.get("error")  # Can be None
        agents_used = result.get("agents_used", [])

        logger.info(f"[BACKEND] ✓ Got result. Status: {status}, Success: {success}")

        return {
            "success": success,
            "result": final_report,
            "agents_used": agents_used,
            "status": status,
            "error": error  # Can be None
        }

    except ImportError as e:
        logger.error(f"[BACKEND] ❌ Import error: {str(e)}")
        logger.error(f"[BACKEND] Cannot import from main.py")
        logger.error(f"[BACKEND] Make sure you added invoke_workflow() to main.py!")

        return {
            "success": False,
            "error": f"Import error: {str(e)}",
            "result": "Error: Cannot import workflow. Did you add invoke_workflow() to main.py?",
            "agents_used": [],
            "status": "error"
        }

    except Exception as e:
        logger.error(f"[BACKEND] ❌ Workflow error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

        return {
            "success": False,
            "error": str(e),
            "result": f"Error processing your query: {str(e)}",
            "agents_used": [],
            "status": "error"
        }


# ===== REST ENDPOINTS =====

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "message": "🏀 NBA Multi-Agent FastAPI Backend Running",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/agents")
async def get_available_agents():
    """Get list of available agents"""
    return {
        "agents": [
            {
                "id": "supervisor",
                "name": "Query Router",
                "description": "Routes queries to appropriate agents based on query intent"
            },
            {
                "id": "stats_agent",
                "name": "NBA Stats Agent",
                "description": "Provides NBA statistics and player performance information"
            },
            {
                "id": "media_agent",
                "name": "NBA News Agent",
                "description": "Provides NBA news, media recommendations, and current events"
            }
        ]
    }


@app.post("/api/query", response_model=QueryResponse)
async def process_query(request: QueryRequest):
    """
    Process a query and return the response

    This endpoint:
    1. Receives a query from Node.js server.js
    2. Calls the LangGraph workflow
    3. Returns the result as a JSON response

    Called by: server.js (Node.js backend on port 3001)
    """

    query = request.query.strip()

    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    logger.info(f"[API] POST /api/query: {query[:50]}...")

    try:
        response_data = await get_workflow_response(query)

        logger.info(f"[API] ✓ Response received. Success: {response_data['success']}")

        # ✅ FIXED: Pass error as optional string or None
        return QueryResponse(
            success=response_data["success"],
            result=response_data.get("result", "No response"),
            agents_used=response_data.get("agents_used", []),
            status=response_data.get("status", "completed"),
            error=response_data.get("error")  # Can be None
        )

    except Exception as e:
        logger.error(f"[API] ❌ Exception: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

        return QueryResponse(
            success=False,
            result="Error processing your query.",
            agents_used=[],
            status="error",
            error=str(e)
        )


@app.get("/api/status")
async def get_status():
    """Get backend status and configuration"""
    return {
        "status": "operational",
        "service": "NBA Multi-Agent Backend",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "capabilities": {
            "multi_agent": True,
            "parallel_execution": True,
            "a2a_protocol": True
        }
    }


# ===== ERROR HANDLERS =====

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle unexpected exceptions"""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc)
        }
    )


# ===== STARTUP/SHUTDOWN =====

@app.on_event("startup")
async def startup_event():
    """Initialize on startup"""
    logger.info("")
    logger.info("═" * 60)
    logger.info("🏀 NBA Multi-Agent FastAPI Backend")
    logger.info("═" * 60)
    logger.info("✅ Starting NBA Multi-Agent Backend")
    logger.info("")
    logger.info("Available endpoints:")
    logger.info("  GET  /health              - Health check")
    logger.info("  GET  /api/agents          - List agents")
    logger.info("  GET  /api/status          - Backend status")
    logger.info("  POST /api/query           - Process query (REST)")
    logger.info("")
    logger.info("✅ Ready to receive requests from Node.js server.js")
    logger.info("═" * 60)
    logger.info("")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🛑 Shutting down NBA Multi-Agent Backend")


# ===== RUN SERVER =====

if __name__ == "__main__":
    import uvicorn

    PORT = int(os.getenv("FASTAPI_PORT", 3002))
    HOST = os.getenv("FASTAPI_HOST", "0.0.0.0")

    logger.info(f"🏀 FastAPI Backend running on http://{HOST}:{PORT}")
    logger.info(f"   REST API: http://{HOST}:{PORT}/api/query")
    logger.info(f"   Connected to: Node.js server.js (port 3001)")

    uvicorn.run(
        "api_server:app",
        host=HOST,
        port=PORT,
        reload=True,
        log_level="info"
    )
