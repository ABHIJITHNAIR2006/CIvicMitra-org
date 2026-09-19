import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || (typeof import.meta !== "undefined" && import.meta.env?.VITE_GEMINI_API_KEY) || "";

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
      console.warn(`Client fallback model ${model} failed:`, err?.message || err);
      lastError = err;
    }
  }
  throw lastError || new Error("All AI models failed to respond");
}

export interface ScanCandidateChallenge {
  challengeId: string;
  title: string;
  category: string;
  proofInstructions: string;
  points: number;
}

export interface ScreenScanResult {
  isCivicRelated: boolean;
  matchedChallengeId: string | null;
  confidence: number; // 0.0–1.0
  verified: boolean;
  reason: string;
}

export async function scanScreenForCivicChallenge(
  imageBase64: string,
  candidates: ScanCandidateChallenge[]
): Promise<ScreenScanResult> {
  if (!candidates || candidates.length === 0) {
    return {
      isCivicRelated: false,
      matchedChallengeId: null,
      confidence: 0,
      verified: false,
      reason: "No active civic challenges available to match against."
    };
  }

  // 1. Try server-side API first to keep keys protected
  try {
    const res = await fetch("/api/screen-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, candidates })
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn("Server-side screen scan route unavailable, attempting client fallback:", err);
  }

  // 2. Direct client fallback if API key available in development
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;

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

      const prompt = `You are a strict civic action verification AI agent for CivicMitra.
A user has submitted a captured screen or photo as proof of completing a civic or ecological action.

Evaluate the image against the active challenges:
${candidatesListFormatted}

CRITERIA:
1. Reject generic unrelated screenshots (social media, blank screen, games).
2. The image MUST provide clear proof satisfying one challenge's "Proof Instructions".
3. "verified" is true ONLY IF isCivicRelated is true AND matchedChallengeId matches a candidate AND confidence >= 0.70.

Return strict JSON:
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
      const validCandidateIds = new Set(candidates.map((c) => c.challengeId));
      const matchedId =
        parsed.matchedChallengeId && validCandidateIds.has(parsed.matchedChallengeId)
          ? parsed.matchedChallengeId
          : null;
      const confidence = typeof parsed.confidence === "number" ? Math.min(Math.max(parsed.confidence, 0), 1) : 0;
      const isCivicRelated = Boolean(parsed.isCivicRelated);
      const verified = Boolean(parsed.verified && isCivicRelated && matchedId !== null && confidence >= 0.70);

      return {
        isCivicRelated,
        matchedChallengeId: matchedId,
        confidence,
        verified,
        reason: parsed.reason || (verified ? "Civic proof verified!" : "Does not fulfill challenge criteria.")
      };
    } catch (e: any) {
      console.error("Client fallback error:", e);
    }
  }

  return {
    isCivicRelated: false,
    matchedChallengeId: null,
    confidence: 0,
    verified: false,
    reason: "AI verification service is temporarily unavailable. Please try again."
  };
}

export async function verifyEcoProof(imageUrl: string, challengeTitle: string, instructions: string) {
  // 1. Try server-side proxy
  try {
    const res = await fetch("/api/verify-proof", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, challengeTitle, instructions })
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Continue to client fallback
  }

  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set. AI verification disabled.");
    return { verified: false, score: 0, reason: "Verification service not configured" };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const base64Data = imageUrl.includes(",") ? imageUrl.split(",")[1] : imageUrl;
    const response = await generateContentWithFallback(
      ai,
      [
        {
          text: `You are an eco-verification AI for CivicMitra. 
The user is submitting proof for the challenge: "${challengeTitle}".
Instructions: "${instructions}".
Analyze the image and determine if it shows valid proof of the challenge being completed.
Return a JSON object with:
- verified: boolean
- score: number (0.0 to 1.0 confidence that it is NOT AI generated and is valid)
- reason: string (explanation of why it was verified or rejected)`
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

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Verification failed:", error);
    return { verified: false, score: 0, reason: "Verification service error" };
  }
}
