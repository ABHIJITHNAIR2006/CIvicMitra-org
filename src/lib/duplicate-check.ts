import { doc, getDoc, getDocs, collection, query, orderBy, limit, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { getImageFingerprint, hammingDistance, ImageFingerprint } from "./image-hash";

export const DHASH_MAX_DISTANCE = 5;
export const NEAR_DUPLICATE_SCAN_LIMIT = 300;
export const DUPLICATE_CHECK_TIMEOUT_MS = 4000;

export type ImageHashSource = "CHALLENGE" | "SCREEN_SCAN" | "FEED";

export async function checkDuplicateImage(
  dataUrl: string,
  opts: { nearMatch: boolean }
): Promise<{ isDuplicate: boolean; fingerprint: ImageFingerprint | null }> {
  let computedFingerprint: ImageFingerprint | null = null;
  try {
    computedFingerprint = await getImageFingerprint(dataUrl);
    if (!computedFingerprint) {
      return { isDuplicate: false, fingerprint: null };
    }

    const fingerprint = computedFingerprint;

    const performCheck = async (): Promise<{ isDuplicate: boolean; fingerprint: ImageFingerprint | null }> => {
      // 1. Exact match check by SHA-256 document key
      const exactSnap = await getDoc(doc(db, "image_hashes", fingerprint.sha256));
      if (exactSnap.exists()) {
        console.info(`[duplicate-check] Exact match found for hash ${fingerprint.sha256}`);
        return { isDuplicate: true, fingerprint };
      }

      // 2. Perceptual near-duplicate check if requested
      if (opts.nearMatch) {
        try {
          const hashesQuery = query(
            collection(db, "image_hashes"),
            orderBy("createdAt", "desc"),
            limit(NEAR_DUPLICATE_SCAN_LIMIT)
          );
          const snap = await getDocs(hashesQuery);
          for (const docSnap of snap.docs) {
            const data = docSnap.data();
            if (data?.dhash && typeof data.dhash === "string" && data.dhash.length === 16) {
              const distance = hammingDistance(data.dhash, fingerprint.dhash);
              if (distance <= DHASH_MAX_DISTANCE) {
                console.info(`[duplicate-check] Perceptual match found: distance=${distance} <= ${DHASH_MAX_DISTANCE}`);
                return { isDuplicate: true, fingerprint };
              }
            }
          }
        } catch (nearErr) {
          console.warn("[duplicate-check] Perceptual query check failed, skipping near check:", nearErr);
        }
      }

      return { isDuplicate: false, fingerprint };
    };

    let timer: any;
    const timeoutPromise = new Promise<{ isDuplicate: boolean; fingerprint: ImageFingerprint | null }>((resolve) => {
      timer = setTimeout(() => {
        console.warn(`[duplicate-check] Check timed out after ${DUPLICATE_CHECK_TIMEOUT_MS}ms, failing open`);
        resolve({ isDuplicate: false, fingerprint });
      }, DUPLICATE_CHECK_TIMEOUT_MS);
    });

    const result = await Promise.race([performCheck(), timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    console.warn("[duplicate-check] Error during duplicate image check, failing open:", err);
    return { isDuplicate: false, fingerprint: computedFingerprint };
  }
}

export async function registerImageFingerprint(
  fingerprint: ImageFingerprint | null | undefined,
  source: ImageHashSource,
  challengeId?: string
): Promise<void> {
  if (!fingerprint || !fingerprint.sha256 || !auth.currentUser) {
    return;
  }

  try {
    const docData: Record<string, any> = {
      userId: auth.currentUser.uid,
      dhash: fingerprint.dhash,
      source,
      createdAt: new Date().toISOString()
    };
    if (challengeId) {
      docData.challengeId = challengeId;
    }

    await setDoc(doc(db, "image_hashes", fingerprint.sha256), docData);
    console.info(`[duplicate-check] Registered image fingerprint: sha256=${fingerprint.sha256}, source=${source}`);
  } catch (error) {
    console.warn("[duplicate-check] Failed to register image fingerprint (non-blocking):", error);
  }
}
