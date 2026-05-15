FROM node:22-alpine AS deps

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN pnpm prisma:generate
RUN pnpm build
RUN pnpm prune --prod

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=build --chown=appuser:appgroup /app/package.json ./package.json
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/prisma ./prisma

RUN mkdir -p uploads/private && chown -R appuser:appgroup uploads

USER appuser
EXPOSE 5000

CMD ["node", "dist/src/server.js"]
