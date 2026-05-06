import express from "express";
import axios from "axios";
import https from "https";
import * as cheerio from "cheerio";
import { GoogleGenAI, Type } from "@google/genai";
import multer from 'multer';

const app = express();
app.use(express.json({ limit: '50mb' }));

// Initialize AI lazily
let _ai: any = null;
function getAI() {
  if (!_ai) {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not configured. Please add your GEMINI_API_KEY in the AI Studio Settings/Secrets panel.");
    }
    
    const trimmedKey = key.trim();
    if (trimmedKey === "" || trimmedKey.includes("YOUR_API_KEY") || trimmedKey === "MY_GEMINI_API_KEY" || trimmedKey.length < 10) {
      throw new Error("The GEMINI_API_KEY provided appears to be invalid or a placeholder (" + trimmedKey + "). Please generate a valid API key from Google AI Studio and update your secrets.");
    }
    
    _ai = new GoogleGenAI({ apiKey: trimmedKey });
  }
  return _ai;
}

const upload = multer({ storage: multer.memoryStorage() });

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const formatGeminiError = (e: any): string => {
  let errorMsg = e?.message || String(e);
  if (errorMsg.includes("API key not valid") || errorMsg.includes("API_KEY_INVALID")) {
    return "The GEMINI_API_KEY provided is not valid. Please check your API key in the AI Studio Settings/Secrets panel and ensure it is correct.";
  }
  if (typeof errorMsg === 'string' && errorMsg.startsWith('{')) {
    try {
      const parsed = JSON.parse(errorMsg);
      if (parsed.error && parsed.error.message) {
        return parsed.error.message;
      }
    } catch (e2) {}
  }
  return errorMsg;
};

app.post("/api/extract-bill", async (req, res) => {
  try {
    const { base64Data } = req.body;
    if (!base64Data) return res.status(400).json({ error: "Missing image data" });

    const genAI = getAI();
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
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

    const result = await model.generateContent([
      { inlineData: { mimeType: "image/jpeg", data: base64Data } },
      { text: `Extract the following details from this electricity bill image into a valid JSON object.
=== FIELDS TO EXTRACT ===
- referenceNumber, consumerName, address, sanctionedLoad, customerId, tariff, billingMonth, currentBill, deferredAmount, presentReading, previousReading, meterNoOnBill, subDivisionName, feederName, meterStatus, monthWiseUnits
RULES: If a field is missing, use "N/A". Return ONLY the JSON object.` }
    ]);

    const response = await result.response;
    const text = response.text();
    
    if (!text) {
      throw new Error("The AI model returned an empty response. Please try with a clearer image.");
    }
    
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.substring(7);
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();
    if (cleanText === 'undefined' || cleanText === 'null' || cleanText === '') {
      throw new Error("The AI model returned an invalid response format.");
    }

    try {
      res.json(JSON.parse(cleanText));
    } catch (parseErr) {
      console.error("JSON Parse Error on text:", cleanText);
      res.status(500).json({ 
        error: "The AI returned data in an invalid format.",
        raw: cleanText.substring(0, 500)
      });
    }
  } catch (e: any) {
    console.error("Extraction error:", e);
    res.status(500).json({ error: formatGeminiError(e) });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) return res.status(400).json({ error: "No input provided" });

    const genAI = getAI();
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: "You are an expert assistant. You help users with billing issues, detection procedures, and using the application. Be professional, helpful, and concise."
    });
    
    const result = await model.generateContent(input.trim());
    const response = await result.response;
    res.json({ text: response.text() });
  } catch (error: any) {
    console.error("Chat error:", error);
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt provided" });

    const genAI = getAI();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt.trim());
    const response = await result.response;
    res.json({ text: response.text() });
  } catch (error: any) {
    console.error("Generate error:", error);
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

app.post("/api/fetch-bill", async (req, res) => {
  const { referenceNumber } = req.body;
  if (!referenceNumber) return res.status(400).json({ error: "Reference Number is required" });
  const cleanRef = referenceNumber.replace(/[^0-9]/g, '');
  if (cleanRef.length !== 14) return res.status(400).json({ error: "Reference Number must be 14 digits" });

  try {
    console.log(`Scraping LESCO bill (Vercel) for: ${cleanRef}`);
    
    // Demo cases
    const demoRefs = ['00000000000000', '11111111111111', '22222222222222', '33333333333333'];
    if (demoRefs.includes(cleanRef)) {
      return res.json({
        consumerName: `DEMO CONSUMER (${cleanRef})`,
        address: "123 LESCO Street, Gulberg III, Lahore",
        referenceNumber: cleanRef,
        unitsConsumed: 450,
        amountDue: 15420,
        billingMonth: "FEB 2026",
        sanctionedLoad: "5 kW",
        connectionType: "A1-R",
        currentBill: 15000,
        deferredAmount: 420,
        previousReading: "12050",
        monthWiseUnitsConsumed: "Jan: 300, Feb: 350, Mar: 450"
      });
    }

    const urls = [
      `https://bill.pitc.com.pk/lescobill/general?refno=${cleanRef}`,
      `http://bill.pitc.com.pk/lescobill/general?refno=${cleanRef}`,
      `http://pitc.com.pk:36247/lescobill/general?refno=${cleanRef}`,
      `http://bill.pitc.com.pk:36247/lescobill/general?refno=${cleanRef}`,
    ];

    let response: any = null;
    const agent = new https.Agent({});

    try {
      response = await Promise.any(urls.map(url => 
        axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' },
          httpsAgent: agent,
          timeout: 10000
        }).then(res => {
          if (res.data.toString().includes("Consumer Name") || res.data.toString().includes("NAME & ADDRESS")) return res;
          throw new Error("Invalid content");
        })
      ));
    } catch (err) {
      throw new Error("All LESCO portals are currently unresponsive. Please enter details manually.");
    }

    if (!response) throw new Error("Failed to fetch bill data.");

    const $ = cheerio.load(response.data);
    
    const getTextByLabel = (label: string) => {
      let val = "";
      $(`td:contains("${label}")`).each((i, el) => {
        val = $(el).next().text().trim();
        if (val) return false;
      });
      return val;
    };

    let consumerName = "";
    let address = "";
    const nameAddrTd = $(`td:contains("NAME & ADDRESS")`).next('td');
    if (nameAddrTd.length) {
      const text = nameAddrTd.text().trim();
      const parts = text.split('\n').map(p => p.trim()).filter(p => p);
      consumerName = parts[0] || "";
      address = parts.slice(1).join(', ') || "";
    }

    if (!consumerName) consumerName = getTextByLabel("NAME") || "Unknown";
    if (!address) address = getTextByLabel("ADDRESS") || "Address not found";

    const billData = {
      consumerName: consumerName,
      address: address,
      referenceNumber: cleanRef,
      unitsConsumed: parseInt((getTextByLabel("UNITS CONSUMED") || "0").replace(/[^0-9]/g, '')) || 0,
      amountDue: parseInt((getTextByLabel("TOTAL PAYABLE") || "0").replace(/[^0-9]/g, '')) || 0,
      billingMonth: getTextByLabel("BILLING MONTH") || "N/A",
      sanctionedLoad: getTextByLabel("LOAD") || "N/A",
      connectionType: getTextByLabel("TARIFF") || "N/A",
      customerId: getTextByLabel("CONSUMER ID") || "N/A",
      currentBill: parseInt(getTextByLabel("CURRENT BILL").replace(/[^0-9]/g, '')) || 0,
      previousReading: getTextByLabel("PREVIOUS READING") || "N/A",
    };

    res.json(billData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default app;
