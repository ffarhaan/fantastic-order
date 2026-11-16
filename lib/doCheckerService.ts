import { app } from "./firebase";
import { getDatabase, ref, query, limitToLast, onChildAdded, onChildChanged, off } from "firebase/database";

export const DO_CHECKER_RTDB_MBI_URL = "https://checkermbi-default-rtdb.asia-southeast1.firebasedatabase.app";
export const DO_CHECKER_RTDB_MAI_URL = "https://app-qc-f91b2-default-rtdb.asia-southeast1.firebasedatabase.app";

/**
 * Direct Real-Time WebSocket Listener to DO Checker App (Instant 0-100ms sync)
 * Terhubung langsung ke database Firebase RTDB DO Checker gudang (MBI & MAI):
 * Begitu checker gudang menekan tombol "Selesai" di aplikasi checker,
 * event listener ini dipicu secara instan (detik itu juga) via WebSocket tanpa jeda polling.
 */
export function subscribeToDoCheckerLive(
  onNewOrderSelesai: (orderData: any) => void,
  warehouse: "MBI" | "MAI" = "MBI"
): () => void {
  if (typeof window === "undefined") return () => {};

  try {
    const targetUrl = warehouse === "MAI" ? DO_CHECKER_RTDB_MAI_URL : DO_CHECKER_RTDB_MBI_URL;
    const rtdb = getDatabase(app, targetUrl);
    const doneRef = query(ref(rtdb, "done"), limitToLast(25));

    let isInitialAttach = true;
    const attachStartedAt = Date.now();
    const initialSnapshotKeys = new Set<string>();

    // Mendengarkan pesanan yang baru selesai secara realtime (detik itu juga via WebSocket)
    onChildAdded(doneRef, (snapshot) => {
      const soNum = snapshot.key;
      const data = snapshot.val();
      if (isInitialAttach) {
        if (soNum) initialSnapshotKeys.add(soNum);
        return; // Lewati pembacaan buffer awal
      }
      if (!soNum || !data) return;
      // Extra guard for slow connections: ignore historical entries created before subscription attached
      if (initialSnapshotKeys.has(soNum)) return;
      const completedAt = Number(data?.completedAt || 0);
      if (completedAt > 0 && completedAt < attachStartedAt - 10000) return;
      onNewOrderSelesai({ warehouse, so_number: soNum, ...data });
    });

    // Mendengarkan perubahan data pesanan
    onChildChanged(doneRef, (snapshot) => {
      const soNum = snapshot.key;
      const data = snapshot.val();
      if (isInitialAttach || !soNum || !data) return;
      onNewOrderSelesai({ warehouse, so_number: soNum, ...data });
    });

    // Tandai inisialisasi awal selesai
    const timer = setTimeout(() => {
      isInitialAttach = false;
    }, 2000);

    return () => {
      clearTimeout(timer);
      try {
        off(doneRef);
      } catch {}
    };
  } catch (err) {
    console.warn(`[DO Checker RTDB ${warehouse}] Subscription error:`, err);
    return () => {};
  }
}
