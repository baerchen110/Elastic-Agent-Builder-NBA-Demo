# =============================================================================
# Data Ingestion (Python) Dockerfile
# =============================================================================

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy ingestion scripts
COPY *.py ./
COPY enhanced ./enhanced

# Create non-root user
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app

USER appuser

# Health check - just verify Python is running
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD python -c "print('Data ingestion container healthy')" || exit 1

# Default command keeps container running for manual script execution
CMD ["/bin/bash", "-c", "echo 'Data ingestion container ready. Use docker exec to run scripts.' && tail -f /dev/null"]
