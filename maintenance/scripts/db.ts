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

  const apps = (admin as any).apps || (admin as any).default?.apps || [];
  if (apps.length === 0) {
    try {
      if ((admin as any).initializeApp) {
        admin.initializeApp();
      } else if ((admin as any).default?.initializeApp) {
        (admin as any).default.initializeApp();
      }
    } catch (e) {
      const firebaseConfigPath = path.join(rootDir, "firebase-applet-config.json");
      if (fs.existsSync(firebaseConfigPath)) {
        const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
        const initApp = (admin as any).initializeApp || (admin as any).default?.initializeApp;
        if (initApp) {
          initApp({ projectId: firebaseConfig.projectId });
        }
      }
    }
  }

  const firebaseConfigPath = path.join(rootDir, "firebase-applet-config.json");
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    db = firebaseConfig.firestoreDatabaseId ? getFirestore(firebaseConfig.firestoreDatabaseId) : getFirestore();
  } else {
    db = getFirestore();
  }

  return db;
}
