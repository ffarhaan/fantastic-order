const { initializeApp, getApps } = require('firebase/app');
const { getStorage, ref, uploadString, getDownloadURL } = require('firebase/storage');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCKtbQ1c1s-My3Mf0so727hXmR79ekJ5v8",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "fantastic-order.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "fantastic-order",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "fantastic-order.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "607691557004",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:607691557004:web:d747660ac497e804bd53a9",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-42LBZZPFS9"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

async function testUpload() {
  try {
    const testRef = ref(storage, 'test/hello.txt');
    await uploadString(testRef, 'hello world', 'raw');
    const url = await getDownloadURL(testRef);
    console.log('Firebase Storage works! URL:', url);
  } catch (err) {
    console.log('Firebase Storage error:', err.code, err.message);
  }
}

testUpload();
