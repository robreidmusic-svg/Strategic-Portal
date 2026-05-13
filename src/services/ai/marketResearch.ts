import { ai, runWithRetry } from './client';
import { getKnowledgeNodes, ingestKnowledgeNode, searchKnowledgeBase, saveResearchInsight } from '../researchService';
import { 
  URL_INGESTION_INSTRUCTION, 
  TEXT_INGESTION_INSTRUCTION, 
  FILE_INGESTION_INSTRUCTION, 
  CSV_INGESTION_INSTRUCTION 
} from './skills';

export async function researchMarketIntelligence(
  message: string, 
  history: { role: string, text: string }[],
  options?: { useWebSearch: boolean, searchKnowledgeBase: boolean, deepResearchMax: boolean, outputStyle: string }
) {
  const opts = options || { useWebSearch: true, searchKnowledgeBase: true, deepResearchMax: false, outputStyle: 'Normal' };

  let insightsContext = "Knowledge Base search is DISABLED for this query.";
  if (opts.searchKnowledgeBase) {
    const relevantInsights = await searchKnowledgeBase(message, 5);
    if (relevantInsights.length > 0) {
      insightsContext = `RELEVANT RESEARCH KNOWLEDGE BASE (Top 5 matches):\n${relevantInsights.map((i: any) => `- [${i.category}] ${i.topic}\n  Summary: ${i.summary}\n  Details: ${i.details}`).join('\n\n')}`;
    } else {
      insightsContext = "No relevant previous research found in knowledge base.";
    }
  }

  const mode = opts.outputStyle || 'Normal'; // 'Quick' | 'Normal' | 'Full Report' (Deep) | 'Exhaustive'
  const isQuick = mode === 'Quick' || mode === 'Summary';
  const isDeep = mode === 'Full Report' || opts.deepResearchMax;
  const isExhaustive = mode === 'Exhaustive';

  const systemInstruction = `
You are BROGGO — the Strategic Intelligence Agent for Zayo Europe, a bandwidth infrastructure and telecoms operator.
You are not a chatbot. You are a second brain: a persistent, evolving intelligence that builds a structured knowledge base and delivers high-quality strategic insight on demand.

COMPETENCY AREAS:
- Bandwidth Infrastructure (Dark Fiber, Optical Transport, DWDM, WDM, IP Transit, Ethernet)
- Data Centre & Colocation (Hyperscale campuses, edge facilities, power and cooling trends)
- Subsea Cable Systems (Transatlantic, Asia-Europe, Mediterranean, emerging routes)
- AI & Neocloud Infrastructure (GPU clusters, inference, sovereign AI)
- Hyperscaler Strategy (AWS, Google, Microsoft Azure, Meta)
- Competitive Intelligence (European carriers, Tier 1 & Tier 2 ecosystems)
- Regulatory & Policy (EU connectivity, BEREC, Ofcom)

GEOGRAPHIC PRIORITIES: Eastern Europe, Southern Europe, Transatlantic Subsea, Asia-to-Europe corridors.

--- TONE & LANGUAGE ---
- Write in clean, precise British English. No Americanisms.
- Banned phrases: "leverage" (as verb), "actionable", "deep dive" (as noun), "circle back", "reach out", "pain points".
- High information density. Every sentence earns its place. No filler.
- No sycophancy. Do not compliment the user's question before answering it.
- ${isDeep || isExhaustive ? 'This is a FORMAL REPORT. No humour. Executive briefing standard throughout.' : 'In conversational mode, you may exercise dry, sardonic British wit where it fits naturally. Never forced. Never at the expense of accuracy.'}

--- ACTIVE MODE: ${mode.toUpperCase()} ---
    ${isQuick ? `BRIEF MODE: Maximum 500 words. Hard limit. Focus on immediate impact. Use Markdown bullet points.` : ''}
    ${!isQuick && !isDeep && !isExhaustive ? `STANDARD MODE: Balanced depth. 3-4 structured sections. Use Markdown tables for any numerical data.` : ''}
    ${isDeep ? `DETAILED MODE: Comprehensive report. Minimum 6 sections. Deep technical dive into infrastructure. Use advanced Markdown formatting.` : ''}
    ${isExhaustive ? `EXHAUSTIVE MODE: Maximum dossiers. Multi-stage analysis. Detailed technical specifications in Markdown tables. Extensive commercial nuance.` : ''}

    OUTPUT FORMATTING:
    - You MUST use Markdown for all technical reports.
    - Use technical headings (###), bold text for key terms, and Markdown tables for technical specifications.
    - Ensure all reports are structured and professional.

--- PRE-RESEARCH PROTOCOL ---
Before answering, follow this chain:
1. CLARIFY: If there is genuine ambiguity, ask ONE targeted clarifying question. Do not interrogate.
2. SEARCH: If knowledge base is insufficient, trigger web search before admitting uncertainty.
3. INFER: If search yields nothing conclusive, make an educated inference and label it explicitly:
   "Based on available data as of [date], my inference is... — verify against primary sources before acting."
Never skip to Step 3 without attempting Steps 1 and 2 first.

--- KNOWLEDGE BASE & MEMORY ---
${insightsContext}

Cross-reference duty: ${opts.searchKnowledgeBase ? 'ALWAYS cross-reference findings against the knowledge base above. Explicitly flag:' : 'Knowledge base cross-referencing is DISABLED for this query.'}
${opts.searchKnowledgeBase ? `- ✅ Confirms existing intelligence — [what it confirms]
- ⚠️ Conflicts with existing intelligence — [state both versions; do NOT update without user deciding]
- 🆕 New intelligence, no prior record — [proceed to save]

Persistence rules: Only save findings that are genuinely new, high-value technical or commercial intelligence from a credible source. Never save general industry knowledge or conversational context.` : ''}

--- OUTPUT FORMAT ---
${isQuick ? `[Direct answer in clean prose or tight bullets]
[Source if applicable — one line]` : ''}
${!isQuick && !isDeep && !isExhaustive ? `**[Headline — what this is about]**

[Opening paragraph — 2–3 sentences max]

**[Section Heading]**
[Body — concise and precise]

---
📚 Knowledge Base: [Confirms / Conflicts / No prior record]
🔗 Sources: [if web search used]` : ''}
${isDeep || isExhaustive ? `# [Report Title]
**Classification**: Strategic Intelligence | **Mode**: ${mode}

---

## Executive Summary
[3–5 sentences. What this is, why it matters, what should be done.]

---

## [Section Heading]
[Substantive body. Tables where data permits. No filler.]

---

## Strategic Implications for Zayo Europe
[Always included. Translate findings into commercial context.]

---

## Knowledge Base Status
✅ Confirms: [list]
⚠️ Conflicts: [list — awaiting user decision]
🆕 New entries saved: [list]

---

🔗 Sources: [full citation list]` : ''}

--- HARD GUARDRAILS ---
1. Never speculate about named individuals.
2. ${isQuick ? 'HARD LIMIT: 500 words maximum. If more is needed, tell the user and suggest switching mode.' : 'Length should match the depth required by the question and mode.'}
3. No Americanisms in writing.
4. Always note every knowledge base persistence event in the response.
5. Never produce a wall of text — sections must be visually separated with bold headings.
  `;

  try {
    // Gemini requires the first message in history to be from the 'user'.
    let firstUserIndex = history.findIndex(h => h.role === 'user');
    const filteredHistory = firstUserIndex !== -1 ? history.slice(firstUserIndex) : [];

    const contents: any[] = filteredHistory.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const config: any = {
      systemInstruction,
      temperature: opts.deepResearchMax ? 0.0 : 0.3,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          responseText: { type: "string", description: "The conversational response or report to show the user." },
          insights: {
            type: "array",
            items: {
              type: "object",
              properties: {
                topic: { type: "string" },
                category: { type: "string" },
                summary: { type: "string" },
                details: { type: "string" }
              },
              required: ["topic", "category", "summary", "details"]
            }
          }
        },
        required: ["responseText", "insights"]
      }
    };
    
    if (opts.useWebSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    let response;
    if (opts.deepResearchMax) {
      console.log("[Market Research] Triggering Gemini Deep Research Agent...");
      response = await runWithRetry(() => (ai as any).interactions.create({
        agent: "deep-research-pro-preview-12-2025",
        input: message,
        system_instruction: systemInstruction,
        agent_config: { type: 'deep-research' },
        response_mime_type: "application/json",
        response_format: config.responseSchema
      }));
    } else {
      response = await runWithRetry(() => ai.models.generateContent({
        model: isExhaustive ? "gemini-3.1-pro-preview" : isDeep ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview",
        contents,
        config,
      }));
    }

    const result = JSON.parse(((response as any).text || '{"responseText":"","insights":[]}').replace(/^\s*```(?:json)?\n?/, '').replace(/\n?```\s*$/, '').trim() || '{"responseText":"","insights":[]}');

    for (const insight of result.insights || []) {
      await saveResearchInsight({
        topic: insight.topic,
        category: insight.category,
        summary: insight.summary,
        details: insight.details
      });
      console.log("Memory updated with new research insight:", insight.topic);
    }

    return result.responseText;
  } catch (error) {
    console.error("Research Agent Error:", error);
    throw error;
  }
}

