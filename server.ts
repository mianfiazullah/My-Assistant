import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import https from "https";
import * as cheerio from "cheerio";
import admin from 'firebase-admin';
import multer from 'multer';
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize AI lazily
let _ai: any = null;
function getAI() {
  if (!_ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    _ai = new GoogleGenAI({ apiKey: key });
  }
  return _ai;
}

// Initialize Firebase Admin lazily
let bucket: any;
try {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket: 'gen-lang-client-0432558200.firebasestorage.app'
    });
    console.log('Firebase Admin initialized successfully');
  }
  bucket = admin.storage().bucket();
} catch (error: any) {
  console.error('Firebase Admin initialization failed:', error.message);
  console.warn('Server will continue without Firebase Admin features (Upload Proxy will fail)');
}

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  console.log('Starting server initialization...');
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // GEMINI ROUTES
  app.post("/api/extract-bill", async (req, res) => {
    try {
      const { base64Data, model = "gemini-3-flash-preview" } = req.body;
      if (!base64Data) return res.status(400).json({ error: "Missing image data" });

      const response = await getAI().models.generateContent({
        model,
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
      res.json(JSON.parse(text));
    } catch (e: any) {
      console.error("Extraction error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { input } = req.body;
      if (!input) return res.status(400).json({ error: "No input provided" });

      const response = await getAI().models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: input.trim() }] }],
        config: {
          systemInstruction: "You are an expert assistant. You help users with billing issues, detection procedures, and using the application. Be professional, helpful, and concise.",
        }
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/generate", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "No prompt provided" });

      const response = await getAI().models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Generate error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload Proxy Route
  app.post("/api/upload", upload.single('file'), async (req, res) => {
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

  // Real LESCO Bill Scraping Endpoint
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
            { month: "APR 25", units: 450, bill: 18000, adj: 0, payment: 18000 },
            { month: "MAY 25", units: 400, bill: 16000, adj: 0, payment: 16000 },
            { month: "JUN 25", units: 500, bill: 20000, adj: 0, payment: 20000 },
            { month: "JUL 25", units: 600, bill: 24000, adj: 0, payment: 24000 },
            { month: "AUG 25", units: 550, bill: 22000, adj: 0, payment: 22000 },
            { month: "SEP 25", units: 480, bill: 19000, adj: 0, payment: 19000 },
            { month: "OCT 25", units: 420, bill: 17000, adj: 0, payment: 17000 },
            { month: "NOV 25", units: 380, bill: 15000, adj: 0, payment: 15000 },
            { month: "DEC 25", units: 320, bill: 13000, adj: 0, payment: 13000 },
            { month: "JAN 26", units: 310, bill: 12500, adj: 0, payment: 12500 },
            { month: "FEB 26", units: 450, bill: 15000, adj: 0, payment: 15000 },
          ]
        });
      }

      const urls = [
        `https://bill.pitc.com.pk/lescobill/general?refno=${cleanRef}`,
        `http://bill.pitc.com.pk/lescobill/general?refno=${cleanRef}`,
        `http://pitc.com.pk:36247/lescobill/general?refno=${cleanRef}`,
        `http://pitc.com.pk/lescobill/general?refno=${cleanRef}`,
        `http://bill.pitc.com.pk:36247/lescobill/general?refno=${cleanRef}`,
        `http://www.lesco.gov.pk:36247/lescobill/general?refno=${cleanRef}`,
        `http://103.226.216.244:36247/lescobill/general?refno=${cleanRef}`,
        `http://103.226.216.244/lescobill/general?refno=${cleanRef}`,
        `http://103.226.216.2/lescobill/general?refno=${cleanRef}`,
        `http://103.226.216.2:36247/lescobill/general?refno=${cleanRef}`,
        `http://103.85.131.210/lescobill/general?refno=${cleanRef}`,
        `http://103.85.131.210:36247/lescobill/general?refno=${cleanRef}`,
        `http://www.lesco.gov.pk/Modules/CustomerBill/CheckBill.aspx?RefNo=${cleanRef}`,
        `https://www.lesco.gov.pk/Modules/CustomerBill/CheckBill.aspx?RefNo=${cleanRef}`,
        `http://103.85.131.210/Modules/CustomerBill/CheckBill.aspx?RefNo=${cleanRef}`,
        `https://lesco.com.pk/Modules/CustomerBill/CheckBill.aspx?RefNo=${cleanRef}`,
        `http://lesco.com.pk/Modules/CustomerBill/CheckBill.aspx?RefNo=${cleanRef}`,
        `http://lesco.gov.pk/Modules/CustomerBill/CheckBill.aspx?RefNo=${cleanRef}`,
        `http://103.226.216.244/Modules/CustomerBill/CheckBill.aspx?RefNo=${cleanRef}`,
        `http://103.226.216.2/Modules/CustomerBill/CheckBill.aspx?RefNo=${cleanRef}`,
      ];

      // Remove duplicates
      const uniqueUrls = [...new Set(urls)];
      
      let response: any = null;
      let lastError = "";

      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0'
      ];

      // Try fetching from all URLs in parallel with staggered starts
      try {
        console.log(`Starting parallel fetch for reference: ${cleanRef} with ${uniqueUrls.length} mirrors`);
        
        const agent = new https.Agent({
          rejectUnauthorized: false
        });

        response = await Promise.any(uniqueUrls.map(async (url, index) => {
          let attempts = 0;
          const maxAttempts = 2; 
          
          // Add a small staggered delay for each mirror to avoid being flagged
          await new Promise(resolve => setTimeout(resolve, index * 200));

          while (attempts < maxAttempts) {
            try {
              attempts++;
              
              const res = await axios.get(url, {
                headers: {
                  'User-Agent': userAgents[(index + attempts) % userAgents.length],
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                  'Accept-Language': 'en-US,en;q=0.9',
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache',
                  'Connection': 'keep-alive',
                },
                httpsAgent: agent,
                timeout: 30000 // Increased from 15s to 30s
              });

              const data = res.data.toString();

              if (data.includes("Reference Number Not Found") || data.includes("Invalid Reference Number") || data.includes("Record Not Found") || data.includes("not found in our record")) {
                throw new Error("Reference Number not found");
              }

              if (data.includes("busy") || data.includes("Too many requests") || data.includes("try again later") || data.includes("Service Unavailable") || data.includes("Server Error")) {
                throw new Error("Portal is busy");
              }

              if (data.includes("Consumer Name") || data.includes("NAME & ADDRESS") || data.includes("Reference No") || data.includes("BILLING MONTH") || data.includes("LESCO BILL")) {
                console.log(`Successfully fetched from: ${url} (Attempt ${attempts})`);
                return res;
              } else {
                throw new Error("Invalid page content or portal busy");
              }
            } catch (err: any) {
              if (attempts >= maxAttempts || err.message === "Reference Number not found") {
                throw err;
              }
              // Wait a bit before retry
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }));
      } catch (err: any) {
        // Promise.any throws AggregateError if all fail
        if (err.name === 'AggregateError') {
          lastError = err.errors.map((e: any) => e.message).join(' | ');
        } else {
          lastError = err.message || "All LESCO portals are currently unresponsive";
        }
        console.error(`All parallel fetches failed for ${cleanRef}: ${lastError}`);
      }

      if (!response) {
        const errorMsg = lastError.includes('timeout') 
          ? "LESCO servers took too long to respond. This usually happens during peak hours. Please try again in a few minutes or enter details manually."
          : `LESCO servers are currently unresponsive (${lastError}). Please enter details manually.`;
        throw new Error(errorMsg);
      }

      const $ = cheerio.load(response.data);
      
      // Improved extraction logic for PITC/LESCO layout
      const getTextByLabel = (label: string) => {
        const lowerLabel = label.toLowerCase();
        let val = "";
        
        $('*').each((i, el) => {
          const text = $(el).text().trim().toLowerCase();
          if (text === lowerLabel || text.startsWith(lowerLabel + ':') || text.startsWith(lowerLabel + ' :')) {
            // Try next sibling
            val = $(el).next().text().trim();
            if (!val) {
              // Try parent's last child
              val = $(el).parent().children().last().text().trim();
            }
            // If the value is still the label or empty, try to find in the same row
            if (!val || val.toLowerCase() === lowerLabel) {
              val = $(el).closest('tr').find('td').last().text().trim();
            }
            if (val && val.toLowerCase() !== lowerLabel) return false; // break
          }
        });

        // Fallback: search for label anywhere and get next text node
        if (!val) {
          $(`td:contains("${label}")`).each((i, el) => {
            const nextText = $(el).next().text().trim();
            if (nextText) {
              val = nextText;
              return false;
            }
          });
        }

        return val;
      };

      // Specific logic for Name & Address which is often in a larger block
      let consumerName = "";
      let address = "";
      
      const nameAddrTd = $(`td:contains("NAME & ADDRESS"), td:contains("Name & Address")`).next('td');
      if (nameAddrTd.length) {
        const text = nameAddrTd.text().trim();
        const parts = text.split('\n').map(p => p.trim()).filter(p => p);
        consumerName = parts[0] || "";
        address = parts.slice(1).join(', ') || "";
      }

      if (!consumerName) consumerName = getTextByLabel("NAME") || getTextByLabel("Consumer Name") || "Unknown Consumer";
      if (!address) address = getTextByLabel("ADDRESS") || "Address not found";

      const monthWiseUnits: { month: string, units: number, bill?: number, adj?: number, payment?: number }[] = [];
      $('table').each((i, table) => {
        const text = $(table).text().toUpperCase();
        if (text.includes('MONTH') && text.includes('UNITS')) {
          $(table).find('tr').each((j, tr) => {
            const tds = $(tr).find('td');
            // LESCO historical table usually has: Month, Units, Bill, Adj, Payment, Balance
            if (tds.length >= 2) {
              const month = $(tds[0]).text().trim();
              const unitsText = $(tds[1]).text().replace(/[^0-9]/g, '');
              const units = parseInt(unitsText);
              
              if (month && month.length >= 3 && month.length <= 6 && !isNaN(units)) {
                const entry: any = { month, units };
                
                if (tds.length >= 3) {
                  const billText = $(tds[2]).text().replace(/[^0-9]/g, '');
                  if (billText) entry.bill = parseInt(billText);
                }
                if (tds.length >= 4) {
                  const adjText = $(tds[3]).text().replace(/[^0-9-]/g, '');
                  if (adjText) entry.adj = parseInt(adjText);
                }
                if (tds.length >= 5) {
                  const paymentText = $(tds[4]).text().replace(/[^0-9]/g, '');
                  if (paymentText) entry.payment = parseInt(paymentText);
                }
                
                if (monthWiseUnits.length < 24) { // Limit to 2 years of history
                  monthWiseUnits.push(entry);
                }
              }
            }
          });
        }
      });

      // Sort by month if possible, or just keep as is
      // LESCO tables are usually reverse chronological

      const billData = {
        consumerName: consumerName,
        address: address,
        referenceNumber: cleanRef,
        unitsConsumed: parseInt((getTextByLabel("UNITS CONSUMED") || getTextByLabel("Units") || "0").replace(/[^0-9]/g, '')) || 0,
        amountDue: parseInt((getTextByLabel("TOTAL PAYABLE") || getTextByLabel("Payable") || "0").replace(/[^0-9]/g, '')) || 0,
        billingMonth: getTextByLabel("BILLING MONTH") || getTextByLabel("Month") || "N/A",
        sanctionedLoad: getTextByLabel("LOAD") || getTextByLabel("SANCTIONED LOAD") || getTextByLabel("SANC LOAD") || "N/A",
        connectionType: getTextByLabel("TARIFF") || "N/A",
        customerId: getTextByLabel("CONSUMER ID") || getTextByLabel("CUSTOMER ID") || getTextByLabel("CONS ID") || "N/A",
        currentBill: parseInt(getTextByLabel("CURRENT BILL").replace(/[^0-9]/g, '')) || 0,
        deferredAmount: parseInt(getTextByLabel("DEFERRED AMOUNT").replace(/[^0-9]/g, '')) || parseInt(getTextByLabel("DEFERRED").replace(/[^0-9]/g, '')) || 0,
        previousReading: getTextByLabel("PREVIOUS READING") || getTextByLabel("PREV RDG") || getTextByLabel("PREVIOUS") || "N/A",
        meterNoOnBill: getTextByLabel("METER NO") || getTextByLabel("METER NUMBER") || "N/A",
        feederName: getTextByLabel("FEEDER") || getTextByLabel("FEEDER NAME") || "N/A",
        monthWiseUnitsConsumed: getTextByLabel("MONTH WISE UNITS CONSUMED") || "N/A",
        monthWiseUnits: monthWiseUnits.length > 0 ? monthWiseUnits : undefined,
      };

      // Final check - if we got nothing, it's a failure
      if (billData.consumerName === "Unknown" && billData.amountDue === 0) {
        console.error("Scraping failed: No data extracted from portal");
        throw new Error("Could not parse bill data. The portal structure might have changed.");
      }

      console.log(`Sending bill data for ref: ${cleanRef}, units: ${billData.monthWiseUnits?.length || 0}`);
      res.json(billData);
    } catch (error: any) {
      console.error("Scraping error:", error.message);
      
      res.status(500).json({ 
        error: error.message || "Failed to fetch actual bill data.",
        details: error.stack
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const buildPath = path.join(process.cwd(), 'dist');
    app.use(express.static(buildPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(buildPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> Server is listening on port ${PORT}`);
    console.log(`>>> Local URL: http://localhost:${PORT}`);
    console.log(`>>> Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(err => {
  console.error('FATAL: Server failed to start:', err);
  process.exit(1);
});
