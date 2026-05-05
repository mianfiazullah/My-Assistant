import { GoogleGenAI, Type } from "@google/genai";

let _ai: any = null;
function getAI() {
  if (!_ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("Gemini API Key is not configured.");
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

  console.log(`Extracting bill data via Gemini API. Image data length: ${base64Data.length}`);

  try {
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Data } },
          { text: `Extract the following details from this electricity bill image into a valid JSON object.
=== FIELDS TO EXTRACT ===
- referenceNumber, consumerName, address, sanctionedLoad, customerId, tariff, billingMonth, currentBill, deferredAmount, presentReading, previousReading, meterNoOnBill, subDivisionName, feederName, meterStatus, monthWiseUnits
RULES: If a field is missing, use "N/A". Return ONLY the JSON object.` }
        ]
      }],
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
                  units: { type: Type.STRING },
                  bill: { type: Type.STRING },
                  adj: { type: Type.STRING },
                  payment: { type: Type.STRING },
                }
              }
            }
          },
          required: ["referenceNumber", "consumerName"],
        },
      },
    });

    const cleanText = (response.text || "").trim();
    if (!cleanText || cleanText === 'undefined' || !(cleanText.startsWith('{') || cleanText.startsWith('['))) {
      throw new Error("The AI model returned an empty or invalid response.");
    }
    
    try {
      return JSON.parse(cleanText);
    } catch (e) {
      console.error("Failed to parse Gemini response:", cleanText);
      throw new Error("Failed to parse AI response as JSON");
    }
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    throw new Error(error.message || "Failed to extract bill data");
  }
}

export async function chatWithGemini(input: string) {
  try {
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: input.trim() }] }],
      config: { systemInstruction: "You are an expert assistant. Be professional, helpful, and concise." }
    });
    return response.text;
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    throw new Error(error.message || "Failed to get chat response");
  }
}

export async function generateGeminiContent(prompt: string) {
  try {
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return response.text;
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    throw new Error(error.message || "Failed to generate content");
  }
}
