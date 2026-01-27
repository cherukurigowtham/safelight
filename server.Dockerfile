# Production-ready backend with Postgres DB (server api)
FROM node:20-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev
COPY server/ .
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "index.js"]
