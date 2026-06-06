FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
ENV PNPM_ENABLE_POLICIES=false
RUN pnpm install --frozen-lockfile --ignore-scripts && \
    pnpm rebuild

FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime
RUN apk add --no-cache python3 py3-pip graphviz && \
    python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir nbformat>=5.10 plotly>=6.0 graphviz>=0.20
ENV PATH="/opt/venv/bin:$PATH"
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/content ./content
COPY --from=build /app/scripts ./scripts
EXPOSE 3000
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
CMD ["node", "server.js"]
