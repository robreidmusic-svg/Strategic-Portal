#!/bin/bash

# Configuration
JOB_NAME="strategic-portal-daily-maintenance"
SCHEDULE="0 6 * * *" # Every day at 6 AM
PROD_URL="https://ais-dev-csn5ykh4rjojgsf645y5vm-107198508797.europe-west3.run.app"
WEBHOOK_KEY=$(grep INGESTION_WEBHOOK_KEY .env | cut -d '=' -f2)

if [ -z "$WEBHOOK_KEY" ]; then
    echo "❌ Error: INGESTION_WEBHOOK_KEY not found in .env"
    exit 1
fi

echo "🤖 Setting up Google Cloud Scheduler..."
echo "Job: $JOB_NAME"
echo "Schedule: $SCHEDULE"

gcloud scheduler jobs create http $JOB_NAME \
    --schedule="$SCHEDULE" \
    --uri="$PROD_URL/api/maintenance/run" \
    --http-method=POST \
    --message-body="{\"key\": \"$WEBHOOK_KEY\", \"tasks\": [\"integrity\", \"cleanup-alerts\"]}" \
    --headers="Content-Type=application/json" \
    --location=europe-west3 \
    --attempt-deadline=30s

if [ $? -eq 0 ]; then
    echo "✅ Automation Setup Successfully! The Maintenance Agent will now run every morning."
else
    echo "⚠️ Setup failed. You may need to run 'gcloud auth login' or ensure the job doesn't already exist."
    echo "To update an existing job, use: gcloud scheduler jobs update http ..."
fi
