// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import * as admin from "firebase-admin";
import fs from "fs";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var db = null;
async function startServer() {
  console.log("Starting server function called...");
  const apps2 = admin.apps || admin.default?.apps || [];
  if (apps2.length === 0) {
    try {
      if (admin.initializeApp) {
        admin.initializeApp();
      } else if (admin.default?.initializeApp) {
        admin.default.initializeApp();
      }
      console.log("Firebase Admin initialized.");
    } catch (e) {
      console.warn("Firebase Admin init failed, trying config file...");
      try {
        const firebaseConfigPath = path.join(__dirname, "firebase-applet-config.json");
        if (fs.existsSync(firebaseConfigPath)) {
          const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
          const initApp = admin.initializeApp || admin.default?.initializeApp;
          if (initApp) {
            initApp({
              projectId: firebaseConfig.projectId
            });
            console.log("Firebase Admin initialized with config file.");
          }
        }
      } catch (innerError) {
        console.error("Critical: Could not initialize Firebase Admin:", innerError);
      }
    }
  }
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
  const PORT = 3e3;
  app.use(express.json({ limit: "10mb" }));
  console.log("Setting up API routes...");
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", firebase: !!db });
  });
  app.get("/api/config-status", (req, res) => {
    res.json({
      ingestionKeySet: !!process.env.INGESTION_WEBHOOK_KEY,
      geminiKeySet: !!(process.env.CUSTOM_GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      firebaseInitialized: !!db
    });
  });
  app.get("/api/ingestion-diagnostics", async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: "DB not initialized" });
      const snapshot = await db.collection("pending_emails").get();
      const logsSnapshot = await db.collection("ingestion_logs").orderBy("timestamp", "desc").limit(20).get();
      res.json({
        pendingCount: snapshot.size,
        items: snapshot.docs.map((d) => ({
          id: d.id,
          subject: d.data().subject,
          timestamp: d.data().timestamp
        })),
        logs: logsSnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }))
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
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
      await db.collection("pending_emails").add({
        subject,
        body,
        from,
        date,
        timestamp: Date.now()
      });
      await db.collection("ingestion_logs").add({ ...logData, status: "success", message: "Email queued successfully" });
      res.json({ status: "ok", message: "Email received and queued for intelligence extraction" });
    } catch (error) {
      console.error("Ingestion Error:", error);
      if (db) {
        await db.collection("ingestion_logs").add({ ...logData, status: "error", message: error.message });
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  console.log(`Attempting to listen on 0.0.0.0:${PORT}...`);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SUCCESS: Server running on http://localhost:${PORT}`);
  });
}
startServer();
