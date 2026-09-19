import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { Agent, setGlobalDispatcher } from "undici";

dotenv.config();

// Prevent HeadersTimeoutError by giving Google GenAI calls up to 60s and enabling robust connection pooling
setGlobalDispatcher(
  new Agent({
    headersTimeout: 60000,
    bodyTimeout: 60000,
    connectTimeout: 30000
  })
);

const CANDIDATE_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];

async function generateContentWithFallback(ai: GoogleGenAI, contents: any[], config?: any) {
  let lastError: any = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config
      });
      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      console.warn(`Model ${model} failed (${err?.message || err}), trying candidate fallback...`);
      lastError = err;
    }
  }
  throw lastError || new Error("All AI models failed to respond");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    genAIClient = new GoogleGenAI({ apiKey: key });
  }
  return genAIClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support image payloads up to 25MB for screen captures
  app.use(express.json({ limit: "25mb" }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // AI Screen Scan API
  app.post("/api/screen-scan", async (req, res) => {
    try {
      const { imageBase64, candidates } = req.body;
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

      const candidatesListFormatted = candidates
        .map(
          (c: any, idx: number) =>
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

      const parsed = JSON.parse(response.text || "{}");
      const validCandidateIds = new Set(candidates.map((c: any) => c.challengeId));
      const matchedId =
        parsed.matchedChallengeId && validCandidateIds.has(parsed.matchedChallengeId)
          ? parsed.matchedChallengeId
          : null;
      const confidence = typeof parsed.confidence === "number" ? Math.min(Math.max(parsed.confidence, 0), 1) : 0;
      const isCivicRelated = Boolean(parsed.isCivicRelated);
      const verified = Boolean(parsed.verified && isCivicRelated && matchedId !== null && confidence >= 0.70);
      const reason = parsed.reason || (verified ? "Civic action verified successfully!" : "Image does not match active challenge criteria.");

      return res.json({
        isCivicRelated,
        matchedChallengeId: matchedId,
        confidence,
        verified,
        reason
      });
    } catch (error: any) {
      console.error("Screen scan API error:", error);
      return res.status(500).json({
        isCivicRelated: false,
        matchedChallengeId: null,
        confidence: 0,
        verified: false,
        reason: error?.message ? `AI analysis error: ${error.message}` : "Failed to analyze screen."
      });
    }
  });

  // Proof Verification API
  app.post("/api/verify-proof", async (req, res) => {
    try {
      const { imageUrl, challengeTitle, instructions } = req.body;
      if (!imageUrl || !challengeTitle) {
        return res.status(400).json({ verified: false, score: 0, reason: "Missing required fields" });
      }

      const ai = getGenAI();
      const base64Data = imageUrl.includes(",") ? imageUrl.split(",")[1] : imageUrl;

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

      const parsed = JSON.parse(response.text || "{}");
      return res.json(parsed);
    } catch (error: any) {
      console.error("Proof verification API error:", error);
      return res.status(500).json({ verified: false, score: 0, reason: error?.message || "Verification failed" });
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
