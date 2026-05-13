import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  orderBy, 
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { generateEmbedding } from './ai/client';
import { generateSynthesisRationale } from './geminiService';
import { normaliseToMarkdown, nodeToFilename } from './markdownEngine';

// ═══════════════════════════════════════════════════════════════
// BROGGO 2.0 — UNIVERSAL KNOWLEDGE NODE SCHEMA
// ═══════════════════════════════════════════════════════════════

export const NODE_TYPES = ['operator', 'infrastructure', 'market', 'regulatory', 'commercial'] as const;
export type NodeType = typeof NODE_TYPES[number];

export const TAXONOMY: Record<NodeType, string[]> = {
  operator: ['Tier 1 Carrier', 'Tier 2 / Regional', 'Hyperscaler', 'Neocloud / AI Infra', 'Data Centre Operator'],
  infrastructure: ['Dark Fibre & Wavelengths', 'Subsea Cables', 'Data Centres & Colocation', 'IX & Peering', 'Edge & Access', 'Power & Cooling'],
  market: ['Competitive Landscape', 'M&A Activity', 'Investment & Funding', 'Industry Trends', 'Technology Evolution'],
  regulatory: ['EU Policy', 'National Regulation', 'Spectrum & Licensing', 'Environmental & Planning'],
  commercial: ['Pricing & Contracts', 'Customer Intelligence', 'Retention & Churn', 'Go-to-Market Strategy'],
};

export const ALL_CATEGORIES = Object.values(TAXONOMY).flat();

export interface KnowledgeNode {
  id: string;
  title: string;
  type: NodeType;
  category: string;
  tags: string[];
  summary: string;
  body: string;
  source: string;
  sourceType: 'url' | 'pdf' | 'doc' | 'csv' | 'text' | 'email';
  confidence: 'verified' | 'inferred' | 'unverified';
  createdAt: number;
  updatedAt: number;
  embedding: number[];
  connections: string[];
  synthesisMap: Record<string, string>;
}

const COLLECTION_NAME = 'knowledge_nodes';

// Legacy collection names — used only during migration
const LEGACY_INSIGHTS = 'research_insights';
const LEGACY_OPERATORS = 'network_operators';

// ═══════════════════════════════════════════════════════════════
// CORE CRUD
// ═══════════════════════════════════════════════════════════════

function cosineSimilarity(a: number[], b: number[]) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (magA * magB);
}

/** Fetch all knowledge nodes, sorted by most recent */
export async function getKnowledgeNodes(): Promise<KnowledgeNode[]> {
  try {
    // Fetch without ordering to bypass missing index issues
    const q = query(collection(db, COLLECTION_NAME));
    const snapshot = await getDocs(q);
    const nodes = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as KnowledgeNode[];
    
    // Sort client-side
    nodes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    console.log(`[Broggo 2.0] Fetched ${nodes.length} knowledge nodes.`);
    return nodes;
  } catch (error: any) {
    console.error('[Broggo 2.0] Error fetching knowledge nodes:', error);
    return [];
  }
}

/** 
 * Search the knowledge base using semantic similarity.
 * Returns the top N nodes most similar to the query text.
 */
