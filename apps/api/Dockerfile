FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package configurations and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies filtering out mobile app
RUN pnpm install --frozen-lockfile --filter @aegis/api...

# Copy codebase
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build both shared and api packages
RUN pnpm --filter @aegis/shared build
RUN pnpm --filter @aegis/api build

# Final image
FROM node:22-alpine AS runner

WORKDIR /app

# Install pnpm globally in runner
RUN npm install -g pnpm

# Set correct ownership for non-root running
RUN chown -R node:node /app

# Copy output from builder stage
COPY --chown=node:node --from=builder /app /app

# Set non-root user
USER node

# Expose API port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Start app using tsx via pnpm to resolve workspace ESM modules smoothly
CMD ["pnpm", "--filter", "@aegis/api", "exec", "tsx", "dist/index.js"]
