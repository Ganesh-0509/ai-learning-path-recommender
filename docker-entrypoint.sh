#!/bin/sh
set -e

mkdir -p /app/data

# Start Ollama in the background, wait for it to accept connections, pull
# the model if it isn't already cached (first boot only — subsequent boots
# on the same container skip this if HF's persistent storage add-on is in
# use; otherwise every restart re-downloads it, see docs/DEPLOYMENT.md).
ollama serve &
OLLAMA_PID=$!

echo "Waiting for Ollama to start..."
until curl -sf http://localhost:11434/api/version > /dev/null; do
  sleep 1
done

if ! ollama list | grep -q "${LLM_MODEL}"; then
  echo "Pulling ${LLM_MODEL}..."
  ollama pull "${LLM_MODEL}"
fi

# Apply migrations and seed the course catalog (fast, no LLM/embedding
# calls — reads the committed data/courses.seed.json) before serving.
npx prisma migrate deploy
npm run seed

npm run start &
APP_PID=$!

trap 'kill $OLLAMA_PID $APP_PID 2>/dev/null' TERM INT
wait $APP_PID
