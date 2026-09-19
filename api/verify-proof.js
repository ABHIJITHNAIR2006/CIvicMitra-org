import { GoogleGenAI } from "@google/genai";

let genAIClient = null;
function getGenAI() {
  if (!genAIClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.error("[api/verify-proof] CRITICAL: GEMINI_API_KEY environment variable is missing from server process.env!");
      throw new Error("GEMINI_API_KEY environment variable is required on server.");
    }
    genAIClient = new GoogleGenAI({ apiKey: key });
  }
  return genAIClient;
}

const CANDIDATE_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];

async function generateContentWithTimeout(ai, model, contents, config, timeoutMs = 15000) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Model ${model} request timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      ai.models.generateContent({ model, contents, config }),
      timeoutPromise
    ]);
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function generateContentWithFallback(ai, contents, config) {
  let lastError = null;
  for (const model of CANDIDATE_MODELS) {
    const startCandidateTime = Date.now();
    console.log(`[${new Date().toISOString()}] [api/verify-proof] Trying candidate model: ${model}`);
    try {
      const response = await generateContentWithTimeout(ai, model, contents, config, 15000);
      if (response && response.text) {
        console.log(`[${new Date().toISOString()}] [api/verify-proof] Model ${model} succeeded in ${Date.now() - startCandidateTime}ms`);
        return response;
      }
    } catch (err) {
      console.warn(`[${new Date().toISOString()}] [api/verify-proof] Model ${model} failed in ${Date.now() - startCandidateTime}ms:`, err?.message || err);
      lastError = err;
    }
  }
  throw lastError || new Error("All AI models failed to respond");
}

export const maxDuration = 30;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb"
    }
  },
  maxDuration: 30
};

export default async function handler(req, res) {
  const requestStartTime = Date.now();
  console.log(`[${new Date().toISOString()}] [api/verify-proof] Request received: method=${req.method}`);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { imageUrl, challengeTitle, instructions } = body;

    if (!imageUrl || !challengeTitle) {
      console.warn(`[${new Date().toISOString()}] [api/verify-proof] Bad request: missing imageUrl or challengeTitle`);
      return res.status(400).json({ verified: false, score: 0, reason: "Missing required fields (imageUrl or challengeTitle)" });
    }

    const ai = getGenAI();
    const base64Data = imageUrl.includes(",") ? imageUrl.split(",")[1] : imageUrl;
    console.log(`[${new Date().toISOString()}] [api/verify-proof] Verifying "${challengeTitle}", base64 payload: ~${Math.round((base64Data?.length || 0) / 1024)} KB`);

    const geminiStartTime = Date.now();
    const response = await generateContentWithFallback(
      ai,
      [
        {
          text: `You are an eco-verification AI for CivicMitra.
The user is submitting proof for the challenge: "${challengeTitle}".
Instructions: "${instructions || ""}".
Analyze the image and determine if it shows valid proof of the challenge being completed.
Return a JSON object with:
- verified: boolean
- score: number (0.0 to 1.0 confidence that it is valid proof and not fake)
- reason: string (concise explanation)`
        },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data
          }
        }
      ],
      {
        responseMimeType: "application/json"
      }
    );
    console.log(`[${new Date().toISOString()}] [api/verify-proof] Gemini processing completed in ${Date.now() - geminiStartTime}ms`);

    const parsed = JSON.parse(response.text || "{}");
    console.log(`[${new Date().toISOString()}] [api/verify-proof] Total handler duration: ${Date.now() - requestStartTime}ms, verified=${parsed.verified}`);
    return res.status(200).json(parsed);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [api/verify-proof] Verification error after ${Date.now() - requestStartTime}ms:`, error);
    if (error?.stack) console.error(error.stack);
    return res.status(500).json({ 
      verified: false, 
      score: 0, 
      reason: error?.message ? `AI verification error: ${error.message}` : "Verification failed" 
    });
  }
}