export async function auditResearchKnowledge() {
  const existingNodes = await getKnowledgeNodes();
  if (existingNodes.length === 0) return "No knowledge found to audit.";

  // Randomly select 5 insights to audit so the entire DB is covered over time
  const shuffled = existingNodes.sort(() => 0.5 - Math.random());
  const nodesToAudit = shuffled.slice(0, 5);

  const systemInstruction = `
    You are the "Intelligence Auditor" for a strategic telecoms firm.
    Your task is to review the following SAVED KNOWLEDGE and verify its accuracy using Google Search.
    
    AUDIT PROCEDURE:
    1. Review each item in the knowledge base.
    2. Search for the latest news, technical updates, or competitor Changes related to the topic.
    3. If the information is outdated, incomplete, or incorrect, prepare an update.
    
    PERSISTENCE COMMANDS:
    If an update is required, include it in the "updates" JSON array.
    
    TONALITY:
    - Highly critical and analytical.
    - Focus on technical precision and commercial relevance.
  `;

  // Prevent enormous payloads
  const knowledgeSummary = nodesToAudit.map((n: any) => `ID: ${n.id}\nTitle: ${n.title}\nType: ${n.type}\nCategory: ${n.category}\nSummary: ${n.summary}\nBody: ${n.body ? n.body.substring(0, 2000) : ''}`).join('\n\n---\n\n');

  try {
    const response = await runWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: `Please perform a deep-search audit on the following intelligence base:\n\n${knowledgeSummary}` }] }],
      config: {
        systemInstruction,
        temperature: 0.2,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            responseText: { type: "string", description: "The audit summary report" },
            updates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  summary: { type: "string" },
                  details: { type: "string" }
                },
                required: ["id", "summary", "details"]
              }
            }
          },
          required: ["responseText", "updates"]
        }
      },
    }));

    const result = JSON.parse((response.text || '{"responseText":"","updates":[]}').replace(/^\s*```(?:json)?\n?/, '').replace(/\n?```\s*$/, '').trim() || '{"responseText":"","updates":[]}');
    let updatesFound = 0;
    
    for (const update of result.updates || []) {
      // Note: audit updates go through ingestKnowledgeNode as new nodes
      await saveResearchInsight({
        topic: `Audit Update: ${update.id.substring(0, 30)}`,
        category: 'Market',
        summary: update.summary,
        details: update.details
      });
      updatesFound++;
    }

    return result.responseText;
  } catch (error) {
    console.error("Audit Agent Error:", error);
    throw error;
  }
}

