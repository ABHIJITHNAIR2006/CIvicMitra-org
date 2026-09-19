import { GoogleGenAI } from "@google/genai";

let genAIClient = null;
function getGenAI() {
  if (!genAIClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.error("[api/screen-scan] CRITICAL: GEMINI_API_KEY environment variable is missing from server process.env!");
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
    console.log(`[${new Date().toISOString()}] [api/screen-scan] Trying candidate model: ${model}`);
    try {
      const response = await generateContentWithTimeout(ai, model, contents, config, 15000);
      if (response && response.text) {
        console.log(`[${new Date().toISOString()}] [api/screen-scan] Model ${model} succeeded in ${Date.now() - startCandidateTime}ms`);
        return response;
      }
    } catch (err) {
      console.warn(`[${new Date().toISOString()}] [api/screen-scan] Model ${model} failed in ${Date.now() - startCandidateTime}ms:`, err?.message || err);
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
  console.log(`[${new Date().toISOString()}] [api/screen-scan] Request received: method=${req.method}`);

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
    const { imageBase64, candidates } = body;
    if (!imageBase64 || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        isCivicRelated: false,
        matchedChallengeId: null,
        confidence: 0,
        verified: false,
        reason: "Image and candidate challenges are required."
      });
    }

    const ai = getGenAI();
    const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    console.log(`[${new Date().toISOString()}] [api/screen-scan] Processing scan with ${candidates.length} candidates, base64 payload: ~${Math.round((base64Data?.length || 0) / 1024)} KB`);

    const candidatesListFormatted = candidates
      .map(
        (c, idx) =>
          `[${idx + 1}] ID: "${c.challengeId}"
   Title: "${c.title}"
   Category: "${c.category}"
   Points: ${c.points}
   Proof Instructions: "${c.proofInstructions}"`
      )
      .join("\n\n");

    const prompt = `You are a strict, objective civic action verification AI agent for CivicMitra.
A user has submitted a captured screen or photo as proof of completing a civic, eco-friendly, or sustainable habit.

Analyze the image and evaluate it against the list of active challenges below:

ACTIVE CHALLENGES:
${candidatesListFormatted}

CRITERIA:
1. Reject generic or unrelated screenshots: random web browsing, social media feeds, desktop wallpapers, blank screens, or unrelated games.
2. The image MUST present genuine evidence that directly fulfills one of the challenges' "Proof Instructions".
3. "verified" MUST be true ONLY IF:
   - "isCivicRelated" is true, AND
   - "matchedChallengeId" is an exact match to a real ID from the candidate list, AND
   - "confidence" is >= 0.70.
   Otherwise, "verified" MUST be false.
4. If verified is false, provide a clear, constructive explanation of what is missing or why it was not recognized.

Return a JSON object conforming strictly to this format:
{
  "isCivicRelated": boolean,
  "matchedChallengeId": string | null,
  "confidence": number,
  "verified": boolean,
  "reason": string
}`;

    const geminiStartTime = Date.now();
    const response = await generateContentWithFallback(
      ai,
      [
        { text: prompt },
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
    console.log(`[${new Date().toISOString()}] [api/screen-scan] Gemini processing completed in ${Date.now() - geminiStartTime}ms`);

    const parsed = JSON.parse(response.text || "{}");
    const validCandidateIds = new Set(candidates.map((c) => c.challengeId));
    const matchedId =
      parsed.matchedChallengeId && validCandidateIds.has(parsed.matchedChallengeId)
        ? parsed.matchedChallengeId
        : null;
    const confidence = typeof parsed.confidence === "number" ? Math.min(Math.max(parsed.confidence, 0), 1) : 0;
    const isCivicRelated = Boolean(parsed.isCivicRelated);
    const verified = Boolean(parsed.verified && isCivicRelated && matchedId !== null && confidence >= 0.70);
    const reason = parsed.reason || (verified ? "Civic action verified successfully!" : "Image does not match active challenge criteria.");

    console.log(`[${new Date().toISOString()}] [api/screen-scan] Total handler duration: ${Date.now() - requestStartTime}ms, verified=${verified}, matchedId=${matchedId}`);
    return res.status(200).json({
      isCivicRelated,
      matchedChallengeId: matchedId,
      confidence,
      verified,
      reason
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [api/screen-scan] Error after ${Date.now() - requestStartTime}ms:`, error);
    if (error?.stack) console.error(error.stack);
    return res.status(500).json({
      isCivicRelated: false,
      matchedChallengeId: null,
      confidence: 0,
      verified: false,
      reason: error?.message ? `AI analysis error: ${error.message}` : "Failed to analyze screen."
    });
  }
}
