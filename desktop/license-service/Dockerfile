# Build with desktop/ as the context. No web assets or desktop private state enter this image.
FROM node:24.19.0-bookworm-slim
WORKDIR /app
COPY --chown=node:node license-service/ ./license-service/
COPY --chown=node:node shared/ ./shared/
USER node
ENV NODE_ENV=production
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:8788/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "license-service/server.mjs"]
