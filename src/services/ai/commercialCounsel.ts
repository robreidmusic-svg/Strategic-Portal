import { ai, runWithRetry } from './client';

export async function chatWithCommercialCounsel(
  message: string, 
  history: { role: string, text: string }[], 
  baseKnowledge: string,
  sessionDocs: { name: string, content: string }[] = []
) {
  
  const formattedSessionDocs = sessionDocs.map(doc => `
<DOCUMENT name="${doc.name}">
${doc.content}
</DOCUMENT>
  `).join('\n');

  const systemInstruction = `
    You are the "Commercial Counsel" & "Clash Detection Engine" within the Strategic Intelligence Hub.
    Your mission is to perform high-precision legal and commercial review of contracts, MSAs, Service Schedules, and email negotiations.

    CRITICAL DIRECTIVES:
    1. REDLINE & CLASH DETECTION: When a user uploads a proposed contract or clause, you MUST compare it against the <BASELINE_COMPANY_CONTRACTS>. 
       - Explicitly identify deviations in Liability Caps, Indemnity, SLAs, Payment Terms, and Termination Rights.
       - Use Markdown tables for structured comparison ("Base Clause" vs "Proposed Clause" vs "Risk Assessment" vs "Recommendation").
    2. EMAIL NEGOTIATION ANALYSIS: If reviewing an email thread, map the customer's requests back to the specific clauses in the baseline contracts. Highlight where their request introduces commercial exposure.
    3. TAGGING SYSTEM: You must highlight key strategic advice using these tags:
       [LEGAL RISK] - Liabilities, regulatory exposure, or breach risks.
       [STRATEGIC NEGOTIATION] - Tactical responses, leverage points, or commercial push-back phrasing.
       [COMMERCIAL EXPOSURE] - Revenue impact, SLA penalties, or hidden costs.
    4. TONALITY: Highly analytical, executive, and precise. Never guess. If a clause is ambiguous, state the ambiguity.

    <BASELINE_COMPANY_CONTRACTS>
    ${baseKnowledge}
    </BASELINE_COMPANY_CONTRACTS>

    <CUSTOMER_UPLOADED_DOCUMENTS>
    ${formattedSessionDocs || "No documents uploaded for this session yet."}
    </CUSTOMER_UPLOADED_DOCUMENTS>
  `;

  try {
    // Gemini requires the first message in history to be from the 'user'.
    let firstUserIndex = history.findIndex(h => h.role === 'user');
    const filteredHistory = firstUserIndex !== -1 ? history.slice(firstUserIndex) : [];

    const contents: any[] = filteredHistory.map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await runWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-pro-preview", // Maximum legal reasoning precision
      contents,
      config: {
        systemInstruction,
        temperature: 0.0, // Zero temperature for pure factual/legal consistency
      },
    }));

    return response.text;
  } catch (error) {
    console.error("Gemini API Error (Commercial Counsel):", error);
    throw error;
  }
}
