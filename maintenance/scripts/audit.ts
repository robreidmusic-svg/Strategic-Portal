import { getDb } from "./db";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logDir = path.join(__dirname, "../logs");

async function sendEmailAlert(subject: string, body: string) {
  console.log("📧 [STUB] Sending Email Alert:", subject);
  // In a real implementation, use nodemailer or a mail API here.
  // Requires credentials in .env
}

async function createPortalAlert(db: any, severity: "warning" | "critical", message: string) {
  console.log(`🚩 Creating Portal Alert (${severity}): ${message}`);
  await db.collection("maintenance_alerts").add({
    severity,
    message,
    timestamp: Date.now(),
    resolved: false
  });
}

async function checkApiHealth() {
  const port = process.env.PORT || 3000;
  const url = `http://localhost:${port}/api/health`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { status: "ok", url };
  } catch (e: any) {
    return { status: "error", message: e.message, url };
  }
}

async function runAudit() {
  console.log("🚀 Starting System Audit...");
  const db = await getDb();
  const log: any = {
    timestamp: new Date().toISOString(),
    checks: {}
  };

  // 1. API Health
  const apiHealth = await checkApiHealth();
  log.checks.api = apiHealth;
  if (apiHealth.status !== "ok") {
    await createPortalAlert(db, "critical", `API Health Check Failed: ${apiHealth.message}`);
    await sendEmailAlert("CRITICAL: Strategic Portal API Offline", `The API health check at ${apiHealth.url} failed with: ${apiHealth.message}`);
  }

  // 2. Ingestion Check
  const ingestionLogs = await db.collection("ingestion_logs").orderBy("timestamp", "desc").limit(5).get();
  const recentErrors = ingestionLogs.docs.filter((d: any) => d.data().status === "error");
  log.checks.ingestion = { recentErrors: recentErrors.length };
  if (recentErrors.length > 2) {
    await createPortalAlert(db, "warning", "Multiple recent ingestion errors detected.");
  }

  // Write Log
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, `audit-${new Date().toISOString().split("T")[0]}.json`);
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));

  console.log("🏁 Audit Cycle Complete.");
}

runAudit();
