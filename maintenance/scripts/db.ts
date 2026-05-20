import "dotenv/config";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "../..");

let db: any = null;

export async function getDb() {
  if (db) return db;

  const firebaseConfigPath = path.join(rootDir, "firebase-applet-config.json");
  let projectId: string | undefined;
  let firestoreDatabaseId: string | undefined;

  if (fs.existsSync(firebaseConfigPath)) {
    try {
      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
      projectId = firebaseConfig.projectId;
      firestoreDatabaseId = firebaseConfig.firestoreDatabaseId;
    } catch (e) {
      console.error("Error reading firebase-applet-config.json:", e);
    }
  }

  const apps = (admin as any).apps || (admin as any).default?.apps || [];
  if (apps.length === 0) {
    if ((admin as any).initializeApp) {
      if (projectId) {
        (admin as any).initializeApp({ projectId });
      } else {
        (admin as any).initializeApp();
      }
    } else if ((admin as any).default?.initializeApp) {
      if (projectId) {
        (admin as any).default.initializeApp({ projectId });
      } else {
        (admin as any).default.initializeApp();
      }
    }
  }

  db = firestoreDatabaseId ? getFirestore(firestoreDatabaseId) : getFirestore();
  return db;
}
