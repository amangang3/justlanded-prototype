# Microsoft's official Playwright Python image ships Python 3.12, the
# Playwright Python package, and Chromium (with all required system libs).
# Saves us from pinning ~30 apt packages by hand.
FROM mcr.microsoft.com/playwright/python:v1.48.0-jammy

WORKDIR /app

# Install project dependencies. We pip-install instead of using uv since the
# base image already has pip and we don't need uv's resolver speed in CI.
COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir -e .

# HF Spaces convention: listen on 7860. The PORT env var is injected by HF;
# keep a default so the image is also runnable locally.
ENV PORT=7860
EXPOSE 7860

CMD ["sh", "-c", "uvicorn src.server:app --host 0.0.0.0 --port ${PORT:-7860}"]
