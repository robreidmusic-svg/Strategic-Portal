#!/bin/bash

# Configuration
PROD_URL="https://ais-dev-csn5ykh4rjojgsf645y5vm-107198508797.europe-west3.run.app"
WEBHOOK_KEY=$(grep INGESTION_WEBHOOK_KEY .env | cut -d '=' -f2)

echo "🚀 Triggering Production Maintenance Cycle..."
echo "URL: $PROD_URL/api/maintenance/run"

curl -X POST "$PROD_URL/api/maintenance/run" \
     -H "Content-Type: application/json" \
     -d "{
       \"key\": \"$WEBHOOK_KEY\",
       \"tasks\": [\"integrity\", \"cleanup-alerts\"]
     }"

echo -e "\n\n✅ Request Sent. Check the Strategic Portal 'Maintenance Banner' for results."
