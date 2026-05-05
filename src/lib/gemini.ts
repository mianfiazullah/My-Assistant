import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function extractBillData(base64Image: string) {
  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  
  if (base64Data.length < 100) {
    throw new Error("Invalid image data. The image might be too small or corrupted.");
  }

  console.log(`Extracting bill data via Gemini. Image data length: ${base64Data.length}`);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
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
- currentBill: numeric value only
- deferredAmount: numeric value only (0 if not present)
- presentReading: number only
- previousReading: number only
- meterNoOnBill: serial number
- subDivisionName: e.g., "FATEH SHER"
- feederName: e.g., "CIVIL LINES"
- meterStatus: e.g., "NORMAL"
- monthWiseUnits: Array of { month, units, bill, adj, payment } (extract last 12-13 months if table present)

=== RULES ===
- If a field is missing, use "N/A".
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

    const text = response.text;
    if (!text) throw new Error("The AI model returned an empty response. Please try a clearer picture.");

    try {
      return JSON.parse(text);
    } catch (parseErr) {
      console.error("JSON Parse Error on text:", text);
      throw new Error("The AI returned data in an invalid format. Please try again.");
    }
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    throw new Error(error.message || "Failed to analyze image with AI.");
  }
}
