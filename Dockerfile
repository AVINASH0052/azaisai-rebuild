FROM node:20-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY apps/worker/package.json ./
COPY apps/worker/src ./src
ENV PORT=8080
EXPOSE 8080
CMD ["node", "src/server.mjs"]
