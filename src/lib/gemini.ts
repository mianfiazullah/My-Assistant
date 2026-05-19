import { GoogleGenAI, Type } from "@google/genai";

let _ai: any = null;
function getAI() {
  if (!_ai) {
    const key = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.API_KEY || '';
    if (!key && process.env.NODE_ENV !== 'development' && !(import.meta as any).env?.VITE_IN_AI_STUDIO) {
      console.warn("No Gemini API key found, but relying on browser/AI Studio proxy");
    }
    _ai = new GoogleGenAI({ apiKey: key });
  }
  return _ai;
}

export async function extractBillData(base64Image: string) {
  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  
  if (base64Data.length < 100) {
    throw new Error("Invalid image data. The image might be too small or corrupted.");
  }

  console.log(`Extracting bill data via API Proxy. Image data length: ${base64Data.length}`);

  try {
    const response = await fetch('/api/extract-bill', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base64Data: base64Data })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      let msg = errData.error;
      if (typeof msg === 'object' && msg !== null) {
        msg = msg.message || JSON.stringify(msg);
      }
      throw new Error(msg || `Server error: ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    console.error("Extraction API Error:", err);
    throw new Error(err.message || "Failed to contact extraction service.");
  }
}

export async function chatWithGemini(input: string) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: input })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      let msg = errData.error;
      if (typeof msg === 'object' && msg !== null) {
        msg = msg.message || JSON.stringify(msg);
      }
      throw new Error(msg || `Server error: ${response.status}`);
    }

    const data = await response.json();
    return data.text;
  } catch (error: any) {
    console.error("Chat API Error:", error);
    throw new Error(error.message || "Failed to get chat response");
  }
}

export async function generateGeminiContent(prompt: string) {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      let msg = errData.error;
      if (typeof msg === 'object' && msg !== null) {
        msg = msg.message || JSON.stringify(msg);
      }
      throw new Error(msg || `Server error: ${response.status}`);
    }

    const data = await response.json();
    return data.text;
  } catch (error: any) {
    console.error("Generate API Error:", error);
    throw new Error(error.message || "Failed to generate content");
  }
}

export async function translateToUrduAI(text: string) {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: `Translate or transliterate this English text to Urdu specifically for use in official legal/utility documents (FIR, Notice). 
        Rules:
        1. Return ONLY the Urdu text.
        2. NO English explanation.
        3. NO punctuation unless it's part of the translation.
        4. NO markdown bold or code blocks.
        5. Just the clean Urdu string.

        Text: ${text}` })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    let translated = data.text.trim();
    // Cleanup common AI prefixing/formatting
    translated = translated.replace(/^(Urdu translation|Translation|Urdu|Urdu:):\s*/i, '');
    translated = translated.replace(/[`*]+/g, ''); // Remove code blocks and bold markers
    return translated;
  } catch (error: any) {
    console.error("Translation API Error:", error);
    return null;
  }
}