export async function processIngestedEmail(email: { subject: string, body: string, from: string, date: string }) {
  const systemInstruction = `
    You are the "Strategic Ingestion Agent". 
    A new document/article has been forwarded via email.
    
    EMAIL DETAILS:
    From: ${email.from}
    Subject: ${email.subject}
    Date: ${email.date}
    
    BODY:
    ${email.body}
    
    TASK:
    1. Extract the core strategic market intelligence findings.
    2. Format all intelligence as Research Insights.
    3. The "details" field for each insight MUST be a technical report formatted in MARKDOWN.
    4. Use Markdown tables, bold text, and clear headings within the details field.
    
    PERSISTENCE COMMANDS:
    You MUST include significant technical findings in the "insights" JSON array.
    Only persist high-value technical intelligence. 
  `;

  try {
    const response = await runWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: "Please extract strategic intelligence from this ingested email." }] }],
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Brief summary of the email content" },
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  topic: { type: "string" },
                  category: { type: "string" },
                  summary: { type: "string" },
                  details: { type: "string" }
                },
                required: ["topic", "category", "summary", "details"]
              }
            }
          },
          required: ["summary", "insights"]
        }
      },
    }));

    const result = JSON.parse((response.text || '{"summary":"","insights":[]}').replace(/^\s*```(?:json)?\n?/, '').replace(/\n?```\s*$/, '').trim() || '{"summary":"","insights":[]}');
    let count = 0;
    
    for (const insight of result.insights || []) {
      await saveResearchInsight({
        topic: insight.topic,
        category: insight.category,
        summary: insight.summary,
        details: insight.details
      });
      count++;
    }

    return { count, summary: result.summary };
  } catch (error) {
    console.error("Ingestion Processing Error:", error);
    throw error;
  }
}

