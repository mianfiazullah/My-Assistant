import express from "express";
import axios from "axios";
import https from "https";
import * as cheerio from "cheerio";
import { GoogleGenAI, Type } from "@google/genai";
import multer from 'multer';
import admin from "firebase-admin";
import { google } from "googleapis";

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize AI lazily
let _ai: any = null;
function getAI() {
  if (!_ai) {
    const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
    const config: any = {};
    if (key && key !== "MY_GEMINI_API_KEY") {
      config.apiKey = key;
    }
    _ai = new GoogleGenAI(config);
  }
  return _ai;
}

// Initialize Firebase Admin lazily
let _bucket: any = null;
let _firebaseAdminInitialized = false;

function getBucket() {
  if (!_firebaseAdminInitialized) {
    _firebaseAdminInitialized = true;
    try {
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          storageBucket: 'gen-lang-client-0432558200.firebasestorage.app'
        });
        console.log('Firebase Admin initialized successfully');
      }
      _bucket = admin.storage().bucket();
    } catch (error: any) {
      console.error('Firebase Admin initialization failed:', error.message);
      console.warn('Server will continue without Firebase Admin features (Upload Proxy will fail)');
    }
  }
  return _bucket;
}

const upload = multer({ storage: multer.memoryStorage() });

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/extract-bill", async (req, res) => {
  try {
    console.log(`[extract-bill] type of req.body: ${typeof req.body}, isArray: ${Array.isArray(req.body)}`);
    if (req.body) {
      console.log(`[extract-bill] req.body keys: ${Object.keys(req.body).join(", ")}`);
    }
    const { base64Data, image, model: requestedModel = "gemini-flash-latest" } = req.body || {};
    const imgData = image || base64Data;
    if (!imgData) {
      return res.status(400).json({ error: `Missing image data. Body keys: ${req.body ? Object.keys(req.body).join(", ") : 'none'}` });
    }

    const modelName = "gemini-flash-latest";
    const ai = getAI();
    
    console.log(`Analyzing bill using model: ${modelName}, data length: ${imgData.length}`);

    const result = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: imgData } },
            { text: `Extract all electricity bill details from this image into a JSON object.
        
=== IMPORTANT: ACCURACY ===
- DO NOT hallucinate values. If a number is unclear or NOT VISIBLE in the screenshot, use an empty string "" instead of "N/A" where possible, especially for numeric fields.
- DO NOT repeat values (like "55") across months if they are different on the bill.
- For historical tables, extract EXACTLY what is written in each row.
- Ensure the 'Month' and 'Year' match the table rows precisely (e.g., "MAR 25").
- SPECIFIC GUARD: The status code "SS" (Status Same) is frequently misread as "55". If you see "SS" or something looking like "55" in a column where it could be a status code (like Units or Reading), verify carefully. If it is a status code, output "SS".
- DO NOT fill in months that are not present in the image table. If only 10 months are visible, output only those 10 months.

=== MONTH WISE UNITS TABLE (CONSUMPTION DATA) ===
- If a value in the table is "N/A", empty, or unclear, use an empty string "" for that specific field (units, bill, adj, or payment). 
- DO NOT combine multiple fields into one. Each field must be its own value in the object.
- If a row is partially unreadable, still extract the readable parts (like Month and Units).

=== FIELDS TO EXTRACT ===
- referenceNumber: exact 14 digits
- consumerName: full name
- address: full address
- sanctionedLoad: e.g., "1.00 kW"
- customerId: e.g., "01-12345-6789123"
- tariff: e.g., "A-1a(01)"
- billingMonth: month and year, e.g., "MAR 26"
- consumedUnits: Total units consumed this month
- currentBill: monthly bill amount
- deferredAmount: deferred amount if any
- presentReading: latest index reading
- previousReading: previous index reading
- meterNoOnBill: meter serial number
- subDivisionName: e.g., "FATEH SHER"
- feederName: e.g., "CIVIL LINES"
- meterStatus: e.g., "NORMAL"
- monthWiseUnits: Array of { month, reading, units, bill, adj, payment }
  (Extract from the consumption history table. Usually 12-13 months are visible.
   Columns are usually: Month, Units, Bill, Adj, Payment/Balance.
   If 'DF', 'SS', or 'Est. Def.' is present with a value, include it, e.g., "DF 81").

=== RESPONSE ===
Return ONLY JSON.` }
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
          },
          required: ["referenceNumber", "consumerName"],
        },
      },
    });

    const cleanText = (result.text || '').trim();
    if (!cleanText || cleanText === 'undefined') throw new Error("The AI model returned an empty response. Please try a clearer picture.");
    
    try {
      let jsonStr = cleanText;
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json/, '');
        jsonStr = jsonStr.replace(/```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```/, '');
        jsonStr = jsonStr.replace(/```$/, '');
      }
      jsonStr = jsonStr.trim();
      
      const parsed = JSON.parse(jsonStr);
      res.json(parsed);
    } catch (parseErr) {
      console.error("JSON Parse Error on text:", cleanText);
      res.status(500).json({ 
        error: "The AI returned data in an invalid format.", 
        raw: cleanText.substring(0, 500) 
      });
    }
  } catch (e: any) {
    console.error("Extraction error:", e);
    let errorMsg = "";
    if (typeof e === 'string') {
      errorMsg = e;
    } else if (e?.message) {
      errorMsg = String(e.message);
    } else {
      try { errorMsg = JSON.stringify(e); } catch(_) { errorMsg = "Unknown error"; }
    }
    
    if (errorMsg.includes('API key not valid')) {
      errorMsg = 'Invalid Gemini API Key. Please update your API Key in the AI Studio platform or Vercel Environment Variables.';
    } else if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota')) {
      errorMsg = 'Gemini API Free Tier quota exceeded limit. Please wait and try again, or use the official LESCO fallback portal.';
    } else if (errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE') || errorMsg.includes('high demand') || errorMsg.includes('capacity')) {
      errorMsg = 'Google AI service is currently experiencing high demand and is unavailable. Please try again later, or use the official LESCO fallback portal.';
    } else if (errorMsg && errorMsg.includes('{') && errorMsg.includes('}')) {
      try {
        const jsonStart = errorMsg.indexOf('{');
        const jsonStr = errorMsg.substring(jsonStart);
        const parsed = JSON.parse(jsonStr);
        if (parsed.error?.message) {
          errorMsg = parsed.error.message;
        } else if (parsed.message) {
          errorMsg = parsed.message;
        }
      } catch (_) {}
    }
    // Handle the case where errorMsg itself is outputted as stringified JSON starting with {"error":
    if (errorMsg.startsWith('{"error"')) {
      try {
        const p = JSON.parse(errorMsg);
        if (p.error?.message) errorMsg = p.error.message;
      } catch(_) {}
    }
    res.status(500).json({ error: errorMsg });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) return res.status(400).json({ error: "No input provided" });

    const ai = getAI();
    const result = await ai.models.generateContent({ 
      model: "gemini-flash-latest",
      contents: [{ role: 'user', parts: [{ text: input.trim() }] }],
      config: {
        systemInstruction: "You are an expert assistant. You help users with billing issues, detection procedures, and using the application. Be professional, helpful, and concise."
      }
    });
    res.json({ text: result.text });
  } catch (error: any) {
    console.error("Chat error:", error);
    let errorMsg = "";
    if (typeof error === 'string') {
      errorMsg = error;
    } else if (error?.message) {
      errorMsg = String(error.message);
    } else {
      try { errorMsg = JSON.stringify(error); } catch(_) { errorMsg = "Unknown error"; }
    }

    if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota')) {
      errorMsg = 'Gemini API Free Tier quota exceeded. Please wait and try again.';
    } else if (errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE') || errorMsg.includes('high demand') || errorMsg.includes('capacity')) {
      errorMsg = 'Google AI service is currently experiencing high demand. Please try again later.';
    } else if (errorMsg.includes('{') && errorMsg.includes('}')) {
      try {
        const jsonStart = errorMsg.indexOf('{');
        const parsed = JSON.parse(errorMsg.substring(jsonStart));
        if (parsed.error?.message) {
          errorMsg = parsed.error.message;
        } else if (parsed.message) {
          errorMsg = parsed.message;
        }
      } catch (_) {}
    }
    if (errorMsg.startsWith('{"error"')) {
      try {
        const p = JSON.parse(errorMsg);
        if (p.error?.message) errorMsg = p.error.message;
      } catch(_) {}
    }
    res.status(500).json({ error: errorMsg });
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt provided" });

    const ai = getAI();
    const result = await ai.models.generateContent({ 
      model: "gemini-flash-latest",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    res.json({ text: result.text });
  } catch (error: any) {
    console.error("Generate error:", error);
    let errorMsg = "";
    if (typeof error === 'string') {
      errorMsg = error;
    } else if (error?.message) {
      errorMsg = String(error.message);
    } else {
      try { errorMsg = JSON.stringify(error); } catch(_) { errorMsg = "Unknown error"; }
    }

    if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota')) {
      errorMsg = 'Gemini API Free Tier quota exceeded. Please wait and try again.';
    } else if (errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE') || errorMsg.includes('high demand') || errorMsg.includes('capacity')) {
      errorMsg = 'Google AI service is currently experiencing high demand. Please try again later.';
    } else if (errorMsg.includes('{') && errorMsg.includes('}')) {
      try {
        const jsonStart = errorMsg.indexOf('{');
        const parsed = JSON.parse(errorMsg.substring(jsonStart));
        if (parsed.error?.message) {
          errorMsg = parsed.error.message;
        } else if (parsed.message) {
          errorMsg = parsed.message;
        }
      } catch (_) {}
    }
    if (errorMsg.startsWith('{"error"')) {
      try {
        const p = JSON.parse(errorMsg);
        if (p.error?.message) errorMsg = p.error.message;
      } catch(_) {}
    }
    res.status(500).json({ error: errorMsg });
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

// Upload Proxy Route
app.post("/api/upload", upload.single('file'), async (req, res) => {
  const bucket = getBucket();
  if (!bucket) {
    return res.status(500).json({ error: "Firebase Admin not initialized. Upload unavailable." });
  }
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const { template } = req.body;
  const file = req.file;
  const blob = bucket.file(`templates/${template}`);
  const blobStream = blob.createWriteStream({
    metadata: { contentType: file.mimetype }
  });

  blobStream.on('error', (err: any) => {
    res.status(500).json({ error: err.message });
  });

  blobStream.on('finish', async () => {
    try {
      const publicUrl = await blob.getSignedUrl({
        action: 'read',
        expires: '03-01-2500'
      });
      res.status(200).json({ url: publicUrl[0] });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to generate signed URL: " + err.message });
    }
  });

  blobStream.end(file.buffer);
});

// Google Sheets Helper
async function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error("Google Sheets credentials are not configured.");
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  return google.sheets({ version: "v4", auth });
}

app.post("/api/save-to-sheets", async (req, res) => {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) {
      return res.status(400).json({ error: "GOOGLE_SHEETS_ID is not configured." });
    }

    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ error: "No data provided to save." });
    }

    const sheets = await getSheetsClient();
    
    // Prepare row data - flatten the case object into an array
    // Order: Timestamp, Ref #, Name, Address, Billing Month, Units, Bill Amount, Sanctioned Load, Status
    const row = [
      new Date().toLocaleString(),
      data.referenceNumber || "N/A",
      data.consumerName || "N/A",
      data.address || "N/A",
      data.billingMonth || "N/A",
      data.consumedUnits || "0",
      data.currentBill || "0",
      data.sanctionedLoad || "N/A",
      data.meterStatus || "NORMAL"
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId, range: "Sheet1!A:I", // Appends to the first sheet
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [row],
      },
    });

    res.json({ success: true, message: "Data saved to Google Sheets successfully." });
  } catch (error: any) {
    console.error("Sheets Error:", error);
    res.status(500).json({ error: error.message || "Failed to save to Google Sheets." });
  }
});

// Proxy for Google Sheets Webhooks (GAS)
app.post("/api/webhook-proxy", async (req, res) => {
  try {
    const { webhookUrl, payload } = req.body;
    if (!webhookUrl) {
      return res.status(400).json({ error: "webhookUrl is required" });
    }

    const axios = (await import('axios')).default;
    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    res.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error("Webhook Proxy Error:", error);
    res.status(500).json({ error: error.message || "Failed to proxy webhook" });
  }
});

export default app;
