import { ai, runWithRetry } from './client';

export async function generateSolutionDiagram(description: string) {
  const prompt = `
    You are a Technical Architecture Illustrator. 
    Based on this description: "${description}", generate a clean, minimalist SVG representation of a network/solution diagram.
    
    CRITICAL STYLE RULES:
    1. Color Palette: Use ONLY #EAF0F2 (Pastel Blue), #EAF2EA (Pastel Sage), #1A1A1A (Black), and #FFFFFF (White).
    2. Style: Isometric technical schematic or flat engineering diagram.
    3. Typography: Do not include text in the SVG, use icons and shapes.
    4. Format: Return ONLY the raw SVG code. No explanations.
    5. Cleanliness: Keep it professional and high-level.
  `;

  try {
    const response = await runWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.1,
      },
    }));

    // Extract SVG if wrapped in markdown
    const text = response.text || "";
    const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/);
    return svgMatch ? svgMatch[0] : null;
  } catch (error) {
    console.error("Diagram Generation Error:", error);
    return null;
  }
}
