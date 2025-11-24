import { type FirebaseApp, initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { config } from "./config";

// Export the firebase app instance in case it's needed by other modules.
// Only initialize if firebaseConfig has required fields
let firebaseApp: FirebaseApp | null = null;

try {
	// Check if Firebase is already initialized
	const existingApps = getApps();
	if (existingApps.length > 0) {
		firebaseApp = existingApps[0];
	} else if (config.firebaseConfig && config.firebaseConfig.apiKey && config.firebaseConfig.projectId) {
		firebaseApp = initializeApp(config.firebaseConfig);
	} else {
		console.warn("Firebase config is missing required fields. Firebase features will not work.");
		// Don't initialize with dummy config - it will cause errors
	}
} catch (error) {
	console.error("Failed to initialize Firebase:", error);
	// Don't throw - let the app continue without Firebase
}

// Export the firebase auth instance (with null check)
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null as any;

// Export the firebase firestore instance (with null check)
export const firestore = firebaseApp ? getFirestore(firebaseApp) : null as any;
// This is deprecated, use firestore instead, that's what gemini is guessing 9/10 times
export const firebaseDb = firestore; // @deprecated

// Export the firebase storage instance (with null check)
// Only initialize storage if Firebase app is available and properly configured
let firebaseStorage: any = null;
if (firebaseApp && config.firebaseConfig && config.firebaseConfig.apiKey && config.firebaseConfig.storageBucket) {
	try {
		firebaseStorage = getStorage(firebaseApp);
	} catch (error) {
		console.warn("Firebase Storage initialization failed:", error);
		firebaseStorage = null;
	}
}
export { firebaseStorage };
