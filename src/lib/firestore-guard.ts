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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  // Safely extract error message
  let errorMessage = "Unknown error";
  let errorCode = "unknown";

  if (error instanceof Error) {
    errorMessage = error.message;
    // @ts-ignore - Firebase error codes
    if (error.code) errorCode = error.code;
  } else if (typeof error === 'object' && error !== null) {
    // @ts-ignore
    errorMessage = error.message || String(error);
    // @ts-ignore
    if (error.code) errorCode = error.code;
  } else {
    errorMessage = String(error);
  }
  
  // Special handling for the "client is offline" error
  if (errorMessage.toLowerCase().includes('the client is offline')) {
    const configError = "Firestore connection failed (client is offline). Please check your Firebase configuration.";
    console.error(configError);
    throw new Error(JSON.stringify({
      error: configError,
      errorCode: errorCode,
      originalError: errorMessage,
      operationType,
      path
    }));
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
