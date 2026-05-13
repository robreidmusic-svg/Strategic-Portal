# Strategic Portal: Maintenance Protocol

This document defines the operating procedures for the **Maintenance Agent**. Its mission is to ensure 24/7 stability of the Strategic Portal.

## 1. Recurring Audit Cycle
The agent should perform a "System Audit" every 24 hours (or upon session start).

### Checklist:
- [ ] **API Connectivity**: Ping `/api/health`.
- [ ] **Data Integrity**: Run `maintenance/scripts/integrity.ts` to find/fix orphans or malformed documents.
- [ ] **Ingestion Health**: Verify no emails have been "received" but not "processed" for > 12 hours.
- [ ] **Security Drift**: Ensure `firestore.rules` matches the baseline.

## 2. Auto-Fix Guidelines
The agent is authorized to perform the following "Safe Fixes":
- **Data Normalization**: Adding missing timestamps or default "N/A" values to required fields.
- **Cache Invalidation**: Deleting `node_modules/.vite` if UI rendering errors are detected.
- **Sync**: Mirroring Firestore `knowledge_nodes` to local `.md` files if they are missing.

## 3. Escalation & Alerting
If a "Critical Failure" is detected and cannot be auto-fixed:
1.  **Portal Flag**: Create a document in `maintenance_alerts` with `severity: "critical"`.
2.  **Email Alert**: Attempt to send a summary to the administrator.
3.  **Logs**: Write a detailed failure trace to `maintenance/logs/`.

## 4. Maintenance Logs
Every audit should result in a log entry in `maintenance/logs/audit-YYYY-MM-DD.json`.
