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
    const { imageUrl, challengeTitle, instructions } = body;
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
    return res.status(200).json(parsed);
  } catch (error) {
    console.error("Proof verification API error:", error);
    return res.status(500).json({ verified: false, score: 0, reason: error?.message || "Verification failed" });
  }
}
