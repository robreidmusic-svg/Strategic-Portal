import { ai, runWithRetry } from './client';
import { saveProposal } from '../proposalService';

const SCAN_SOURCES = [
  { name: 'Data Center Frontier',    url: 'https://www.datacenterfrontier.com/' },
  { name: 'Data Center Dynamics',    url: 'https://www.datacenterdynamics.com/' },
  { name: 'Datacenter Forum',        url: 'https://www.datacenter-forum.com/' },
  { name: 'Baxtel',                  url: 'https://baxtel.com/' },
  { name: 'The Next Platform',       url: 'https://www.nextplatform.com/' },
  { name: 'Light Reading',           url: 'https://www.lightreading.com/' },
  { name: 'Fierce Network',          url: 'https://www.fierce-network.com/' },
  { name: 'Submarine Networks',      url: 'https://www.submarinenetworks.com/' },
  { name: 'TechNewsWorld',           url: 'https://www.technewsworld.com/' },
  { name: 'SemiAnalysis',            url: 'https://www.semianalysis.com/' },
  { name: 'CoreWeave Blog',          url: 'https://www.coreweave.com/blog' },
  { name: 'Corning Signal Network',  url: 'https://www.corning.com/optical-communications/worldwide/en/home/the-signal-network-blog.html' },
  { name: 'Ciena Insights',         url: 'https://www.ciena.com/insights' },
  { name: 'Energy Storage News',     url: 'https://www.energy-storage.news/' },
  { name: 'Utility Dive',            url: 'https://www.utilitydive.com/' },
];

const systemInstruction = `
You are Broggo — the Strategic Intelligence Agent for Zayo Europe, a bandwidth infrastructure and telecoms operator.

Your task right now is the DAILY INTELLIGENCE SCAN.

You will search across the following sources and identify the single most strategically significant story or development published in the last 24–48 hours that is relevant to Zayo Europe's business:

SOURCES TO SCAN:
${SCAN_SOURCES.map(s => `- ${s.name}: ${s.url}`).join('\n')}

ZAYO EUROPE'S KEY FOCUS AREAS:
- Bandwidth Infrastructure (Dark Fiber, Optical Transport, DWDM, IP Transit)
- Data Centre & Colocation (Hyperscale campuses, edge, power/cooling trends)
- Subsea Cable Systems (Transatlantic, Asia-Europe, Mediterranean)
- AI & Neocloud Infrastructure (GPU clusters, inference, sovereign AI)
- Hyperscaler Strategy (AWS, Google, Microsoft, Meta)
- Competitive Intelligence (European carriers, Tier 1 & Tier 2)
- Regulatory & Policy (EU connectivity, BEREC, Ofcom)

GEOGRAPHIC PRIORITIES:
Eastern Europe, Southern Europe, Transatlantic Subsea, Asia-to-Europe corridors

SCAN RULES:
1. Find ONE high-value story. Do not fabricate content — if nothing significant has emerged today, say so.
2. Assess the strategic relevance to Zayo Europe specifically.
3. Output a structured Research Proposal Card: topic, source name, source URL, a 2-sentence rationale for why this matters to Zayo Europe right now, a proposed research question, a scope (Quick / Deep / Exhaustive), and a cost estimate (Low / Medium / High).
4. The tone must be precise British English. No Americanisms.
`;

export async function runDailyScan(): Promise<{
  proposalCreated: boolean;
  topic?: string;
  message: string;
}> {
  try {
    const response = await runWithRetry(() =>
      ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Run the daily intelligence scan now. Search across the monitored sources for the most strategically significant development in the last 48 hours relevant to Zayo Europe. Return a structured proposal card or confirm that nothing significant has emerged.`,
              },
            ],
          },
        ],
        config: {
          systemInstruction,
          temperature: 0.2,
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              significantFindingFound: {
                type: 'boolean',
                description: 'Whether a significant story was found',
              },
              noFindingReason: {
                type: 'string',
                description: 'If no finding, brief explanation',
              },
              topic: { type: 'string' },
              sourceName: { type: 'string' },
              sourceUrl: { type: 'string' },
              rationale: {
                type: 'string',
                description: '2 sentences on why this matters to Zayo Europe right now',
              },
              proposedQuestion: {
                type: 'string',
                description: 'The exact research question to put to Broggo if approved',
              },
              scope: {
                type: 'string',
                enum: ['Quick', 'Deep', 'Exhaustive'],
              },
              estimatedCost: {
                type: 'string',
                enum: ['Low', 'Medium', 'High'],
              },
            },
            required: ['significantFindingFound'],
          },
        },
      })
    );

    const raw = (response.text || '{}')
      .replace(/^\s*```(?:json)?\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim();
    const result = JSON.parse(raw || '{}');

    if (!result.significantFindingFound) {
      return {
        proposalCreated: false,
        message: result.noFindingReason || 'No significant developments detected today.',
      };
    }

    await saveProposal({
      topic: result.topic,
      source: result.sourceName,
      sourceUrl: result.sourceUrl,
      rationale: result.rationale,
      proposedQuestion: result.proposedQuestion,
      scope: result.scope,
      estimatedCost: result.estimatedCost,
    });

    return {
      proposalCreated: true,
      topic: result.topic,
      message: `Proposal created: "${result.topic}"`,
    };
  } catch (e) {
    console.error('[Daily Scan] Error:', e);
    throw e;
  }
}
