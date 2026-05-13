export const Type = {
  OBJECT: 'object',
  ARRAY: 'array',
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean'
};

export const ai = {
  models: {
    generateContent: async (params: any) => {
      const response = await fetch('/api/gemini/generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const error = new Error(errData.error || `Gemini API Proxy Error: ${response.status} ${response.statusText}`);
        (error as any).status = response.status;
        throw error;
      }

      const data = await response.json();
      return data;
    },
    interactions: {
      create: async (params: any) => {
        const response = await fetch('/api/gemini/createInteraction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const error = new Error(errData.error || `Gemini Interaction Error: ${response.status} ${response.statusText}`);
          (error as any).status = response.status;
          throw error;
        }

        const data = await response.json();
        return data;
      }
    }
  }
};

export async function runWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isQuotaError = error?.message?.includes("quota") || error?.message?.includes("429") || error?.status === "RESOURCE_EXHAUSTED";
    const isServerError = error?.status === 500 || error?.status === "Internal Server Error" || error?.message?.includes("500");
    if ((isQuotaError || isServerError) && retries > 0) {
      console.warn(`API Error (Quota/500). Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return runWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  console.warn('[Embedding] Skipping API call — embedding model not available for this key. Using dummy vector.');
  return [];
}
