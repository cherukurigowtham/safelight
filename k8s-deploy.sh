#!/bin/bash

# Invesa Kubernetes Deployment Script
# This script applies the kustomization to the cluster.

echo "--- Starting Invesa Kubernetes Deployment ---"

# Check if kubectl is installed
if ! [ -x "$(command -v kubectl)" ]; then
  echo 'Error: kubectl is not installed.' >&2
  exit 1
fi

# Step 1: Apply the kustomization
echo "Step 1: Applying manifests to namespace 'invesa'..."
kubectl apply -k k8s/

# Step 2: Wait for database to be ready
echo "Step 2: Waiting for database to be ready..."
kubectl wait --for=condition=ready pod -l app=invesa-db -n invesa --timeout=60s

# Step 3: Rolling restart of services to ensure they pick up any new secrets/configs
echo "Step 3: Ensuring services are up to date..."
kubectl rollout restart deployment/invesa-api -n invesa
kubectl rollout restart deployment/invesa-frontend -n invesa

echo "--- Deployment Applied ---"
echo "Check pods status: kubectl get pods -n invesa"
echo "Check services status: kubectl get svc -n invesa"
echo "Wait for pods to be 'Running' before accessing the app."
