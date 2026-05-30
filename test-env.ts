import dotenv from "dotenv";
dotenv.config({ override: true });
console.log("SERVER ENV KEY:", process.env.GEMINI_API_KEY ? 'PRESENT' : 'MISSING');
