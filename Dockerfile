# syntax=docker/dockerfile:1
FROM node:20-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

# No apt packages at all: the PDF font ships in-repo at
# backend/fonts/DejaVuSans.ttf (export_import prefers it over the system
# font) and every pip dependency publishes prebuilt manylinux wheels for
# this image (verified via pip download --only-binary=:all: for cp311 /
# manylinux2014_x86_64 — including all transitives). The old apt line
# (gcc toolchain, then fonts) only ever stalled builds on slow mirrors.

COPY requirements.txt .
# cache mount: interrupted builds resume from already-fetched wheels
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-build /frontend/dist ./frontend/dist/

RUN mkdir -p /app/entries /app/data

EXPOSE 8501

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8501/api/health')" || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8501"]
