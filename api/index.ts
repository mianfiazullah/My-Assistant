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
    const key = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_KEY || process.env.api_key;
    if (!key || key === "MY_GEMINI_API_KEY" || key === "") {
      const errorMsg = "Gemini API Key is not configured. " + 
        (process.env.VERCEL ? "Please add GEMINI_API_KEY (or API_KEY) to your Vercel Project Environment Variables." : "Please add your GEMINI_API_KEY in the AI Studio Secrets panel.");
      throw new Error(errorMsg);
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
    if (!result || !result.text) {
      throw new Error("The AI model returned an empty response. Please try with a clearer image.");
    }
    
    const cleanText = result.text.trim();
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
    res.status(500).json({ error: e?.message || "Internal Extraction Error" });
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
