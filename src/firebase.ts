import { getApp, getApps, initializeApp } from 'firebase/app';
// Firebase's RN runtime exports this, while its generic web type entry omits it.
// @ts-expect-error React Native conditional export is absent from generic types.
import { Auth, getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
export const configured = Boolean(config.apiKey && config.projectId && config.appId);
// Keep the setup screen renderable before .env exists; no requests are made then.
const app = getApps().length ? getApp() : initializeApp(configured ? config : {
  apiKey: 'missing', authDomain: 'missing.firebaseapp.com', projectId: 'missing', appId: 'missing',
});
export const db = getFirestore(app);
// The RN persistence entry is supported by the Firebase JS SDK in Expo Go.
let auth: Auth;
try { auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) }); }
catch { auth = getAuth(app); } // Fast Refresh can initialize auth twice.
export { auth };
