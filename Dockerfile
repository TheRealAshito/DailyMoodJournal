FROM node:20-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

# Runtime deps: only fonts for PDF export (DejaVuSans via fpdf2). No C
# toolchain on purpose — every pip dependency ships prebuilt manylinux
# wheels for this image, so gcc/binutils/cpp (~150MB of apt downloads) are
# pure dead weight and a build-stall risk on slow mirrors. If a future
# dependency ever needs compiling from source, re-add `gcc` here.
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-build /frontend/dist ./frontend/dist/

RUN mkdir -p /app/entries /app/data

EXPOSE 8501

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8501/api/health')" || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8501"]
