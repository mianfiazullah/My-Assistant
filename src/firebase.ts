import { safeStringify } from "./lib/safeStringify";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, doc, getDocFromServer } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

console.log('Firebase Config Loaded:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  // @ts-ignore
  databaseId: firebaseConfig.firestoreDatabaseId
});

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// @ts-ignore
const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
console.log(`Initializing Firestore with Database ID: ${databaseId}`);

// Initialize Firestore with robust settings for stability in iframes
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, databaseId);
// Ensure we explicitly disable auto detection to avoid collisions in newer versions
if ((db as any)._delegate && (db as any)._delegate._settings) {
  (db as any)._delegate._settings.experimentalAutoDetectLongPolling = false;
}

export const storage = getStorage(app);

// Validate Connection to Firestore with retry logic
async function testConnection(retries = 5, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Testing connection to Firestore database: ${databaseId} (Attempt ${i + 1})`);
      const testDoc = doc(db, 'test', 'connection');
      
      // Use getDocFromServer to actually check backend availability
      await getDocFromServer(testDoc);
      
      console.log('Firestore connection test successful');
      return;
    } catch (error: any) {
      // code=unavailable is common during early boot or in certain network conditions
      console.warn(`Firestore Connection Attempt ${i + 1} failed:`, error.code, error.message);
      
      if (i < retries - 1) {
        // Staggered retry
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      } else {
        console.error("Firestore is persistently unavailable. This typically indicates a network restriction or propagation delay.");
      }
    }
  }
}

// Wait a bit before testing to ensure the environment is fully ready
setTimeout(() => testConnection(), 5000);

// Error Handling Spec for Firestore Operations
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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', safeStringify(errInfo));
  throw new Error(safeStringify(errInfo));
}