export async function processIngestedLink(url: string) {
  const systemInstruction = `
    ${URL_INGESTION_INSTRUCTION}
    
    TARGET URL: ${url}
  `;
  try {
    console.log('[Neural Ingestion] Processing link: ' + url);
    const response = await runWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ role: 'user', parts: [{ text: 'Execute a deep intelligence gathering cycle for: ' + url + '. Capture as much technical and commercial data as possible into structured reports.' }] }],
      config: {
        systemInstruction,
        temperature: 0.1,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Executive summary of the ingestion results" },
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  topic: { type: "string" },
                  category: { type: "string" },
                  summary: { type: "string" },
                  details: { type: "string" }
                },
                required: ["topic", "category", "summary", "details"]
              }
            }
          },
          required: ["summary", "insights"]
        }
      },
    }));

    const result = JSON.parse((response.text || '{"summary":"","insights":[]}').replace(/^\s*```(?:json)?\n?/, '').replace(/\n?```\s*$/, '').trim() || '{"summary":"","insights":[]}');
    console.log('[Neural Ingestion] JSON Parsed, Insights Found: ' + (result.insights?.length || 0));
    let count = 0;
    
    for (const insight of result.insights || []) {
      console.log('[Neural Ingestion] Saving insight: ' + insight.topic);
      await saveResearchInsight({
        topic: insight.topic,
        category: insight.category,
        summary: insight.summary,
        details: insight.details
      });
      count++;
    }

    if (count === 0 && result.summary?.length > 50) {
      console.log("[Neural Ingestion] Auto-extracting from summary because no insights were returned.");
      await saveResearchInsight({
        topic: 'Analysis: ' + url.substring(0, 30) + '...',
        category: 'Market',
        summary: 'Auto-extracted summary of resource.',
        details: result.summary
      });
      count = 1;
    }

    return { count, summary: result.summary, insights: result.insights || [] };
  } catch (error) {
    console.error("Link Ingestion Error:", error);
    throw error;
  }
}

export async function processIngestedText(content: string) {
  const systemInstruction = `
    ${TEXT_INGESTION_INSTRUCTION}
  `;

  try {
    const response = await runWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ role: 'user', parts: [{ text: 'Extract technical and commercial intelligence from the following text and generate structured reports:\n\n' + content }] }],
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  topic: { type: "string" },
                  category: { type: "string" },
                  summary: { type: "string" },
                  details: { type: "string" }
                },
                required: ["topic", "category", "summary", "details"]
              }
            }
          },
          required: ["summary", "insights"]
        }
      },
    }));

    const result = JSON.parse((response.text || '{"summary":"","insights":[]}').replace(/^\s*```(?:json)?\n?/, '').replace(/\n?```\s*$/, '').trim() || '{"summary":"","insights":[]}');
    let count = 0;
    
    for (const insight of result.insights || []) {
      await saveResearchInsight({
        topic: insight.topic,
        category: insight.category,
        summary: insight.summary,
        details: insight.details
      });
      count++;
    }

    return { count, summary: result.summary, insights: result.insights || [] };
  } catch (error) {
    console.error("Text Ingestion Error:", error);
    throw error;
  }
}

