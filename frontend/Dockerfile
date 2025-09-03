# Build stage
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
# Use cache mounts to speed up installs
RUN --mount=type=cache,target=/root/.npm \
	--mount=type=cache,target=/root/.cache/yarn \
	if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
	elif [ -f pnpm-lock.yaml ]; then npm i -g pnpm && pnpm i --frozen-lockfile; \
	else npm ci || npm install; fi

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY . .
RUN --mount=type=cache,target=/root/.npm npm run build || ( [ -f yarn.lock ] && yarn build ) || ( [ -f pnpm-lock.yaml ] && pnpm build )

# Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
