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

    const ai = getAI();
    const model = ai.models.generateContent({
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
    
  if (!referenceNumber) {
    return res.status(400).json({ error: "Reference Number is required" });
  }

  // Clean reference number (remove spaces/hyphens)
  const cleanRef = referenceNumber.replace(/[^0-9]/g, '');
  
  if (cleanRef.length !== 14) {
    return res.status(400).json({ error: "Reference Number must be 14 digits" });
  }

  try {
    console.log(`Scraping LESCO bill for: ${cleanRef}`);
    
    // Special case for demo/testing
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
        monthWiseUnitsConsumed: "Jan: 300, Feb: 350, Mar: 450",
        monthWiseUnits: [
          { month: "FEB 25", units: 300, bill: 12000, adj: 0, payment: 12000 },
          { month: "MAR 25", units: 350, bill: 14000, adj: 0, payment: 14000 },
        ]
      });
    }

    const urls = [
      `https://bill.pitc.com.pk/lescobill/general?refno=${cleanRef}`,
      `http://bill.pitc.com.pk/lescobill/general?refno=${cleanRef}`,
      `http://www.lesco.gov.pk/Modules/CustomerBill/CheckBill.aspx?RefNo=${cleanRef}`,
    ];

    const uniqueUrls = [...new Set(urls)];
    let response: any = null;
    let lastError = "";

    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    ];

    try {
      const agent = new https.Agent({});

      response = await Promise.any(uniqueUrls.map(async (url, index) => {
        let attempts = 0;
        const maxAttempts = 2; 
        
        await new Promise(resolve => setTimeout(resolve, index * 200));

        while (attempts < maxAttempts) {
          try {
            attempts++;
            const res = await axios.get(url, {
              headers: {
                'User-Agent': userAgents[(index + attempts) % userAgents.length],
                'Accept': 'text/html,application/xhtml+xml,application/xml',
              },
              httpsAgent: agent,
              timeout: 15000 
            });

            const data = res.data.toString();

            if (data.includes("Reference Number Not Found") || data.includes("Invalid Reference Number") || data.includes("not found in our record")) {
              throw new Error("Reference Number not found");
            }
            if (data.includes("Consumer Name") || data.includes("NAME & ADDRESS")) {
              return res;
            } else {
              throw new Error("Invalid page content");
            }
          } catch (err: any) {
            if (attempts >= maxAttempts || err.message === "Reference Number not found") {
              throw err;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }));
    } catch (err: any) {
      if (err.name === 'AggregateError') {
        lastError = err.errors.map((e: any) => e.message).join(' | ');
      } else {
        lastError = err.message || "All LESCO portals are currently unresponsive";
      }
    }

    if (!response) {
      throw new Error(`LESCO servers are currently unresponsive (${lastError}). Please enter details manually.`);
    }

    const $ = cheerio.load(response.data);
    
    let consumerName = "Unknown Consumer";
    let address = "Address not found";
    
    const nameAddrTd = $(`td:contains("NAME & ADDRESS"), td:contains("Name & Address")`).next('td');
    if (nameAddrTd.length) {
      const text = nameAddrTd.text().trim();
      const parts = text.split('\\n').map(p => p.trim()).filter(p => p);
      if (parts[0]) consumerName = parts[0];
    }
    
    let amountDue = parseInt($(`td:contains("TOTAL PAYABLE"), td:contains("Payable")`).next('td').text().replace(/[^0-9]/g, '')) || 0;

    res.json({
      consumerName,
      address,
      referenceNumber: cleanRef,
      amountDue
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default app;
