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

export interface VerifyProofResult {
  verified: boolean;
  score: number;
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

  if (!imageBase64) {
    return {
      isCivicRelated: false,
      matchedChallengeId: null,
      confidence: 0,
      verified: false,
      reason: "No image captured for screening."
    };
  }

  const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
  const payloadKb = Math.round((base64Data?.length || 0) / 1024);
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] [scanScreenForCivicChallenge] Sending screen scan (${candidates.length} candidates, ~${payloadKb} KB)`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error("Screen scan request timed out after 20s"));
  }, 20000);

  try {
    const res = await fetch("/api/screen-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, candidates }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] [scanScreenForCivicChallenge] Server responded in ${duration}ms with HTTP status ${res.status}`);

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok) {
      let errorDetail = "";
      if (contentType.includes("application/json")) {
        try {
          const errorJson = await res.json();
          errorDetail = errorJson.reason || errorJson.error || JSON.stringify(errorJson);
        } catch {}
      } else {
        const errorText = await res.text();
        errorDetail = errorText.slice(0, 300);
      }

      console.error(`[${new Date().toISOString()}] [scanScreenForCivicChallenge] Error ${res.status} (${res.statusText}):`, errorDetail);

      return {
        isCivicRelated: false,
        matchedChallengeId: null,
        confidence: 0,
        verified: false,
        reason: errorDetail || `Screen scan service error (HTTP ${res.status})`
      };
    }

    if (!contentType.includes("application/json")) {
      const text = await res.text();
      console.error("[scanScreenForCivicChallenge] Expected JSON response but received non-JSON:", text.slice(0, 300));
      return {
        isCivicRelated: false,
        matchedChallengeId: null,
        confidence: 0,
        verified: false,
        reason: "Server returned non-JSON response. Please verify Vercel function routes."
      };
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    const isTimeout = err?.name === "AbortError" || err?.message?.includes("timed out");
    console.error(`[${new Date().toISOString()}] [scanScreenForCivicChallenge] Request failed after ${duration}ms:`, err);
    return {
      isCivicRelated: false,
      matchedChallengeId: null,
      confidence: 0,
      verified: false,
      reason: isTimeout
        ? "Screen scan timed out (20s). Please check your connection and try again."
        : (err?.message ? `Network request failed: ${err.message}` : "Failed to connect to screen scan service.")
    };
  }
}

export async function verifyEcoProof(
  imageUrl: string,
  challengeTitle: string,
  instructions: string
): Promise<VerifyProofResult> {
  if (!imageUrl) {
    console.error("[verifyEcoProof] Error: imageUrl is empty or null.");
    return {
      verified: false,
      score: 0,
      reason: "No image provided for verification."
    };
  }

  const base64Data = imageUrl.includes(",") ? imageUrl.split(",")[1] : imageUrl;
  const payloadKb = Math.round((base64Data?.length || 0) / 1024);
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] [verifyEcoProof] Sending proof for "${challengeTitle}" (~${payloadKb} KB)`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error("Verification request timed out after 20s"));
  }, 20000);

  try {
    const res = await fetch("/api/verify-proof", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, challengeTitle, instructions }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] [verifyEcoProof] Server responded in ${duration}ms with HTTP status ${res.status}`);

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok) {
      let errorDetail = "";
      if (contentType.includes("application/json")) {
        try {
          const errorJson = await res.json();
          errorDetail = errorJson.reason || errorJson.error || JSON.stringify(errorJson);
        } catch {}
      } else {
        const errorText = await res.text();
        errorDetail = errorText.slice(0, 300);
      }

      console.error(
        `[${new Date().toISOString()}] [verifyEcoProof] Server error ${res.status} (${res.statusText}):`,
        errorDetail
      );

      return {
        verified: false,
        score: 0,
        reason: errorDetail || `Verification service failed with status ${res.status}`
      };
    }

    if (!contentType.includes("application/json")) {
      const text = await res.text();
      console.error("[verifyEcoProof] Expected JSON response but received non-JSON:", text.slice(0, 300));
      return {
        verified: false,
        score: 0,
        reason: "Server returned an invalid non-JSON response. Please check server routing."
      };
    }

    const data = await res.json();
    console.log(`[${new Date().toISOString()}] [verifyEcoProof] Verification result: verified=${data.verified}, score=${data.score}`);
    return {
      verified: Boolean(data.verified),
      score: typeof data.score === "number" ? data.score : 0,
      reason: data.reason || (data.verified ? "Proof verified successfully!" : "Verification failed.")
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    const isTimeout = err?.name === "AbortError" || err?.message?.includes("timed out");
    console.error(`[${new Date().toISOString()}] [verifyEcoProof] Request failed after ${duration}ms:`, err);
    return {
      verified: false,
      score: 0,
      reason: isTimeout
        ? "AI verification request timed out (20s). Please check your internet connection and try again."
        : (err?.message ? `Network request failed: ${err.message}` : "Failed to connect to verification service.")
    };
  }
}
