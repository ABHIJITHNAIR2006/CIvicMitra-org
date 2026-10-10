/**
 * Image Fingerprinting utilities: SHA-256 exact hash & 64-bit dHash perceptual hash.
 * Uses browser crypto.subtle and Canvas API. Never throws; returns null on error.
 */

export interface ImageFingerprint {
  sha256: string;
  dhash: string;
}

/**
 * Calculates hamming distance between two 16-character hex dHash strings (64 bits).
 * Returns the number of differing bits (0 to 64).
 */
export function hammingDistance(a: string, b: string): number {
  if (!a || !b || a.length !== 16 || b.length !== 16) {
    return 64;
  }

  let distance = 0;
  for (let i = 0; i < 16; i++) {
    const valA = parseInt(a[i], 16);
    const valB = parseInt(b[i], 16);
    if (isNaN(valA) || isNaN(valB)) return 64;

    let xor = valA ^ valB;
    // Count set bits in 4-bit nibble
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/**
 * Computes exact SHA-256 hash and 64-bit perceptual dHash of an image data URL.
 * Fails safely and returns null on any error (never throws).
 */
export async function getImageFingerprint(dataUrl: string): Promise<ImageFingerprint | null> {
  if (!dataUrl || typeof dataUrl !== "string") {
    return null;
  }

  try {
    // 1. Compute SHA-256 exact hash
    const base64Part = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    const binaryStr = atob(base64Part.trim());
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha256 = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toLowerCase();

    // 2. Compute 64-bit dHash (difference hash)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = (e) => reject(e);
      image.src = dataUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 9;
    canvas.height = 8;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, 9, 8);
    const imgData = ctx.getImageData(0, 0, 9, 8).data;

    // Convert 9x8 to grayscale luminances
    const grays: number[][] = [];
    for (let y = 0; y < 8; y++) {
      const row: number[] = [];
      for (let x = 0; x < 9; x++) {
        const idx = (y * 9 + x) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        // Standard Rec. 601 luma
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        row.push(gray);
      }
      grays.push(row);
    }

    // For each of the 8 rows compare each pixel with right neighbor (8 bits/row => 64 bits total)
    let dhashHex = "";
    for (let y = 0; y < 8; y++) {
      let byteVal = 0;
      for (let x = 0; x < 8; x++) {
        if (grays[y][x] > grays[y][x + 1]) {
          byteVal |= (1 << (7 - x));
        }
      }
      dhashHex += byteVal.toString(16).padStart(2, "0").toLowerCase();
    }

    if (dhashHex.length !== 16 || sha256.length !== 64) {
      return null;
    }

    return {
      sha256,
      dhash: dhashHex
    };
  } catch (error) {
    console.warn("[image-hash] Failed to compute image fingerprint:", error);
    return null;
  }
}
