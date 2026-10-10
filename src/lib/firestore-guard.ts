import { auth } from "../firebase";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

// Helper to strip non-serializable or complex properties from an object
function cleanObject(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanObject);
  
  const clean: any = {};
  for (const key in obj) {
    const val = obj[key];
    if (typeof val === 'function') continue;
    if (val instanceof Date) {
      clean[key] = val.toISOString();
      continue;
    }
    if (val !== null && typeof val === 'object') {
      if (val.constructor !== Object && val.constructor !== Array) {
        clean[key] = `[${val.constructor.name}]`;
      } else {
        clean[key] = cleanObject(val);
      }
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

// Helper to check if an error is caused by Firestore quota limits or client offline state
export function isFirestoreQuotaOrOfflineError(error: unknown): boolean {
  if (!error) return false;
  let msg = '';
  let code = '';
  if (error instanceof Error) {
    msg = error.message;
    // @ts-ignore
    code = error.code || '';
  } else if (typeof error === 'object' && error !== null) {
    // @ts-ignore
    msg = error.message || error.error || String(error);
    // @ts-ignore
    code = error.code || error.errorCode || '';
  } else {
    msg = String(error);
  }
  const lowerMsg = msg.toLowerCase();
  return (
    code === 'resource-exhausted' ||
    code === 'unavailable' ||
    lowerMsg.includes('resource-exhausted') ||
    lowerMsg.includes('quota') ||
    lowerMsg.includes('free daily read units') ||
    lowerMsg.includes('quota metric') ||
    lowerMsg.includes('the client is offline') ||
    lowerMsg.includes('failed-precondition')
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): any {
  // Safely extract error message
  let errorMessage = "Unknown error";
  let errorCode = "unknown";

  if (error instanceof Error) {
    errorMessage = error.message;
    // @ts-ignore - Firebase error codes
    if (error.code) errorCode = error.code;
  } else if (typeof error === 'object' && error !== null) {
    // @ts-ignore
    errorMessage = error.message || error.error || String(error);
    // @ts-ignore
    if (error.code) errorCode = error.code;
  } else {
    errorMessage = String(error);
  }
  
  // Special handling for quota limit exceeded / resource exhausted / offline
  if (isFirestoreQuotaOrOfflineError(error) || errorMessage.toLowerCase().includes('quota') || errorCode === 'resource-exhausted') {
    console.warn(`[Firestore Quota/Offline Notice] Handled gracefully for ${operationType} on ${path || 'unknown'}:`, errorMessage);
    // Return safe dummy objects to prevent crashing callers that await getDocs or getDoc
    if (operationType === OperationType.LIST) {
      return { empty: true, size: 0, docs: [] } as any;
    }
    if (operationType === OperationType.GET) {
      return { exists: () => false, data: () => undefined, id: path || '' } as any;
    }
    return undefined as any;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName || null,
        email: provider.email || null,
        photoUrl: provider.photoURL || null
      })) || []
    },
    operationType,
    path
  };

  // Ensure errInfo is serializable
  try {
    const serialized = JSON.stringify(cleanObject(errInfo));
    console.error('Firestore Error: ', serialized);
    throw new Error(serialized);
  } catch (stringifyError) {
    const fallbackMessage = `Firestore Permission Denied at ${path || 'unknown'}`;
    console.error(fallbackMessage, errorMessage);
    throw new Error(JSON.stringify({ error: fallbackMessage, originalError: errorMessage }));
  }
}
