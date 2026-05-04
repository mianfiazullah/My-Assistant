import { GoogleGenAI, Type } from "@google/genai";

export async function extractBillData(base64Image: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in the environment.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = "gemini-3-flash-preview";
  
  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  if (base64Data.length < 100) {
    throw new Error("Invalid image data. The image might be too small or corrupted.");
  }

  console.log(`Extracting bill data using frontend. Image data length: ${base64Data.length} characters.`);

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Data } },
          { text: `Extract the following details from this electricity bill image into the specified JSON format.
            
=== FIELDS TO EXTRACT ===
- Reference Number (14 digits, usually found in a box at the top)
- Consumer Name (Found under "NAME AND ADDRESS")
- Address (Found under "NAME AND ADDRESS")
- Sanctioned Load (Look for "SANCTIONED LOAD" or "S.LOAD", e.g., "1.00 kW")
- Customer ID (Found near the reference number)
- Tariff (e.g., "A-1a(01)")
- Billing Month (CRITICAL: Look for "BILLING MONTH" or "MONTH". Extract exactly what is printed, e.g., "FEB 26" or "MAR 2026".)
- PAYABLE WITHIN DUE DATE (The total amount due for the current month, number only)
- Deferred Amount (If any, number only)
- Previous Reading (The reading from the previous month, number only)
- Present Reading (The current reading, number only)
- Meter Number (The serial number of the meter)
- Sub Division Name (Look for "SUB DIVISION" or "S/DIV")
- Feeder Name with Code (Look for "FEEDER" or "FEEDER NAME")
- Meter Status (Look for "METER STATUS" or "STATUS")
- Month-wise history (A table of the last 12-13 months. Extract: Month, Units, Bill/Amount, ADJ, Payment).

=== RULES ===
- Use "N/A" for missing fields.
- Amounts and Units must be numbers only.
- For the ADJ column, extract the numeric value (e.g., "+35" becomes 35).
- Extract data exactly as written on the bill.
- Return ONLY the JSON object.` }
        ]
      },
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
          required: ["referenceNumber", "consumerName", "address"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini");
    
    return JSON.parse(text);
  } catch (err: any) {
    console.error("Gemini Extraction Error:", err);
    throw new Error(`AI Extraction failed: ${err.message}`);
  }
}