export async function processIngestedFile(fileName: string, fileContent: string) {
  const systemInstruction = `
    ${FILE_INGESTION_INSTRUCTION}
    
    FILENAME: ${fileName}
  `;

  try {
    console.log('[Neural Ingestion] Processing file: ' + fileName);
    const response = await runWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ role: 'user', parts: [{ text: 'Analyze this document and generate a series of comprehensive technical intelligence reports. DOCUMENT CONTENT BEGINS:\n\n' + fileContent.substring(0, 100000) }] }],
      config: {
        systemInstruction,
        temperature: 0.1, // High precision
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Executive summary of the file analysis" },
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  topic: { type: "string" },
                  category: { type: "string" },
                  summary: { type: "string" },
                  details: { type: "string" }
                },
                required: ["topic", "category", "summary", "details"]
              }
            }
          },
          required: ["summary", "insights"]
        }
      },
    }));

    const result = JSON.parse((response.text || '{"summary":"","insights":[]}').replace(/^\s*```(?:json)?\n?/, '').replace(/\n?```\s*$/, '').trim() || '{"summary":"","insights":[]}');
    let count = 0;
    
    for (const insight of result.insights || []) {
      console.log('[Neural Ingestion] Saving insight from file: ' + insight.topic);
      await saveResearchInsight({
        topic: insight.topic,
        category: insight.category,
        summary: insight.summary,
        details: insight.details
      });
      count++;
    }

    if (count === 0 && result.summary?.length > 50) {
      console.log("[Neural Ingestion] Auto-extracting from summary because no insights returned.");
      await saveResearchInsight({
        topic: 'Document Analysis: ' + fileName,
        category: 'Technical',
        summary: 'Strategic overview of ' + fileName,
        details: result.summary
      });
      count = 1;
    }

    return { count, summary: result.summary, insights: result.insights || [] };
  } catch (error) {
    console.error("File Ingestion Error:", error);
    throw error;
  }
}

export async function processIngestedCSV(fileName: string, csvContent: string) {
  const { CSV_INGESTION_INSTRUCTION } = await import('./skills');

  // Determine vendor context from filename
  const fileNameLower = fileName.toLowerCase();
  let vendorHint = '';
  if (fileNameLower.includes('zayo')) vendorHint = 'Vendor context: This CSV contains Zayo Europe on-net locations.';
  else if (fileNameLower.includes('colt')) vendorHint = 'Vendor context: This CSV contains Colt Technology Services on-net locations.';
  else if (fileNameLower.includes('telia')) vendorHint = 'Vendor context: This CSV contains Telia Carrier on-net locations.';
  else vendorHint = `Vendor context: Infer the vendor/carrier from the data or filename (${fileName}).`;

  const systemInstruction = `
    ${CSV_INGESTION_INSTRUCTION}

    ${vendorHint}

    FILENAME: ${fileName}

    FORMATTING RULES:
    - The "body" field for each generated node MUST be formatted in MARKDOWN.
    - Use Markdown tables to present tabular data from the CSV.
    - Ensure clear section headers (###) if multiple entities are grouped.
  `;

  try {
    console.log('[CSV Ingestion] Processing: ' + fileName);
    console.log('[CSV Ingestion] Content preview: ' + csvContent.substring(0, 200));

    const response = await runWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ 
        role: 'user', 
        parts: [{ 
          text: `Process this CSV data into structured KnowledgeNodes. Preserve ALL rows and ALL columns. Group by facility/entity.\n\nCSV DATA:\n${csvContent}` 
        }] 
      }],
      config: {
        systemInstruction,
        temperature: 0.0, // Zero creativity — pure data processing
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Executive summary of the CSV ingestion" },
            groupingKey: { type: "string", description: "The column or logic used for grouping" },
            nodes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  type: { type: "string" },
                  category: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                  summary: { type: "string" },
                  body: { type: "string" }
                },
                required: ["title", "type", "category", "tags", "summary", "body"]
              }
            }
          },
          required: ["summary", "groupingKey", "nodes"]
        }
      },
    }));

    const result = JSON.parse(
      (response.text || '{"summary":"","groupingKey":"","nodes":[]}')
        .replace(/^\s*```(?:json)?\n?/, '')
        .replace(/\n?```\s*$/, '')
        .trim() || '{"summary":"","groupingKey":"","nodes":[]}'
    );

    console.log(`[CSV Ingestion] Parsed ${result.nodes?.length || 0} nodes, grouped by: ${result.groupingKey}`);

    let count = 0;
    const validTypes = ['operator', 'infrastructure', 'market', 'regulatory', 'commercial'];

    for (const node of result.nodes || []) {
      const nodeType = validTypes.includes(node.type) ? node.type : 'infrastructure';
      
      const savedNode = await ingestKnowledgeNode({
        title: node.title || 'Untitled Node',
        type: nodeType as any,
        category: node.category || 'Data Centres & Colocation',
        tags: node.tags || [],
        summary: node.summary || 'Structured data extracted from CSV.',
        body: node.body || 'No data extracted.',
        source: fileName,
        sourceType: 'csv',
      });
      
      if (savedNode) {
        count++;
      } else {
        console.warn(`[CSV Ingestion] Failed to save node: ${node.title}`);
      }
    }

    console.log(`[CSV Ingestion] ✅ Complete. ${count} nodes created from ${fileName}`);
    return { count, summary: result.summary, groupingKey: result.groupingKey, nodes: result.nodes || [] };
  } catch (error) {
    console.error("CSV Ingestion Error:", error);
    throw error;
  }
}

