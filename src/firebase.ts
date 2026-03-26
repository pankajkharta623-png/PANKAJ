import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function testConnection() {
  try {
    const docRef = doc(db, 'test', 'connection');
    await getDocFromServer(docRef);
    console.log("Firestore connection successful.");
  } catch (error: any) {
    console.error("Firestore connection failed:", error.code, error.message);
    if(error.code === 'unavailable') {
      console.warn("Firestore backend is currently unreachable. This might be a temporary network issue or the database is still provisioning.");
    }
  }
}
testConnection();
