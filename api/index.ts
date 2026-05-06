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
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("Gemini API Key is not configured.");
    }
    _ai = new GoogleGenAI({ apiKey: key });
  }
  return _ai;
}

const upload = multer({ storage: multer.memoryStorage() });

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/extract-bill", async (req, res) => {
  try {
    const { base64Data } = req.body;
    if (!base64Data) return res.status(400).json({ error: "Missing image data" });

    const model = getAI().models.generateContent({
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

    const result = await model;
    const cleanText = result.text;
    if (!cleanText || cleanText.trim() === 'undefined') {
      throw new Error("The AI model returned an empty or invalid response.");
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
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { input } = req.body;
    const result = await getAI().models.generateContent({ 
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: input.trim() }] }],
      config: {
        systemInstruction: "You are an expert assistant. Be professional, helpful, and concise."
      }
    });
    res.json({ text: result.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    const result = await getAI().models.generateContent({ 
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    res.json({ text: result.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/fetch-bill", async (req, res) => {
  const { referenceNumber } = req.body;
  if (!referenceNumber) return res.status(400).json({ error: "Reference Number is required" });
  const cleanRef = referenceNumber.replace(/[^0-9]/g, '');

  try {
    const url = `https://bill.pitc.com.pk/lescobill/general?refno=${cleanRef}`;
    const agent = new https.Agent({
      // rejectUnauthorized: false - removed for security
    });
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      httpsAgent: agent,
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    // Simplified scraping logic for the proxy
    const consumerName = $(`td:contains("NAME & ADDRESS")`).next('td').text().trim().split('\n')[0] || "Unknown";
    const amountDue = parseInt($(`td:contains("TOTAL PAYABLE")`).next('td').text().replace(/[^0-9]/g, '')) || 0;

    res.json({
      consumerName,
      amountDue,
      referenceNumber: cleanRef,
      // ... include other fields if needed, or stick to essential for proxy
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default app;