export async function runAutonomousEvolution(history: { role: string, text: string }[] = [], userContext: string = "") {
  const existingNodes = await getKnowledgeNodes();

  const knowledgeBase = `
    KNOWLEDGE BASE STATE:
    - Total Knowledge Nodes: ${existingNodes.length}
    - Types: ${[...new Set(existingNodes.map(n => n.type))].join(', ')}
    - Operators: ${existingNodes.filter(n => n.type === 'operator').slice(0, 50).map(n => n.title).join(', ')}
    
    RECENT SESSION ACTIVITY:
    ${history.map((h: any) => h.role.toUpperCase() + ": " + h.text.substring(0, 500)).join('\n')}

    USER DIRECTIVES (PRIORITY):
    ${userContext || "None provided. Continue autonomous gap analysis."}
  `;

  const systemInstruction = `
    You are the "Neural Evolution Engine" (Deep Research Max Mode).
    Your mission is to autonomously build a comprehensive knowledge base of network operators (national and regional) and Telecom Vendors (Tier 1 & Tier 2) across Europe.
    
    DEEP RESEARCH PROTOCOL:
    1. ANALYZE GAPS: Review the current knowledge base. Target regional players, technical deployments, or vendor ecosystems NOT currently documented.
    2. MULTI-STEP REASONING: Before searching, break down the objective into 3+ distinct search queries.
    3. EXHAUSTIVE EXTRACTION: Gather PoP locations, backbone capacity, vendor product portfolios, commercial partnerships, and market share.
    4. QUALITY FIRST: Do not provide brief summaries. I need the full contextual capture in technical report format.
    
    EXTRACTION MANDATE:
    The "Details" field for both Operators, Vendors, and Insights MUST contain a technical report style capture of findings formatted in MARKDOWN. 
    Use technical headings (###), bold text for key terms, and Markdown tables for specifications where available.
    
    FORMATS:
    Output your findings using the strictly defined JSON format containing "reasoning", "operators", and "insights" arrays.
  `;

  try {
    console.log("[Deep Research] Triggering Autonomous Evolution via Deep Research Agent...");
    const response = await runWithRetry(() => (ai as any).interactions.create({
      agent: "deep-research-pro-preview-12-2025",
      input: 'DEEP RESEARCH ACTIVATED. Objective: Perform a multi-stage intelligence cycle. Current Knowledge Base: \n' + knowledgeBase + '\n\nPlease identify the next strategic gap, execute multiple coordinated search queries, and compile comprehensive reports.',
      system_instruction: systemInstruction,
      agent_config: { type: 'deep-research' },
      response_mime_type: "application/json",
      response_format: {
        type: "object",
        properties: {
          reasoning: { type: "string" },
          operators: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                country: { type: "string" },
                region: { type: "string" },
                type: { type: "string" },
                summary: { type: "string" },
                details: { type: "string" }
              },
              required: ["name", "country", "region", "type", "summary", "details"]
            }
          },
          insights: {
            type: "array",
            items: {
              type: "object",
              properties: {
                topic: { type: "string" },
                category: { type: "string" },
                summary: { type: "string" },
                details: { type: "string" }
              },
              required: ["topic", "category", "summary", "details"]
            }
          }
        },
        required: ["reasoning", "operators", "insights"]
      }
    }));

    const result = JSON.parse(((response as any).text || '{"reasoning":"","operators":[],"insights":[]}').replace(/^\s*```(?:json)?\n?/, '').replace(/\n?```\s*$/, '').trim() || '{"reasoning":"","operators":[],"insights":[]}');
    
    let opCount = 0;
    for (const op of result.operators || []) {
      await ingestKnowledgeNode({ 
        title: op.name, 
        type: 'operator',
        category: 'Tier 1 Carrier',
        tags: [op.country?.toLowerCase(), op.region?.toLowerCase()].filter(Boolean) as string[],
        summary: op.summary, 
        body: op.details,
        source: 'autonomous-evolution',
        sourceType: 'text',
      });
      opCount++;
    }

    let insightCount = 0;
    for (const insight of result.insights || []) {
      await saveResearchInsight({ 
        topic: insight.topic, 
        category: insight.category, 
        summary: insight.summary, 
        details: insight.details 
      });
      insightCount++;
    }

    return {
      reasoning: result.reasoning,
      operatorsFound: opCount,
      insightsFound: insightCount
    };
  } catch (error) {
    console.error("Autonomous Evolution Error:", error);
    throw error;
  }
}

