#!/usr/bin/env bash
set -e

echo "Starting Azure Cosmos DB Linux Emulator container..."
docker run -d \
  --name cosmosdb-emulator \
  -p 8081:8081 \
  -p 10251-10254:10251-10254 \
  -m 3g --cpus=2.0 \
  -e AZURE_COSMOS_EMULATOR_PARTITION_COUNT=10 \
  -e AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true \
  mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest

echo "Waiting for Cosmos DB Emulator to become ready (this usually takes 1-2 minutes)..."
until curl -k -s https://localhost:8081/_explorer/emulator.pem > /dev/null; do
  echo "Still starting..."
  sleep 5
done

echo "Cosmos DB Emulator is UP and ready on https://localhost:8081!"
