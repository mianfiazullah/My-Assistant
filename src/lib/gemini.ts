import { GoogleGenAI, Type } from "@google/genai";

let _ai: any = null;
function getAI() {
  if (!_ai) {
    const key = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
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

  console.log(`Extracting bill data via Client SDK. Image data length: ${base64Data.length}`);

  try {
    const ai = getAI();
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64Data } },
            { text: `Extract the following details from this electricity bill image into a valid JSON object.
          
=== FIELDS TO EXTRACT ===
- referenceNumber: exact 14 digits (often in a prominent box)
- consumerName: full name
- address: full address
- sanctionedLoad: e.g., "1.00 kW"
- customerId: e.g., "01-12345-6789123"
- tariff: e.g., "A-1a(01)"
- billingMonth: month and year, e.g., "MAR 26"
- consumedUnits: number only (Total units consumed in this month)
- currentBill: numeric value only (preserve decimals, e.g. 36032.31)
- deferredAmount: numeric value only (preserve decimals, e.g. 0.00)
- presentReading: number only
- previousReading: number only
- meterNoOnBill: serial number
- subDivisionName: e.g., "FATEH SHER"
- feederName: e.g., "CIVIL LINES"
- meterStatus: e.g., "NORMAL"
- monthWiseUnits: Array of { month, reading, units, bill, adj, payment } (extract last 12-13 months if table present. IMPORTANT: If 'DF' or 'Est. Def.' or any alphabetic prefix/suffix is present with the reading or units, you MUST include it in the 'reading' OR 'units' string, e.g., "DF 81" or "81 DF").

=== RULES ===
- If a field is missing, use "N/A".
- The "consumedUnits" field is very important. It is usually labeled as "Units" or "Consumed Units" for the current billing month.
- Return ONLY the JSON object. Do not include any commentary or other text.` }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            referenceNumber: { type: Type.STRING },
            consumerName: { type: Type.STRING },
            address: { type: Type.STRING },
            sanctionedLoad: { type: Type.STRING },
            customerId: { type: Type.STRING },
            tariff: { type: Type.STRING },
            billingMonth: { type: Type.STRING },
            consumedUnits: { type: Type.STRING },
            currentBill: { type: Type.STRING },
            deferredAmount: { type: Type.STRING },
            presentReading: { type: Type.STRING },
            previousReading: { type: Type.STRING },
            meterNoOnBill: { type: Type.STRING },
            subDivisionName: { type: Type.STRING },
            feederName: { type: Type.STRING },
            meterStatus: { type: Type.STRING },
            monthWiseUnits: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  month: { type: Type.STRING },
                  reading: { type: Type.STRING },
                  units: { type: Type.STRING },
                  bill: { type: Type.STRING },
                  adj: { type: Type.STRING },
                  payment: { type: Type.STRING },
                }
              }
            }
          }
        }
      }
    });

    const text = result.text;
    if (!text) throw new Error("No response generated from Gemini API");
    
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn("Failed to parse JSON result directly, attempting cleanup", text);
      const cleaned = text.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
      return JSON.parse(cleaned);
    }
  } catch (error: any) {
    console.error("Extraction API Error:", error);
    throw new Error(error.message || "Failed to extract bill data");
  }
}

export async function chatWithGemini(input: string) {
  try {
    const ai = getAI();
    const result = await ai.models.generateContent({ 
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: input.trim() }] }],
      config: {
        systemInstruction: "You are an expert assistant. You help users with billing issues, detection procedures, and using the application. Be professional, helpful, and concise."
      }
    });
    return result.text;
  } catch (error: any) {
    console.error("Chat API Error:", error);
    throw new Error(error.message || "Failed to get chat response");
  }
}

export async function generateGeminiContent(prompt: string) {
  try {
    const ai = getAI();
    const result = await ai.models.generateContent({ 
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return result.text;
  } catch (error: any) {
    console.error("Generate API Error:", error);
    throw new Error(error.message || "Failed to generate content");
  }
}

