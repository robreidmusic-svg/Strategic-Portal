import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

async function listModels() {
  const genAI = new GoogleGenAI({ apiKey: process.env.CUSTOM_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "" });
  try {
    const models = await (genAI as any).models.list();
    console.log("Available Models:", JSON.stringify(models, null, 2));
  } catch (e: any) {
    console.error("Failed to list models:", e.message);
  }
}

listModels();
