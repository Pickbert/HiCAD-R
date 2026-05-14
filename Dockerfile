FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    FRONTEND_DIR=/app/frontend/dist \
    DATA_DIR=/app/data
RUN corepack enable
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/frontend/dist ./frontend/dist
RUN pnpm install --prod --frozen-lockfile
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["pnpm", "--filter", "@hicad/backend", "start"]
