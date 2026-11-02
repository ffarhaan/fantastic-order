const fs = require("fs");
const path = require("path");
const { initializeApp, getApps } = require("firebase/app");
const { getFirestore, doc, setDoc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCKtbQ1c1s-My3Mf0so727hXmR79ekJ5v8",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "fantastic-order.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "fantastic-order",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "fantastic-order.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "607691557004",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:607691557004:web:d747660ac497e804bd53a9",
};

async function main() {
  console.log("📢 [notify_build] Menyiarkan sinyal pembaruan sistem ke Firebase Firestore...");
  try {
    let buildId = "";
    const buildIdPath = path.join(__dirname, "../.next/BUILD_ID");
    if (fs.existsSync(buildIdPath)) {
      buildId = fs.readFileSync(buildIdPath, "utf8").trim();
    }
    if (!buildId) {
      buildId = process.env.VERCEL_GIT_COMMIT_SHA || `build-${Date.now()}`;
    }

    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const ref = doc(db, "app_data", "realtime_signals");

    const commitMsg = process.env.VERCEL_GIT_COMMIT_MESSAGE || "Pembaruan versi sistem";
    const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7) : "";
    const now = Date.now();

    await setDoc(
      ref,
      {
        system_update: now,
        system_update_id: buildId,
        system_update_msg: commitMsg,
        system_update_sha: commitSha,
        updatedAt: new Date(now).toISOString(),
      },
      { merge: true }
    );
    console.log(`✅ [notify_build] Sinyal update berhasil! Build ID: ${buildId}, SHA: ${commitSha}`);
  } catch (err) {
    console.warn("⚠️ [notify_build] Peringatan pengiriman sinyal (non-fatal):", err.message);
  }
  process.exit(0);
}

main();
