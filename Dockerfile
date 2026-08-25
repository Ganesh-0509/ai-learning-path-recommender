# Single-container deployment for Hugging Face Spaces (Docker SDK) — see
# docs/DEPLOYMENT.md. Runs Ollama and the Next.js app together in one
# container, since HF Spaces host one container per Space (no Render-style
# multi-service networking to configure).

FROM node:20-slim AS base

# Ollama's official install script targets Debian/Ubuntu — node:20-slim is
# Debian-based, so this works without a separate base image for it. curl
# stays installed (not purged) — docker-entrypoint.sh uses it at runtime to
# poll Ollama's health before pulling the model. python3/make/g++ are only
# needed to compile better-sqlite3's native bindings during npm ci — purged
# afterward, since node:20-slim has no build toolchain by default.
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates zstd python3 make g++ \
    && curl -fsSL https://ollama.com/install.sh | sh \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# DATABASE_URL (not NODE_ENV — see below) must be set before the build:
# Next.js's build-time page-data collection imports lib/db.ts (via the API
# routes), which reads DATABASE_URL eagerly at module load.
ENV DATABASE_URL=file:/app/data/prod.db

# --- deps + build -----------------------------------------------------
# Deliberately NOT setting NODE_ENV=production yet: npm skips
# devDependencies when NODE_ENV=production, and the build needs several
# (tailwindcss/postcss, typescript) — it's set further down, after the
# build, so it only affects the runtime `npm run start`.
COPY package.json package-lock.json ./
RUN npm ci && apt-get purge -y python3 make g++ && apt-get autoremove -y

COPY . .
RUN npx prisma generate
# The data dir must exist before the build: Next's build-time page-data
# collection constructs the SQLite adapter (lib/db.ts), which needs the
# target directory to exist even though it doesn't connect until runtime.
RUN mkdir -p /app/data
RUN npm run build

# --- runtime --------------------------------------------------------
ENV NODE_ENV=production
ENV OLLAMA_HOST=0.0.0.0:11434
ENV LLM_HOST=http://localhost:11434
ENV LLM_MODEL=llama3.2:3b
ENV EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
# HF Spaces route traffic to this port by default (set via the Space's
# README frontmatter `app_port: 7860`, see docs/DEPLOYMENT.md).
ENV PORT=7860

EXPOSE 7860

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

CMD ["/app/docker-entrypoint.sh"]
