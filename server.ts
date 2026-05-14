import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import * as admin from "firebase-admin";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.CUSTOM_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: any = null;
const KNOWLEDGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let knowledgeCache: { data: any, timestamp: number } | null = null;

async function startServer() {
  console.log("Starting server function called...");

  // Initialize Firebase Admin safely
  const apps = (admin as any).apps || (admin as any).default?.apps || [];
  if (apps.length === 0) {
    try {
      if ((admin as any).initializeApp) {
        admin.initializeApp();
      } else if ((admin as any).default?.initializeApp) {
        (admin as any).default.initializeApp();
      }
      console.log("Firebase Admin initialized.");
    } catch (e) {
      console.warn("Firebase Admin init failed, trying config file...");
      try {
        const firebaseConfigPath = path.join(__dirname, "firebase-applet-config.json");
        if (fs.existsSync(firebaseConfigPath)) {
          const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
          const initApp = (admin as any).initializeApp || (admin as any).default?.initializeApp;
          if (initApp) {
            initApp({
              projectId: firebaseConfig.projectId,
            });
            console.log("Firebase Admin initialized with config file.");
          }
        }
      } catch (innerError) {
        console.error("Critical: Could not initialize Firebase Admin:", innerError);
      }
    }
  }

  // Target the specific database if possible
  try {
    const { getFirestore } = await import("firebase-admin/firestore");
    const firebaseConfigPath = path.join(__dirname, "firebase-applet-config.json");

    if (fs.existsSync(firebaseConfigPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
      if (firebaseConfig.firestoreDatabaseId) {
        db = getFirestore(firebaseConfig.firestoreDatabaseId);
        console.log(`Targeting database: ${firebaseConfig.firestoreDatabaseId}`);
      } else {
        db = getFirestore();
      }
    } else {
      db = getFirestore();
    }
  } catch (e) {
    console.error("Failed to initialize Firestore:", e);
  }

  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '10mb' }));

  console.log("Setting up API routes...");
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", firebase: !!db });
  });

  app.get("/api/health-check", async (req, res) => {
    try {
      // Minimal connectivity test using the production-aliased model
      const testResponse = await (ai as any).models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: "hi" }] }]
      });

      res.json({
        status: "ok",
        gemini: "online",
        firebase: !!db ? "connected" : "offline",
        config: {
          geminiKey: !!(process.env.CUSTOM_GEMINI_API_KEY || process.env.GEMINI_API_KEY),
          ingestionKey: !!process.env.INGESTION_WEBHOOK_KEY
        }
      });
    } catch (e: any) {
      console.error("[Health Check] Connectivity failure:", e.message);
      res.status(500).json({
        status: "error",
        gemini: "offline",
        error: e.message,
        code: e.status || 500
      });
    }
  });

  // API Route for Configuration Status
  app.get("/api/config-status", (req, res) => {
    res.json({
      ingestionKeySet: !!process.env.INGESTION_WEBHOOK_KEY,
      geminiKeySet: !!(process.env.CUSTOM_GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      firebaseInitialized: !!db
    });
  });

  app.post("/api/gemini/generateContent", async (req, res) => {
    try {
      console.log("[Gemini Proxy] Generating content...");
      const result = await (ai as any).models.generateContent(req.body);
      const text = result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || "";

      console.log(`[Gemini Proxy] Success. Text length: ${text?.length || 0}`);
      res.json({ text });
    } catch (error: any) {
      const errorMsg = error.message || "Unknown error";
      const isAuthError = errorMsg.includes("API key not valid") || errorMsg.includes("API_KEY_INVALID");

      console.error("[Gemini Proxy] CRITICAL FAILURE:", {
        type: isAuthError ? "AUTH_ERROR" : "API_ERROR",
        message: errorMsg,
        status: error.status,
        data: error.error || error.response?.data
      });

      res.status(error.status || 500).json({
        error: isAuthError ? "Broggo is Offline (Authentication Failure)" : "Gemini API Error",
        details: errorMsg,
        isAuthError
      });
    }
  });

  app.post("/api/gemini/createInteraction", async (req, res) => {
    try {
      console.log("[Gemini Proxy] Creating interaction (Deep Research)...");
      const result = await (ai as any).interactions.create(req.body);

      // Extract text from interaction outputs
      let text = "";
      if (result.outputs) {
        text = result.outputs.map((o: any) => o.parts?.map((p: any) => p.text).join('')).join('\n');
      }

      console.log(`[Gemini Proxy] Interaction success. Text length: ${text?.length || 0}`);
      res.json({ ...result, text });
    } catch (error: any) {
      console.error("[Gemini Proxy] Interaction Failure:", error.message);
      res.status(error.status || 500).json({
        error: "Gemini Interaction Error",
        details: error.message
      });
    }
  });

  // Daily Scan: triggers Broggo to scan intelligence sources and create a proposal card
  // Callable manually from AdminPanel or via external cron (POST /api/daily-scan)
  app.post("/api/daily-scan", async (req, res) => {
    const { key } = req.body;
    const webhookKey = process.env.INGESTION_WEBHOOK_KEY;
    // Allow internal calls (no key check) OR external cron calls with matching key
    if (webhookKey && key && key !== webhookKey) {
      return res.status(401).json({ error: "Unauthorised" });
    }
    try {
      // Import lazily so server boot is not blocked
      const { runDailyScan } = await import("./src/services/ai/dailyScan.js");
      const result = await runDailyScan();
      console.log("[Daily Scan]", result.message);
      res.json(result);
    } catch (e: any) {
      console.error("[Daily Scan] Server error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Maintenance Route: Allows the agent to trigger audits and fixes via the server's Admin SDK
  app.post("/api/maintenance/run", async (req, res) => {
    const { key, tasks } = req.body;
    const webhookKey = process.env.INGESTION_WEBHOOK_KEY;
    
    if (webhookKey && key && key !== webhookKey) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const results: any = {};
      const auditLog: any = {
        timestamp: Date.now(),
        tasks: tasks,
        details: []
      };
      
      if (tasks.includes("integrity")) {
        console.log("[Maintenance] Running Integrity Audit...");
        const snapshot = await db.collection("opportunities").get();
        let fixCount = 0;
        for (const doc of snapshot.docs) {
          const data = doc.data();
          const updates: any = {};
          if (!data.stage) updates.stage = "Lead";
          if (data.mrc === undefined) updates.mrc = 0;
          if (Object.keys(updates).length > 0) {
            await doc.ref.update(updates);
            fixCount++;
          }
        }
        results.integrity = { status: "ok", fixed: fixCount };
        auditLog.details.push({ task: "integrity", fixed: fixCount });
      }

      if (tasks.includes("cleanup-alerts")) {
        console.log("[Maintenance] Cleaning up old alerts...");
        const alerts = await db.collection("maintenance_alerts").where("resolved", "==", true).get();
        const batch = db.batch();
        alerts.docs.forEach((d: any) => batch.delete(d.ref));
        await batch.commit();
        results.cleanup = { status: "ok", deleted: alerts.size };
        auditLog.details.push({ task: "cleanup-alerts", deleted: alerts.size });
      }

      // Record in permanent system logs
      await db.collection("system_logs").add({
        ...auditLog,
        type: "maintenance_audit",
        status: "success"
      });

      res.json({ status: "ok", results });
    } catch (e: any) {
      console.error("[Maintenance] Error:", e);
      if (db) {
        await db.collection("system_logs").add({
          timestamp: Date.now(),
          type: "maintenance_audit",
          status: "failure",
          error: e.message
        });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/ingestion-diagnostics", async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: "DB not initialized" });
      const snapshot = await db.collection("pending_emails").get();
      const logsSnapshot = await db.collection("ingestion_logs").orderBy("timestamp", "desc").limit(20).get();

      res.json({
        pendingCount: snapshot.size,
        items: snapshot.docs.map((d: any) => ({
          id: d.id,
          subject: d.data().subject,
          timestamp: d.data().timestamp
        })),
        logs: logsSnapshot.docs.map((d: any) => ({
          id: d.id,
          ...d.data()
        }))
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Broggo 2.0: Mirror knowledge nodes as .md files
  const knowledgeDir = path.join(__dirname, 'knowledge');

  app.post("/api/mirror-knowledge", (req, res) => {
    try {
      const { filename, content, nodeId } = req.body;
      if (!filename || !content) {
        return res.status(400).json({ error: "Missing filename or content" });
      }

      // Ensure knowledge directory exists
      if (!fs.existsSync(knowledgeDir)) {
        fs.mkdirSync(knowledgeDir, { recursive: true });
      }

      const filePath = path.join(knowledgeDir, filename);
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`[Mirror] 📄 Written: ${filename} (${content.length} chars)`);

      res.json({ status: "ok", path: filePath });
    } catch (e: any) {
      console.error("[Mirror] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/export-knowledge", (req, res) => {
    try {
      if (!fs.existsSync(knowledgeDir)) {
        return res.json({ files: [], count: 0 });
      }

      const files = fs.readdirSync(knowledgeDir)
        .filter(f => f.endsWith('.md'))
        .map(f => ({
          filename: f,
          size: fs.statSync(path.join(knowledgeDir, f)).size,
          modified: fs.statSync(path.join(knowledgeDir, f)).mtime.toISOString(),
        }));

      res.json({ files, count: files.length, path: knowledgeDir });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/knowledge/:filename", (req, res) => {
    try {
      const filePath = path.join(knowledgeDir, req.params.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }
      res.type('text/markdown').send(fs.readFileSync(filePath, 'utf-8'));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── BROGGO 2.0: Admin-bypass write for knowledge nodes ──
  // The client-side Firebase SDK is blocked by Firestore rules.
  // These routes use the Admin SDK which bypasses all rules.
  app.post("/api/knowledge-nodes/write", async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: "DB not initialized" });
      const nodeData = req.body;
      if (!nodeData || !nodeData.title) {
        return res.status(400).json({ error: "Invalid node data" });
      }
      const docRef = await db.collection("knowledge_nodes").add(nodeData);
      console.log(`[Admin Write] Knowledge node saved: ${docRef.id} — "${nodeData.title}"`);
      
      // Invalidate cache on write
      knowledgeCache = null;
      
      res.json({ status: "ok", id: docRef.id });
    } catch (e: any) {
      console.error("[Admin Write] Error saving knowledge node:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/knowledge-nodes", async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: "DB not initialized" });
      
      // Check cache
      if (knowledgeCache && (Date.now() - knowledgeCache.timestamp) < KNOWLEDGE_CACHE_TTL) {
        console.log("[Cache] ⚡ Serving knowledge nodes from memory");
        return res.json({ nodes: knowledgeCache.data });
      }

      console.log("[Cache] ☁️ Fetching knowledge nodes from Firestore");
      const snapshot = await db.collection("knowledge_nodes").orderBy("updatedAt", "desc").get();
      const nodes = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      
      // Update cache
      knowledgeCache = { data: nodes, timestamp: Date.now() };
      
      res.json({ nodes });
    } catch (e: any) {
      // Fallback without ordering
      try {
        const snapshot = await db.collection("knowledge_nodes").get();
        const nodes = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        res.json({ nodes });
      } catch (innerE: any) {
        res.status(500).json({ error: innerE.message });
      }
    }
  });

  app.post("/api/ingest-email", async (req, res) => {
    const { key, subject, body, from, date } = req.body;
    const logData = {
      timestamp: Date.now(),
      from: from || "unknown",
      subject: subject || "no subject",
      status: "received",
      message: ""
    };

    const webhookKey = process.env.INGESTION_WEBHOOK_KEY;
    if (!webhookKey || key !== webhookKey) {
      if (db) {
        await db.collection("ingestion_logs").add({ ...logData, status: "error", message: "Invalid or missing webhook key" });
      }
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      if (!db) {
        throw new Error("Firestore Admin SDK not initialized");
      }
      // Save raw email for frontend processing
      await db.collection("pending_emails").add({
        subject,
        body,
        from,
        date,
        timestamp: Date.now()
      });

      await db.collection("ingestion_logs").add({ ...logData, status: "success", message: "Email queued successfully" });
      res.json({ status: "ok", message: "Email received and queued for intelligence extraction" });
    } catch (error: any) {
      console.error("Ingestion Error:", error);
      if (db) {
        await db.collection("ingestion_logs").add({ ...logData, status: "error", message: error.message });
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Vite middleware for development
  const distPath = path.join(__dirname, "dist");
  const isDev = process.env.NODE_ENV !== "production" && !fs.existsSync(path.join(distPath, "index.html"));

  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  console.log(`Attempting to listen on 0.0.0.0:${PORT}...`);
  const startListening = (port: number | string) => {
    const server = app.listen(port as number, "0.0.0.0", () => {
      console.log(`SUCCESS: Server running on http://localhost:${port}`);
    });

    server.on('error', (e: any) => {
      if (e.code === 'EADDRINUSE') {
        console.error(`Port ${port} is in use, trying ${Number(port) + 1}...`);
        setTimeout(() => {
          startListening(Number(port) + 1);
        }, 1000);
      } else {
        console.error("Server error:", e);
      }
    });
  };
  startListening(PORT);
}

startServer();