export async function verifyStrategicLink(sourceContext: string, targetContext: string) {
  const systemInstruction = `
    You are the "Strategic Neural Auditor".
    Your task is to determine if two pieces of intelligence have any meaningful strategic, technical, or commercial relationship.
    
    CRITERIA:
    - Shared infrastructure OR shared geographic region.
    - Commercial synergy (e.g., tech cuts in one area impacting operations in another).
    - Market trends (e.g., both are part of the 'AI-compute' or 'Subsea' narrative).
    - Even if the link is 'weak' but strategically interesting, return TRUE.
    
    Response MUST be "TRUE" or "FALSE".
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ role: 'user', parts: [{ text: `Analyze these two intelligence nodes and determine if they have a strategic link:\n\nNODE 1: ${sourceContext}\n\nNODE 2: ${targetContext}\n\nRESPONSE:` }] }],
      config: { systemInstruction, temperature: 0.1 }
    });
    return response.text.trim().toUpperCase().includes('TRUE');
  } catch (error) {
    return false;
  }
}
export async function generateSynthesisRationale(sourceContext: string, targetContext: string) {
  const systemInstruction = `
    You are the "Strategic Neural Synthesizer".
    Your task is to explain the HIDDEN STRATEGIC LINK between two pieces of intelligence.
    
    TASK:
    Generate a 1-sentence "Synthesis Note" that explains why these two items are connected from a telecoms/infrastructure perspective.
    
    STYLE:
    - Executive, punchy, and analytical.
    - Focus on cause-and-effect (e.g., "This layoff suggests a slowdown in the DC builds mentioned in Node B").
    - Do not use "This is connected because...". Start directly.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ role: 'user', parts: [{ text: `SYNTHESIZE THESE NODES:\n\nNODE A: ${sourceContext}\n\nNODE B: ${targetContext}` }] }],
      config: { systemInstruction, temperature: 0.1 }
    });
    return response.text.trim();
  } catch (error) {
    return "Strategic overlap detected in infrastructure and commercial strategy.";
  }
}
