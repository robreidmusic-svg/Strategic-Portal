import { ai, runWithRetry } from './client';

export async function chatWithBrilliantBasics(message: string, history: { role: string, text: string }[], knowledgeBase: string) {
  const systemInstruction = `
    You are the "Brilliant Basics" Expert Agent for our business forecasting platform.
    Your sole focus is to help users with queries related to forecasting best practices and funnel hygiene based on the "Brilliant Basics" program documentation provided below.
    
    GUIDELINES:
    1. Only use information from the provided documentation.
    2. If a query is outside the scope of "Brilliant Basics" or the provided documentation, politely inform the user that you can only assist with "Brilliant Basics" guidelines.
    3. Be concise, authoritative, and helpful.
    4. Maintain a professional tone.
    5. Avoid hallucinations. If you don't know the answer based on the document, say so.
    
    DOCUMENTATION CONTENT:
    ${knowledgeBase}
  `;

  try {
    // Gemini requires the first message in history to be from the 'user'.
    let firstUserIndex = history.findIndex(h => h.role === 'user');
    const filteredHistory = firstUserIndex !== -1 ? history.slice(firstUserIndex) : [];

    const contents: any[] = filteredHistory.map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await runWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction,
        temperature: 0.2, // Lower temperature for more focused, factual responses
      },
    }));

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
