import { app } from "./firebase";
import { getDatabase, ref, query, limitToLast, onChildAdded, onChildChanged, off } from "firebase/database";

const DO_CHECKER_RTDB_URL = "https://checkermbi-default-rtdb.asia-southeast1.firebasedatabase.app";

/**
 * Direct Real-Time WebSocket Listener to DO Checker App (Instant 0-100ms sync)
 * Terhubung langsung ke database Firebase RTDB DO Checker gudang:
 * Begitu checker gudang menekan tombol "Selesai" di https://checker-do.vercel.app/,
 * event listener ini dipicu secara instan (detik itu juga) via WebSocket tanpa jeda polling.
 */
export function subscribeToDoCheckerLive(onNewOrderSelesai: (orderData: any) => void): () => void {
  if (typeof window === "undefined") return () => {};

  try {
    const rtdb = getDatabase(app, DO_CHECKER_RTDB_URL);
    const doneRef = query(ref(rtdb, "done"), limitToLast(25));

    let isInitialAttach = true;

    // Mendengarkan pesanan yang baru selesai secara realtime (detik itu juga via WebSocket)
    const unsubAdded = onChildAdded(doneRef, (snapshot) => {
      if (isInitialAttach) return; // Lewati pembacaan buffer awal
      const soNum = snapshot.key;
      const data = snapshot.val();
      if (soNum && data) {
        onNewOrderSelesai({ so_number: soNum, ...data });
      }
    });

    // Mendengarkan perubahan data pesanan
    const unsubChanged = onChildChanged(doneRef, (snapshot) => {
      const soNum = snapshot.key;
      const data = snapshot.val();
      if (soNum && data) {
        onNewOrderSelesai({ so_number: soNum, ...data });
      }
    });

    // Tandai inisialisasi awal selesai
    const timer = setTimeout(() => {
      isInitialAttach = false;
    }, 1200);

    return () => {
      clearTimeout(timer);
      try {
        off(doneRef);
      } catch {}
    };
  } catch (err) {
    console.warn("[DO Checker RTDB] Subscription error:", err);
    return () => {};
  }
}
