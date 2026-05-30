FROM node:22-bookworm-slim

# Install Python + MkDocs for TechDocs local generation
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      build-essential \
      git \
      curl && \
    pip3 install mkdocs-techdocs-core --break-system-packages && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests and lockfile for dependency install
# Root package.json is required for yarn workspaces to resolve all packages
COPY package.json ./
COPY packages/backend/dist/skeleton.tar.gz skeleton.tar.gz
RUN tar xzf skeleton.tar.gz && rm skeleton.tar.gz
COPY yarn.lock ./

# Install production dependencies inside the image
RUN yarn install --frozen-lockfile --production --network-timeout 300000 && \
    yarn cache clean

ENV NODE_ENV=production

# Extract the full backend bundle on top of the installed node_modules
COPY packages/backend/dist/bundle.tar.gz /tmp/bundle.tar.gz
RUN tar xzf /tmp/bundle.tar.gz && rm /tmp/bundle.tar.gz

# Copy Backstage config files
COPY app-config.yaml ./
COPY app-config.docker.yaml ./
COPY app-config.k8s.yaml ./

# node:22-bookworm-slim already ships with uid/gid 1000 as 'node' user
RUN chown -R node:node /app
USER node

EXPOSE 7007

CMD ["node", "packages/backend", "--config", "app-config.yaml", "--config", "app-config.docker.yaml"]