export async function searchKnowledgeBase(queryText: string, topN = 5): Promise<KnowledgeNode[]> {
  try {
    const queryEmbedding = await generateEmbedding(queryText);
    if (!queryEmbedding || queryEmbedding.length === 0) return [];

    const allNodes = await getKnowledgeNodes();
    return allNodes
      .filter(n => n.embedding && n.embedding.length > 0)
      .map(n => ({ node: n, score: cosineSimilarity(queryEmbedding, n.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map(r => r.node);
  } catch (error) {
    console.error('[Broggo 2.0] Search error:', error);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// THE INGESTION PIPELINE (Steps 3–6 from the Blueprint)
// Steps 1–2 (Parse & Normalise) happen in marketResearch.ts
// ═══════════════════════════════════════════════════════════════

interface RawNodeInput {
  title: string;
  type: NodeType;
  category: string;
  tags: string[];
  summary: string;
  body: string;
  source: string;
  sourceType: 'url' | 'pdf' | 'doc' | 'csv' | 'text' | 'email';
  confidence?: 'verified' | 'inferred' | 'unverified';
}

/**
 * The deterministic ingestion pipeline.
 * Takes a normalised input, embeds it, links it, stores it, and synthesises rationales.
 * Returns the saved KnowledgeNode or null if validation fails.
 */
export async function ingestKnowledgeNode(input: RawNodeInput): Promise<KnowledgeNode | null> {
  const now = Date.now();

  // ── VALIDATE ──
  if (!input.title || !input.summary || !input.body) {
    console.error('[Pipeline] Rejected: Missing required fields (title, summary, or body).');
    return null;
  }
  if (!NODE_TYPES.includes(input.type)) {
    console.error(`[Pipeline] Rejected: Invalid type "${input.type}". Must be one of: ${NODE_TYPES.join(', ')}`);
    return null;
  }
  if (!ALL_CATEGORIES.includes(input.category)) {
    console.warn(`[Pipeline] Warning: Category "${input.category}" not in taxonomy. Finding closest match...`);
    input.category = findClosestCategory(input.category);
  }

  // Enforce limits
  const title = input.title.substring(0, 120);
  const summary = input.summary.substring(0, 300);
  const tags = input.tags.slice(0, 8).map(t => t.toLowerCase().replace(/\s+/g, '-'));

  // ── STEP 2.5: NORMALISE TO MARKDOWN ──
  const normalisedBody = normaliseToMarkdown({
    title,
    type: input.type,
    category: input.category,
    tags,
    summary,
    body: input.body,
    source: input.source || 'manual',
    sourceType: input.sourceType || 'text',
    confidence: input.confidence || 'unverified',
  });

  console.log(`[Pipeline] Markdown normalised for: "${title}" (${normalisedBody.length} chars)`);

  // ── STEP 3: EMBED ──
  const embeddingText = `${title} ${input.category} ${summary} ${input.body.substring(0, 500)}`;
  let embedding = await generateEmbedding(embeddingText);
  
  let isDummyEmbedding = false;
  // Retry once if embedding fails
  if (!embedding || embedding.length === 0) {
    console.warn('[Pipeline] Embedding failed. Retrying...');
    embedding = await generateEmbedding(embeddingText);
  }
  
  if (!embedding || embedding.length === 0) {
    console.warn('[Pipeline] Warning: Embedding generation failed completely. Bypassing DNA requirement with dummy vector to allow save.');
    // Generate a neutral dummy vector (768 dimensions) to prevent pipeline crashes
    embedding = new Array(768).fill(0.0001); 
    isDummyEmbedding = true;
  }

  // ── STEP 4: LINK ──
  const allNodes = await getKnowledgeNodes();
  let connections: string[] = [];
  
  if (!isDummyEmbedding) {
    const potentialLinks = allNodes
      .filter(n => n.embedding && n.embedding.length > 0 && n.embedding[0] !== 0.0001) // ignore dummy targets
      .map(n => ({ id: n.id, score: cosineSimilarity(embedding, n.embedding), node: n }))
      .sort((a, b) => b.score - a.score);

    // Take top 5 above threshold, or force top 2 if insufficient
    const aboveThreshold = potentialLinks.filter(p => p.score > 0.45).slice(0, 5);
    if (aboveThreshold.length >= 2) {
      connections = aboveThreshold.map(p => p.id);
    } else {
      connections = potentialLinks.slice(0, Math.min(2, potentialLinks.length)).map(p => p.id);
    }
    console.log(`[Pipeline] Linked "${title}" to ${connections.length} nodes. ${aboveThreshold.length >= 2 ? `Top score: ${aboveThreshold[0]?.score.toFixed(4)}` : '(forced connectivity)'}`);
  } else {
    // If we have no DNA, force link to 2 recent nodes so it isn't completely orphaned in the graph
    connections = allNodes.slice(0, Math.min(2, allNodes.length)).map(n => n.id);
    console.log(`[Pipeline] Bypassed DNA link for "${title}". Orphan attached to ${connections.length} recent nodes.`);
  }

  // ── STEP 5: STORE ──
  const nodeData = {
    title,
    type: input.type,
    category: input.category,
    tags,
    summary,
    body: normalisedBody,
    source: input.source || 'manual',
    sourceType: input.sourceType || 'text',
    confidence: input.confidence || 'unverified',
    createdAt: now,
    updatedAt: now,
    embedding,
    connections,
    synthesisMap: {} as Record<string, string>,
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), nodeData);

  // ── STEP 6: SYNTHESISE ──
  const synthesisMap: Record<string, string> = {};
  for (const connId of connections) {
    const target = allNodes.find(n => n.id === connId);
    if (target) {
      try {
        synthesisMap[connId] = await generateSynthesisRationale(
          `${title}: ${summary}`,
          `${target.title}: ${target.summary}`
        );
      } catch {
        synthesisMap[connId] = 'Strategic overlap detected in infrastructure and commercial strategy.';
      }
    }
  }

  // Write synthesis back
  if (Object.keys(synthesisMap).length > 0) {
    await updateDoc(doc(db, COLLECTION_NAME, docRef.id), { synthesisMap });
  }

  const savedNode: KnowledgeNode = {
    id: docRef.id,
    ...nodeData,
    synthesisMap,
  };

  console.log(`[Pipeline] ✅ Stored: "${title}" (${input.type}/${input.category}) with ${Object.keys(synthesisMap).length} syntheses.`);

  // ── STEP 7: MIRROR TO .MD FILE ──
  try {
    const filename = nodeToFilename({ title, type: input.type });
    await fetch('/api/mirror-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content: normalisedBody, nodeId: docRef.id }),
    });
    console.log(`[Pipeline] 📄 Mirrored to knowledge/${filename}`);
  } catch (mirrorError) {
    // Non-blocking — mirror failure should never block ingestion
    console.warn('[Pipeline] Mirror failed (non-blocking):', mirrorError);
  }

  return savedNode;
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL NEURAL RE-SYNC
// Re-embeds, re-links, and re-synthesises the entire knowledge base.
// ═══════════════════════════════════════════════════════════════

export async function globalNeuralResync(): Promise<{ nodeCount: number; rationaleCount: number }> {
  console.log('[Neural Sync] Starting Broggo 2.0 Global Re-Sync...');
  
  const allNodes = await getKnowledgeNodes();
  console.log(`[Neural Sync] Found ${allNodes.length} nodes to audit.`);
  
  if (allNodes.length === 0) return { nodeCount: 0, rationaleCount: 0 };

  let rationaleCount = 0;

  for (const currentNode of allNodes) {
    const docRef = doc(db, COLLECTION_NAME, currentNode.id);

    // Regenerate embedding if missing or corrupt
    let embedding = currentNode.embedding;
    if (!embedding || embedding.length === 0) {
      console.log(`[Neural Sync] Regenerating DNA for: ${currentNode.title}`);
      const text = `${currentNode.title} ${currentNode.category} ${currentNode.summary} ${currentNode.body?.substring(0, 500) || ''}`;
      embedding = await generateEmbedding(text);
      if (!embedding || embedding.length === 0) {
        console.warn(`[Neural Sync] Skipping ${currentNode.title} — embedding generation failed.`);
        continue;
      }
      await updateDoc(docRef, { embedding });
    }

    // Find connections
    const potentialLinks = allNodes
      .filter(n => n.id !== currentNode.id && n.embedding && n.embedding.length > 0)
      .map(n => ({ id: n.id, score: cosineSimilarity(embedding!, n.embedding), node: n }))
      .sort((a, b) => b.score - a.score);

    const aboveThreshold = potentialLinks.filter(p => p.score > 0.45).slice(0, 5);
    const connections = aboveThreshold.length >= 2
      ? aboveThreshold.map(p => p.id)
      : potentialLinks.slice(0, Math.min(2, potentialLinks.length)).map(p => p.id);

    // Generate synthesis rationales
    const synthesisMap: Record<string, string> = {};
    for (const connId of connections) {
      const target = allNodes.find(n => n.id === connId);
      if (target) {
        try {
          synthesisMap[connId] = await generateSynthesisRationale(
            `${currentNode.title}: ${currentNode.summary}`,
            `${target.title}: ${target.summary}`
          );
          rationaleCount++;
        } catch {
          synthesisMap[connId] = 'Strategic overlap detected.';
          rationaleCount++;
        }
      }
    }

    await updateDoc(docRef, { connections, synthesisMap });
    console.log(`[Neural Sync] ✅ ${currentNode.title}: ${connections.length} links, ${Object.keys(synthesisMap).length} rationales.`);
  }

  console.log(`[Neural Sync] Complete. ${allNodes.length} nodes, ${rationaleCount} rationales generated.`);
  return { nodeCount: allNodes.length, rationaleCount };
}

/**
 * Normalises all existing knowledge nodes to Markdown.
 * Useful for ensuring legacy content matches the new Broggo 2.0 standards.
 */
export async function batchNormaliseKnowledge(): Promise<number> {
  console.log('[Neural Sync] Starting Batch Markdown Normalisation...');
  const allNodes = await getKnowledgeNodes();
  let count = 0;

  for (const node of allNodes) {
    const normalisedBody = normaliseToMarkdown({
      title: node.title,
      type: node.type,
      category: node.category,
      tags: node.tags || [],
      summary: node.summary,
      body: node.body,
      source: node.source || 'manual',
      sourceType: node.sourceType || 'text',
      confidence: node.confidence || 'unverified',
    });

    if (normalisedBody !== node.body) {
      await updateDoc(doc(db, COLLECTION_NAME, node.id), { 
        body: normalisedBody,
        updatedAt: Date.now()
      });
      
      // Also trigger mirror update
      try {
        const filename = nodeToFilename({ title: node.title, type: node.type });
        await fetch('/api/mirror-knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, content: normalisedBody, nodeId: node.id }),
        });
      } catch (e) {
        console.warn(`[Neural Sync] Mirror failed for ${node.id}`);
      }
      
      count++;
    }
  }

  console.log(`[Neural Sync] Batch Normalisation complete. ${count} nodes updated.`);
  return count;
}

// ═══════════════════════════════════════════════════════════════
// MIGRATION UTILITIES
// ═══════════════════════════════════════════════════════════════

/** Export a manifest of all legacy data (titles + IDs) for reference */
export async function exportLegacyManifest(): Promise<string[]> {
  const titles: string[] = [];
  try {
    const insightsSnap = await getDocs(collection(db, LEGACY_INSIGHTS));
    insightsSnap.docs.forEach(d => {
      const data = d.data();
      titles.push(`[INSIGHT] ${data.topic || 'Untitled'} — ${data.category || 'Uncategorised'}`);
    });
    const opsSnap = await getDocs(collection(db, LEGACY_OPERATORS));
    opsSnap.docs.forEach(d => {
      const data = d.data();
      titles.push(`[OPERATOR] ${data.name || 'Untitled'} — ${data.country || 'Unknown'}`);
    });
  } catch (error) {
    console.error('[Migration] Error exporting manifest:', error);
  }
  return titles;
}

/** Clear all legacy collections */
export async function clearLegacyData(): Promise<{ insightsCleared: number; operatorsCleared: number }> {
  let insightsCleared = 0;
  let operatorsCleared = 0;
  
  try {
    const insightsSnap = await getDocs(collection(db, LEGACY_INSIGHTS));
    for (const d of insightsSnap.docs) {
      await deleteDoc(doc(db, LEGACY_INSIGHTS, d.id));
      insightsCleared++;
    }
    const opsSnap = await getDocs(collection(db, LEGACY_OPERATORS));
    for (const d of opsSnap.docs) {
      await deleteDoc(doc(db, LEGACY_OPERATORS, d.id));
      operatorsCleared++;
    }
  } catch (error) {
    console.error('[Migration] Error clearing legacy data:', error);
  }
  
  console.log(`[Migration] Cleared ${insightsCleared} insights + ${operatorsCleared} operators.`);
  return { insightsCleared, operatorsCleared };
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function findClosestCategory(raw: string): string {
  const lower = raw.toLowerCase();
  
  if (lower.includes('fibre') || lower.includes('fiber') || lower.includes('wavelength') || lower.includes('dwdm') || lower.includes('dark')) return 'Dark Fibre & Wavelengths';
  if (lower.includes('subsea') || lower.includes('cable') || lower.includes('marine')) return 'Subsea Cables';
  if (lower.includes('data cent') || lower.includes('colocation') || lower.includes('dc ') || lower.includes('facility')) return 'Data Centres & Colocation';
  if (lower.includes('cloud') || lower.includes('compute') || lower.includes('neocloud') || lower.includes('gpu')) return 'Neocloud / AI Infra';
  if (lower.includes('m&a') || lower.includes('merger') || lower.includes('acquisition')) return 'M&A Activity';
  if (lower.includes('invest') || lower.includes('funding') || lower.includes('capex')) return 'Investment & Funding';
  if (lower.includes('contract') || lower.includes('pricing')) return 'Pricing & Contracts';
  if (lower.includes('retain') || lower.includes('churn')) return 'Retention & Churn';
  if (lower.includes('eu ') || lower.includes('regulation') || lower.includes('berec') || lower.includes('ofcom')) return 'EU Policy';
  if (lower.includes('compet') || lower.includes('landscape') || lower.includes('market')) return 'Competitive Landscape';
  
  return 'Industry Trends'; // Safe default
}

// ═══════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY EXPORTS
// These are temporary adapters so the Hub doesn't break during migration.
// They will be removed once all consumers are updated.
// ═══════════════════════════════════════════════════════════════

export type ResearchInsight = KnowledgeNode;
export type NetworkOperator = KnowledgeNode;

export async function getResearchInsights(): Promise<KnowledgeNode[]> {
  return getKnowledgeNodes();
}

export async function getNetworkOperators(): Promise<KnowledgeNode[]> {
  return []; // Merged into knowledge_nodes — no separate operator list
}

export async function saveResearchInsight(insight: { topic: string; category: string; summary: string; details: string }): Promise<void> {
  await ingestKnowledgeNode({
    title: insight.topic,
    type: guessType(insight.category),
    category: findClosestCategory(insight.category),
    tags: [],
    summary: insight.summary,
    body: insight.details,
    source: 'legacy-ingestion',
    sourceType: 'text',
  });
}

function guessType(category: string): NodeType {
  const lower = category.toLowerCase();
  if (lower.includes('operator') || lower.includes('carrier') || lower.includes('telecom')) return 'operator';
  if (lower.includes('fibre') || lower.includes('subsea') || lower.includes('data cent') || lower.includes('cable')) return 'infrastructure';
  if (lower.includes('contract') || lower.includes('legal') || lower.includes('pricing') || lower.includes('retention')) return 'commercial';
  if (lower.includes('regulat') || lower.includes('policy') || lower.includes('eu ')) return 'regulatory';
  return 'market';
}

export async function updateKnowledgeNode(id: string, updates: Partial<KnowledgeNode>): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Date.now()
    });
    console.log(`[Broggo 2.0] Updated knowledge node ${id}`);
  } catch (error) {
    console.error(`[Broggo 2.0] Error updating knowledge node ${id}:`, error);
    throw error;
  }
}

export async function deleteKnowledgeNode(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    console.log(`[Broggo 2.0] Deleted knowledge node ${id}`);
  } catch (error) {
    console.error(`[Broggo 2.0] Error deleting knowledge node ${id}:`, error);
    throw error;
  }
}
