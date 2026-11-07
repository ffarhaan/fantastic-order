import { getTiDBClient } from "@/lib/tidb";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function cleanName(val: unknown): string {
  if (!val) return "";
  const str = String(val).trim();
  if (
    str.toLowerCase().startsWith("apotek") ||
    str.toLowerCase().startsWith("pt ") ||
    str.toLowerCase().startsWith("klinik") ||
    str.includes("00:00:00") ||
    str.includes("GMT") ||
    /^(mon|tue|wed|thu|fri|sat|sun)\s/i.test(str)
  ) {
    return "";
  }
  return str;
}

export async function POST(req: Request) {
  try {
    let rawBody: any;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json") || contentType.includes("text/plain")) {
      const text = await req.text();
      try {
        rawBody = JSON.parse(text);
      } catch {
        rawBody = text;
      }
    } else {
      rawBody = await req.json().catch(() => null);
    }

    if (!rawBody) {
      return new Response(JSON.stringify({ error: "Empty or invalid body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Support single item or array of items (or { items: [...] } / { sos: [...] })
    const rawList = Array.isArray(rawBody)
      ? rawBody
      : Array.isArray(rawBody?.items)
      ? rawBody.items
      : Array.isArray(rawBody?.sos)
      ? rawBody.sos
      : [rawBody];

    const validRows: Array<{
      so: string;
      checker: string;
      packer: string;
      picker: string;
      warehouse: "MBI" | "MAI";
      noDo: string | null;
      customer: string | null;
      soDate: string | null;
      waktuKirim: string | null;
      kategori: string | null;
      kategoriProduk: string | null;
      totalItem: number;
      totalQty: number;
      barangCatatan: number;
      isDone: string;
    }> = [];

    const defaultWarehouse: "MBI" | "MAI" =
      String(rawBody?.warehouse || "").toUpperCase() === "MAI" ? "MAI" : "MBI";

    for (const item of rawList) {
      if (!item || typeof item !== "object") continue;

      const soRaw = String(item.so || item.so_number || item.soNum || "").trim();
      const so = soRaw.replace(/^#/, "").trim();
      if (!so || so === "-" || so === "#N/A") continue;

      const checker = cleanName(item.checkerName || item.checker_name || item.checker);
      const packer = cleanName(item.packerName || item.packer_name || item.packer);
      const picker = cleanName(item.pickerName || item.picker_name || item.picker);
      const noDo = String(item.no_do || item.do || item.noDo || item.no_picking || "").trim() || null;
      const customer = String(item.customer || item.customer_name || item.apotek || item.pelanggan || item.nama_pelanggan || "").trim() || null;
      const soDate = String(item.so_date || item.tanggal_so || item.tgl_so || item.soDate || "").trim() || null;
      const waktuKirim = String(item.waktu_kirim || item.waktuKirim || item.jam || "").trim() || null;
      const kategori = String(item.kategori || item.kat || "").trim() || null;
      const kategoriProduk = String(item.kategori_produk || item.kategoriProduk || item.kat_produk || "").trim() || null;
      const totalItem = Number(item.total_item || item.totalItem || item.item) || 0;
      const totalQty = Number(item.total_qty || item.totalQty || item.qty) || 0;
      const barangCatatan = Number(item.barang_catatan || item.barangCatatan || item.catatan_barang || item.barang_c) || 0;
      const isDone = String(item.is_done || item.done || item.status || item.status_qc || "").trim();

      if (!checker && !packer && !picker && !customer && !isDone && barangCatatan === 0) continue;

      const itemWarehouse: "MBI" | "MAI" =
        String(item.warehouse || defaultWarehouse).toUpperCase() === "MAI" ? "MAI" : "MBI";

      validRows.push({
        so,
        checker: checker || "-",
        packer,
        picker,
        warehouse: itemWarehouse,
        noDo,
        customer,
        soDate,
        waktuKirim,
        kategori,
        kategoriProduk,
        totalItem,
        totalQty,
        barangCatatan,
        isDone,
      });
    }

    if (validRows.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0, message: "No valid SO checker items found" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const conn = getTiDBClient();

    // Group rows by warehouse to maintain strict multi-warehouse isolation
    const rowsByWarehouse: Record<"MBI" | "MAI", typeof validRows> = {
      MBI: validRows.filter((r) => r.warehouse === "MBI"),
      MAI: validRows.filter((r) => r.warehouse === "MAI"),
    };

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "fantastic-order";

    for (const wh of ["MBI", "MAI"] as const) {
      const rows = rowsByWarehouse[wh];
      if (rows.length === 0) continue;

      const tableName = wh === "MAI" ? "so_checkers_mai" : "so_checkers";
      const recentDocId = wh === "MAI" ? "so_checkers_recent_mai" : "so_checkers_recent";

      // 1. Batch upsert into so_checkers table
      const CHUNK_SIZE = 100;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => "(?, ?, ?, ?)").join(", ");
        const flatParams = chunk.flatMap((r) => [r.so, r.checker, r.packer || null, r.picker || null]);

        await conn.execute(
          `INSERT INTO ${tableName} (so_number, checker_name, packer_name, picker_name)
           VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE 
             checker_name = VALUES(checker_name),
             packer_name = VALUES(packer_name),
             picker_name = VALUES(picker_name)`,
          flatParams
        );
      }

      // 2. Batch upsert into qc_reports table (authoritative Report QC pipeline with is_done & customer metadata)
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'QC_DONE')").join(", ");
        const flatParams = chunk.flatMap((r) => [
          r.warehouse,
          r.so,
          r.noDo,
          r.customer,
          r.soDate,
          r.waktuKirim,
          r.checker,
          r.packer,
          r.picker,
          r.kategori,
          r.kategoriProduk,
          r.totalItem,
          r.totalQty,
          r.barangCatatan,
          r.isDone,
        ]);

        await conn.execute(
          `INSERT INTO qc_reports (
            warehouse, so_number, no_do, customer_name, so_date, waktu_kirim,
            checker_name, packer_name, picker_name, kategori, kategori_produk,
            total_item, total_qty, barang_catatan, is_done, status
          ) VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE 
            no_do = IF(VALUES(no_do) IS NOT NULL AND VALUES(no_do) != '', VALUES(no_do), qc_reports.no_do),
            customer_name = IF(VALUES(customer_name) IS NOT NULL AND VALUES(customer_name) != '', VALUES(customer_name), qc_reports.customer_name),
            so_date = IF(VALUES(so_date) IS NOT NULL AND VALUES(so_date) != '', VALUES(so_date), qc_reports.so_date),
            waktu_kirim = IF(VALUES(waktu_kirim) IS NOT NULL AND VALUES(waktu_kirim) != '', VALUES(waktu_kirim), qc_reports.waktu_kirim),
            checker_name = IF(VALUES(checker_name) IS NOT NULL AND VALUES(checker_name) != '-', VALUES(checker_name), qc_reports.checker_name),
            packer_name = IF(VALUES(packer_name) IS NOT NULL AND VALUES(packer_name) != '', VALUES(packer_name), qc_reports.packer_name),
            picker_name = IF(VALUES(picker_name) IS NOT NULL AND VALUES(picker_name) != '', VALUES(picker_name), qc_reports.picker_name),
            kategori = IF(VALUES(kategori) IS NOT NULL AND VALUES(kategori) != '', VALUES(kategori), qc_reports.kategori),
            kategori_produk = IF(VALUES(kategori_produk) IS NOT NULL AND VALUES(kategori_produk) != '', VALUES(kategori_produk), qc_reports.kategori_produk),
            total_item = IF(VALUES(total_item) > 0, VALUES(total_item), qc_reports.total_item),
            total_qty = IF(VALUES(total_qty) > 0, VALUES(total_qty), qc_reports.total_qty),
            barang_catatan = IF(VALUES(barang_catatan) > 0, VALUES(barang_catatan), qc_reports.barang_catatan),
            is_done = IF(VALUES(is_done) IS NOT NULL AND VALUES(is_done) != '', VALUES(is_done), qc_reports.is_done),
            updated_at = CURRENT_TIMESTAMP`,
          flatParams
        );
      }

      // 2. Propagate to Firestore for instant real-time sync across all connected screens (<100ms)
      if (apiKey && projectId) {
        try {
          const recentMap: Record<string, { c: string; p: string; k: string }> = {};
          const sliceRows = rows.slice(-100);
          for (const r of sliceRows) {
            recentMap[r.so] = { c: r.checker, p: r.packer, k: r.picker };
          }

          await fetch(
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/app_data/${recentDocId}?key=${apiKey}&updateMask.fieldPaths=data&updateMask.fieldPaths=updatedAt`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fields: {
                  data: { stringValue: JSON.stringify(recentMap) },
                  updatedAt: { stringValue: new Date().toISOString() },
                },
              }),
            }
          ).catch((e) => console.warn(`[QC Webhook ${wh}] Firestore patch warning:`, e));

          // Realtime push for Report QC queue (instant <1s sync, 0 bytes on Vercel)
          const qcDocId = wh === "MAI" ? "qc_recent_mai" : "qc_recent_mbi";
          const recentQcItems = rows.slice(-100).map((r) => ({
            warehouse: wh,
            so_number: r.so,
            no_do: r.noDo,
            customer_name: r.customer,
            so_date: r.soDate,
            waktu_kirim: r.waktuKirim,
            checker_name: r.checker,
            packer_name: r.packer,
            picker_name: r.picker,
            kategori: r.kategori || "1P",
            kategori_produk: r.kategoriProduk || "FARMA",
            total_item: r.totalItem,
            total_qty: r.totalQty,
            barang_catatan: r.barangCatatan,
            is_done: r.isDone,
            sheet_row: 0,
            status: "QC_DONE",
            updated_at: new Date().toISOString(),
          }));
          await fetch(
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/app_data/${qcDocId}?key=${apiKey}&updateMask.fieldPaths=data&updateMask.fieldPaths=updatedAt`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fields: {
                  data: { stringValue: JSON.stringify(recentQcItems) },
                  updatedAt: { stringValue: new Date().toISOString() },
                },
              }),
            }
          ).catch((e) => console.warn(`[QC Webhook Recent ${wh}] Firestore patch failed:`, e));
        } catch (e) {
          console.warn(`[QC Webhook ${wh}] Firestore sync error:`, e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: validRows.length,
        items: validRows.map((r) => ({ so: r.so, checker: r.checker })),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  } catch (err: any) {
    console.error("[QC Webhook Error]:", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
}
