FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.2.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build
RUN pnpm prune --prod

FROM node:22-alpine AS runtime

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=/data/clawmail.db

VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "dist/server/server/index.js"]
