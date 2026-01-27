#!/bin/bash

# Invesa Deployment Script
# This script builds and starts the application in production mode.

echo "--- Starting Invesa Deployment ---"

# Check if docker compose or docker-compose is installed
DOCKER_COMPOSE_CMD=""
if docker compose version > /dev/null 2>&1; then
  DOCKER_COMPOSE_CMD="docker compose"
elif docker-compose version > /dev/null 2>&1; then
  DOCKER_COMPOSE_CMD="docker-compose"
else
  echo 'Error: docker compose or docker-compose is not installed.' >&2
  exit 1
fi

# Build and start services
echo "Step 1: Building containers..."
$DOCKER_COMPOSE_CMD build

echo "Step 2: Starting services in detached mode..."
$DOCKER_COMPOSE_CMD up -d

echo "Step 3: Checking health status..."
sleep 5 # wait for services to start

# Check API health
HEALTH=$(curl -s http://localhost:3001/healthz)
if [[ $HEALTH == *"ok"* ]]; then
  echo "SUCCESS: API is healthy and database is connected."
else
  echo "WARNING: API health check failed. Review logs with 'docker-compose logs api'."
fi

echo "--- Deployment Complete ---"
echo "Frontend: http://localhost:3000"
echo "API Docs: http://localhost:3001/api-docs"
