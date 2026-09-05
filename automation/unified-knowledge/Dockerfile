FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY knowledge_sync_worker.py .
COPY sheets_connector.py .
COPY github_webhook_handler.py .
COPY the_world_god_unified_orchestrator.py .
COPY webhook-server.py .

# Create non-root user
RUN useradd -m -u 1000 webhook && \
    mkdir -p /var/log/unified-knowledge && \
    chown -R webhook:webhook /var/log/unified-knowledge /app

USER webhook

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run webhook server
EXPOSE 8000
CMD ["python3", "webhook-server.py"]
