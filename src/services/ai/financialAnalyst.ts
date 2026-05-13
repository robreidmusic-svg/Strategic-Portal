import { ai, runWithRetry } from './client';

export async function chatWithFinancialAgent(message: string, history: { role: 'user' | 'model', text: string }[], inputs: any) {


  // We can just use the global 'ai' instance imported from client,
  const model = 'gemini-2.5-pro';

  const systemPrompt = `You are an expert Financial Model Analyst agent assisting a sales user.
The user is adjusting parameters in a financial model calculator and asking for advice.
Here are the current calculator inputs:
${JSON.stringify(inputs, null, 2)}

Your goal is to guide the user on what inputs (like contract term, MRC, NRC, or Capex) to adjust and by how much to hit their desired financial metrics (e.g. better payback period, higher EBITDA, or certain MOIC).
Give precise, actionable feedback. Suggest specific numerical adjustments when applicable.
Respond in a clean, professional, and slightly analytical tone. Include caveats when necessary.`;

  try {
    // Gemini requires the first message in history to be from the 'user'.
    // We skip any initial 'model' messages (like greetings).
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
      model,
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
      }
    }));

    return response.text || "No response received.";
  } catch (error) {
    console.error("Financial Chat Error:", error);
    return "Error communicating with the financial agent. Please try again.";
  }
}
