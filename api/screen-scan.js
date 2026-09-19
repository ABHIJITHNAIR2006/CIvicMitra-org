import { GoogleGenAI } from "@google/genai";

let genAIClient = null;
function getGenAI() {
  if (!genAIClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    genAIClient = new GoogleGenAI({ apiKey: key });
  }
  return genAIClient;
}

const CANDIDATE_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];

async function generateContentWithFallback(ai, contents, config) {
  let lastError = null;
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
    } catch (err) {
      console.warn(`Model ${model} failed (${err?.message || err}), trying candidate fallback...`);
      lastError = err;
    }
  }
  throw lastError || new Error("All AI models failed to respond");
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb"
    }
  }
};

export default async function handler(req, res) {
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
    const reason = parsed.reason || (verified ? "Civic action verified successfully!" : "Image does not match active challenge criteria.");

    return res.status(200).json({
      isCivicRelated,
      matchedChallengeId: matchedId,
      confidence,
      verified,
      reason
    });
  } catch (error) {
    console.error("Screen scan API error:", error);
    return res.status(500).json({
      isCivicRelated: false,
      matchedChallengeId: null,
      confidence: 0,
      verified: false,
      reason: error?.message ? `AI analysis error: ${error.message}` : "Failed to analyze screen."
    });
  }
}
