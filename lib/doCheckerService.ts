import { app } from "./firebase";
import { getDatabase, ref, query, orderByChild, limitToLast, onChildAdded, onChildChanged, off } from "firebase/database";

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
    // WAJIB orderByChild("completedAt") agar data diurutkan berdasarkan waktu selesai terbaru,
    // bukan berdasarkan urutan abjad nomor SO (lexicographical key) yang menyebabkan event terlewat.
    const doneRef = query(ref(rtdb, "done"), orderByChild("completedAt"), limitToLast(25));

    let isInitialAttach = true;
    const attachStartedAt = Date.now();
    const initialSnapshotKeys = new Set<string>();

    // Mendengarkan pesanan yang baru selesai secara realtime (detik itu juga via WebSocket)
    onChildAdded(doneRef, (snapshot) => {
      const soNum = snapshot.key;
      const data = snapshot.val();
      if (!soNum || !data) return;
      const completedAt = Number(data?.completedAt || 0);

      if (isInitialAttach) {
        // Jika data benar-benar baru selesai (timestamp >= saat koneksi WebSocket dipasang),
        // tangkap langsung walau masih dalam buffer window inisialisasi
        if (completedAt >= attachStartedAt) {
          onNewOrderSelesai({ warehouse, so_number: soNum, ...data });
          return;
        }
        initialSnapshotKeys.add(soNum);
        return; // Lewati pembacaan buffer historis lama
      }

      // Extra guard for slow connections: ignore historical entries created before subscription attached
      if (initialSnapshotKeys.has(soNum)) return;
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
