import { getTiDBClient } from "@/lib/tidb";
import { calculateDominantCategory } from "@/lib/parser";
import { parsePersonNames } from "@/lib/personnelUtils";
import zlib from "zlib";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Short-term in-memory cache to protect against rapid client loops
let memoryQcReportsCache: Record<string, { payload: any; ts: number }> = {};
let memoryCheckCache: { payload: any; ts: number } | null = null;
let memoryCheckersCache: Record<string, { payload: any; ts: number }> = {};

function compressedJsonResponse(
  req: Request,
  data: unknown,
  customHeaders: Record<string, string> = {},
  status = 200
): Response {
  const jsonStr = JSON.stringify(data);
  const acceptEncoding = req.headers.get("accept-encoding") || "";
  const url = new URL(req.url);

  // If customHeaders explicitly configures CDN caching, protect it and never let browser headers override it to no-store
  const hasExplicitCdnCache = Boolean(
    customHeaders["CDN-Cache-Control"]?.includes("public") ||
    customHeaders["Vercel-CDN-Cache-Control"]?.includes("public") ||
    customHeaders["Cache-Control"]?.includes("public")
  );

  const isNoCache = !hasExplicitCdnCache && (
    req.method !== "GET" ||
    url.searchParams.get("fresh") === "true"
  );

  const etag = `"${crypto.createHash("md5").update(jsonStr).digest("hex")}"`;

  const cdnHeader = isNoCache
    ? "no-store"
    : (customHeaders["Vercel-CDN-Cache-Control"] || customHeaders["CDN-Cache-Control"] || "public, s-maxage=60, stale-while-revalidate=300");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": isNoCache ? "no-store, no-cache, must-revalidate" : (customHeaders["Cache-Control"] || cdnHeader),
    "CDN-Cache-Control": cdnHeader,
    "Vercel-CDN-Cache-Control": cdnHeader,
    "ETag": etag,
    ...customHeaders,
  };

  if (isNoCache) {
    headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
    headers["CDN-Cache-Control"] = "no-store";
    headers["Vercel-CDN-Cache-Control"] = "no-store";
    headers["Pragma"] = "no-cache";
  }

  // If client/CDN sent If-None-Match and it matches our payload hash, return 304 with 0 bytes body!
  if (!isNoCache && req.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers,
    });
  }

  if (acceptEncoding.includes("gzip")) {
    const compressed = zlib.gzipSync(Buffer.from(jsonStr), { level: 6 });
    return new Response(compressed as unknown as BodyInit, {
      status,
      headers: {
        ...headers,
        "Content-Encoding": "gzip",
        "Vary": "Accept-Encoding",
      },
    });
  }

  return new Response(jsonStr, {
    status,
    headers,
  });
}

function normalizeDateStr(val: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val).trim();
  if (!s || s === "-" || s === "#N/A") return "";
  
  if (/^\d{5}$/.test(s)) {
    const serial = Number(s);
    const utcDays = serial - 25569;
    const date = new Date(utcDays * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const ddmmyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const monthMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", mei: "05", may: "05", jun: "06",
    jul: "07", agu: "08", aug: "08", sep: "09", okt: "10", oct: "10", nov: "11", des: "12", dec: "12"
  };
  const textDateMatch = s.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (textDateMatch) {
    const d = textDateMatch[1].padStart(2, "0");
    const mStr = textDateMatch[2].toLowerCase().slice(0, 3);
    const m = monthMap[mStr] || "01";
    const y = textDateMatch[3];
    return `${y}-${m}-${d}`;
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000 && parsed.getFullYear() < 2100) {
    return parsed.toISOString().split("T")[0];
  }

  return s;
}

async function getWebhookUrl(conn: any): Promise<string> {
  if (process.env.APPS_SCRIPT_SHIPMENT_WEBHOOK_URL) {
    return process.env.APPS_SCRIPT_SHIPMENT_WEBHOOK_URL;
  }
  try {
    const rows = (await conn.execute(
      "SELECT value_text FROM app_settings WHERE key_name = 'shipment_error_webhook_url' LIMIT 1"
    )) as any[];
    return rows?.[0]?.value_text || "";
  } catch {
    return "";
  }
}

async function saveWebhookUrl(conn: any, url: string): Promise<void> {
  if (!url) return;
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key_name VARCHAR(64) PRIMARY KEY,
        value_text TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await conn.execute(
      `INSERT INTO app_settings (key_name, value_text) VALUES ('shipment_error_webhook_url', ?)
       ON DUPLICATE KEY UPDATE value_text = VALUES(value_text)`,
      [url]
    );
  } catch (e) {
    console.error("Failed to save webhook URL:", e);
  }
}

async function getCustomerWebhookUrl(conn: any): Promise<string> {
  if (process.env.GSHEET_CUSTOMER_WEBHOOK_URL) {
    return process.env.GSHEET_CUSTOMER_WEBHOOK_URL;
  }
  try {
    const rows = (await conn.execute(
      "SELECT value_text FROM app_settings WHERE key_name = 'customer_webhook_url' LIMIT 1"
    )) as any[];
    return rows?.[0]?.value_text || "";
  } catch {
    return "";
  }
}

async function saveCustomerWebhookUrl(conn: any, url: string): Promise<void> {
  if (!url) return;
  try {
    await conn.execute(
      `INSERT INTO app_settings (key_name, value_text) VALUES ('customer_webhook_url', ?)
       ON DUPLICATE KEY UPDATE value_text = VALUES(value_text)`,
      [url]
    );
  } catch (e) {
    console.error("Failed to save customer webhook URL:", e);
  }
}

async function forwardToCustomerGSheetWebhook(conn: any, payload: any): Promise<void> {
  try {
    const webhookUrl = await getCustomerWebhookUrl(conn);
    if (!webhookUrl) return;
    const cleanUrl = webhookUrl.replace(/\/a\/[^\/]+\/macros\/s\//, "/macros/s/");
    const jsonStr = JSON.stringify(payload);
    const targetUrl = cleanUrl.includes("?")
      ? `${cleanUrl}&data=${encodeURIComponent(jsonStr)}`
      : `${cleanUrl}?data=${encodeURIComponent(jsonStr)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonStr,
        redirect: "follow",
        signal: controller.signal,
      });
      console.log(`[Customer GSheet Webhook] Status: ${res.status}`);
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.warn(`[Customer GSheet Webhook Warning] Status ${res.status}: ${errText.slice(0, 200)}, retrying with GET...`);
        await fetch(targetUrl, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
        }).catch(() => {});
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    console.error("Customer GSheet webhook error:", err);
  }
}

async function broadcastSignalFromApi(channel: "customers" | "returns" | "fakturs") {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "fantastic-order";
  if (!apiKey || !projectId) return;
  try {
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/app_data/realtime_signals?key=${apiKey}&updateMask.fieldPaths=${channel}&updateMask.fieldPaths=updatedAt`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            [channel]: { integerValue: String(Date.now()) },
            updatedAt: { stringValue: new Date().toISOString() },
          },
        }),
      }
    ).catch(() => {});
  } catch (e) {
    console.warn(`[broadcastSignalFromApi(${channel})]:`, e);
  }
}

function forwardToGSheetWebhook(conn: any, payload: any) {
  // Integrasi Google Sheet Shipment Error telah diputuskan agar aplikasi Fantastic Order 100% mandiri,
  // kebal dari latensi webhook, dan bebas dari limit eksekusi Google Apps Script.
  return;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const conn = getTiDBClient();

    // ==========================================
    // CUSTOMER AUTO-QUEUE SYNC (Google Sheet Pull)
    // ==========================================
    if (action === "get_pending_customer_sync") {
      try {
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS customer_sync_queue (
            customer_id VARCHAR(64) PRIMARY KEY,
            action VARCHAR(32) DEFAULT 'update_row',
            payload MEDIUMTEXT,
            queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        const rows = (await conn.execute(
          "SELECT customer_id, action, payload, queued_at FROM customer_sync_queue ORDER BY queued_at ASC LIMIT 100"
        )) as any[];
        const items = (rows || []).map((r: any) => {
          try {
            return JSON.parse(r.payload);
          } catch {
            return { id: r.customer_id };
          }
        });
        return Response.json(
          { success: true, count: items.length, items },
          { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
        );
      } catch (e: any) {
        return Response.json({ success: false, items: [], error: e?.message });
      }
    }

    // ==========================================
    // ACTIVITY LOGS AUDIT TRAIL (TiDB Cloud)
    // ==========================================
    if (action === "activity_logs") {
      const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
      const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));
      const mod = (searchParams.get("module") || "").trim();
      const user = (searchParams.get("user") || "").trim();
      const q = (searchParams.get("search") || "").trim();

      let whereClause = "WHERE 1=1";
      const params: (string | number)[] = [];

      if (mod && mod !== "ALL") {
        whereClause += " AND module = ?";
        params.push(mod);
      }
      if (user && user !== "ALL") {
        whereClause += " AND user_name = ?";
        params.push(user);
      }
      if (q) {
        whereClause += " AND (details LIKE ? OR user_name LIKE ? OR target_id LIKE ?)";
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }

      const countRes = (await conn.execute(`SELECT COUNT(*) as total FROM activity_logs ${whereClause}`, params)) as any[];
      const total = Number(countRes[0]?.total || 0);

      const rows = await conn.execute(
        `SELECT id, user_name, user_email, action_type, module, target_id, details, metadata, created_at 
         FROM activity_logs 
         ${whereClause} 
         ORDER BY id DESC 
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return compressedJsonResponse(req, {
        success: true,
        total,
        data: rows,
        limit,
        offset,
      });
    }

    // ==========================================
    // DATABASE TRANSPARENCY & STATS (TiDB Cloud)
    // ==========================================
    if (action === "db_stats") {
      let checkersMbiCount = 0;
      let checkersMaiCount = 0;
      try {
        const [cMbi] = (await conn.execute("SELECT COUNT(*) AS c FROM so_checkers")) as any[];
        checkersMbiCount = Number(cMbi?.c || 0);
      } catch {}
      try {
        const [cMai] = (await conn.execute("SELECT COUNT(*) AS c FROM so_checkers_mai")) as any[];
        checkersMaiCount = Number(cMai?.c || 0);
      } catch {}

      const [counts] = (await conn.execute(`
        SELECT 
          (SELECT COUNT(*) FROM fakturs_archive) AS fakturs,
          (SELECT COUNT(*) FROM shipment_returns) AS returns_count,
          (SELECT COUNT(*) FROM customers) AS customers,
          (SELECT COUNT(*) FROM customer_documents) AS documents,
          (SELECT COUNT(*) FROM return_requests) AS return_requests
      `)) as any[];

      if (counts) {
        counts.checkers_mbi = checkersMbiCount;
        counts.checkers_mai = checkersMaiCount;
      }

      let totalDataBytes = 0;
      let totalIndexBytes = 0;
      try {
        const sizeRows = (await conn.execute(`
          SELECT table_name, data_length, index_length 
          FROM information_schema.tables 
          WHERE table_schema = DATABASE()
        `)) as any[];
        if (Array.isArray(sizeRows)) {
          for (const row of sizeRows) {
            totalDataBytes += Number(row.data_length || 0);
            totalIndexBytes += Number(row.index_length || 0);
          }
        }
      } catch {}

      const totalSizeBytes = totalDataBytes + totalIndexBytes;
      const totalSizeMb = (totalSizeBytes / (1024 * 1024)).toFixed(2);
      const limitMb = 5120; // 5 GB TiDB Serverless Free Tier
      const percentageUsed = ((Number(totalSizeMb) / limitMb) * 100).toFixed(2);

      return Response.json({
        success: true,
        stats: {
          tables: counts || {},
          storage: {
            used_mb: Number(totalSizeMb),
            limit_mb: limitMb,
            percentage: Number(percentageUsed),
            free_mb: (limitMb - Number(totalSizeMb)).toFixed(2),
          },
          ru_limit: "50.000.000 Request Units (RU) / bulan",
          status: "Healthy / Active",
        }
      });
    }

    // ==========================================
    // CHECKERS, PACKERS & PICKERS MAPPING (SO -> Checker, Packer, Picker)
    // Multi-Warehouse Support: MBI -> so_checkers, MAI -> so_checkers_mai
    // ==========================================
    if (action === "get_checkers") {
      const warehouse = (searchParams.get("warehouse") || "MBI").toUpperCase() === "MAI" ? "MAI" : "MBI";
      const now = Date.now();
      if (memoryCheckersCache[warehouse] && (now - memoryCheckersCache[warehouse].ts < 60000)) {
        return compressedJsonResponse(req, memoryCheckersCache[warehouse].payload, {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
          "CDN-Cache-Control": "public, s-maxage=3600",
          "Vercel-CDN-Cache-Control": "public, s-maxage=3600",
        });
      }

      const tableName = warehouse === "MAI" ? "so_checkers_mai" : "so_checkers";
      // Fetch recent 60-day active checkers (LIMIT 8000) to keep payload ~58KB so it fits well within Vercel 2MB Edge CDN limit
      const rows = (await conn.execute(
        `SELECT so_number, checker_name, packer_name, picker_name FROM ${tableName} WHERE updated_at >= NOW() - INTERVAL 60 DAY ORDER BY updated_at DESC LIMIT 8000`
      )) as Array<{
        so_number: string;
        checker_name: string;
        packer_name: string;
        picker_name: string;
      }>;
      const map: Record<string, { checker: string; packer: string; picker: string }> = {};
      if (Array.isArray(rows)) {
        const isBad = (s: string) => {
          if (!s || s === "-" || s === "#N/A") return true;
          const low = s.toLowerCase();
          return (
            low.startsWith("apotek") ||
            low.startsWith("apt ") ||
            low.startsWith("hak ") ||
            low.startsWith("pt ") ||
            low.startsWith("klinik") ||
            low.startsWith("rs ") ||
            low.startsWith("rumah sakit") ||
            low.startsWith("toko ") ||
            low.startsWith("halo ") ||
            low.startsWith("medika ") ||
            low.startsWith("cv ") ||
            low.startsWith("puskesmas") ||
            low.startsWith("dc ") ||
            low.includes("apotek") ||
            low.includes("00:00:00") ||
            low.includes("gmt") ||
            low.includes("wib") ||
            /^[0-9]+[a-z]*$/i.test(low) ||
            /^(mon|tue|wed|thu|fri|sat|sun)\s/i.test(low)
          );
        };

        for (const r of rows) {
          if (r.so_number && r.so_number !== "-" && r.so_number !== "#N/A") {
            const raw = String(r.so_number).trim();
            if (!raw) continue;
            let c = (r.checker_name || "").trim();
            let p = (r.packer_name || "").trim();
            let k = (r.picker_name || "").trim();

            if (isBad(c)) {
              if (p && !isBad(p)) {
                c = p;
                p = "";
              } else {
                c = "";
              }
            }
            if (isBad(p)) p = "";
            if (isBad(k)) k = "";

            const val = {
              checker: c || "-",
              packer: p || "-",
              picker: k || "-",
            };
            if (!map[raw]) map[raw] = val;
            const noSpace = raw.replace(/\s+/g, "");
            if (noSpace && !map[noSpace]) map[noSpace] = val;
          }
        }
      }

      const payload = { success: true, data: map };
      memoryCheckersCache[warehouse] = { payload, ts: now };

      // Edge CDN Caching (1 Hour edge cache, 24h stale-while-revalidate)
      // Real-time new checkers arrive <50ms directly from Firestore subscribeToCheckers
      return compressedJsonResponse(
        req, 
        payload,
        {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
          "CDN-Cache-Control": "public, s-maxage=3600",
          "Vercel-CDN-Cache-Control": "public, s-maxage=3600",
        }
      );
    }

    // ==========================================
    // QC REPORTS (Queue for SOs finished QC in warehouse, waiting for Oracle invoice upload)
    // ==========================================
    if (action === "qc_reports") {
      const warehouse = (searchParams.get("warehouse") || "MBI").toUpperCase() === "MAI" ? "MAI" : "MBI";
      const isFresh = searchParams.get("fresh") === "true";
      const now = Date.now();
      if (!isFresh && memoryQcReportsCache[warehouse] && (now - memoryQcReportsCache[warehouse].ts < 30000)) {
        return compressedJsonResponse(req, memoryQcReportsCache[warehouse].payload, {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          "CDN-Cache-Control": "public, s-maxage=60",
          "Vercel-CDN-Cache-Control": "public, s-maxage=60",
        });
      }

      // Direct Live Sync straight from the DO Checker app (Firebase RTDB, 0 dependency on GSheet)
      if (warehouse === "MBI") {
        try {
          const fbRes = await fetch('https://checkermbi-default-rtdb.asia-southeast1.firebasedatabase.app/done.json?orderBy="completedAt"&limitToLast=100');
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            if (fbData && typeof fbData === "object") {
              const entries = Object.entries(fbData);
              const liveRows: (string | number | null)[][] = [];
              for (const [so, v] of entries) {
                const cleanSo = String(so).trim();
                if (!cleanSo || cleanSo === "-" || cleanSo === "#N/A") continue;
                const d = v as any;
                let waktuKirim = null;
                if (d.completedAt) {
                  const dt = new Date(Number(d.completedAt));
                  if (!isNaN(dt.getTime())) {
                    const day = String(dt.getDate()).padStart(2, "0");
                    const mon = String(dt.getMonth() + 1).padStart(2, "0");
                    const yr = dt.getFullYear();
                    const H = String(dt.getHours()).padStart(2, "0");
                    const M = String(dt.getMinutes()).padStart(2, "0");
                    waktuKirim = `${day}/${mon}/${yr} ${H}:${M}`;
                  }
                }
                const noDo = d.doNum ? String(d.doNum).trim() : null;
                const cust = d.customer ? String(d.customer).trim() : null;
                const checker = d.checkerName ? String(d.checkerName).trim() : "-";
                const packer = d.packerName ? String(d.packerName).trim() : null;
                const picker = d.pickerName ? String(d.pickerName).trim() : null;
                const totItem = Number(d.itemCount) || 0;
                const totQty = Number(d.totalQty) || totItem;

                liveRows.push([
                  "MBI", cleanSo, noDo, cust, waktuKirim, checker, packer, picker, totItem, totQty
                ]);
              }

              if (liveRows.length > 0) {
                const placeholders = liveRows.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'QC_DONE')").join(", ");
                await conn.execute(
                  `INSERT INTO qc_reports (
                    warehouse, so_number, no_do, customer_name, waktu_kirim,
                    checker_name, packer_name, picker_name, total_item, total_qty, status
                  ) VALUES ${placeholders}
                  ON DUPLICATE KEY UPDATE
                    no_do = IF(VALUES(no_do) IS NOT NULL AND VALUES(no_do) != '', VALUES(no_do), qc_reports.no_do),
                    customer_name = IF(VALUES(customer_name) IS NOT NULL AND VALUES(customer_name) != '', VALUES(customer_name), qc_reports.customer_name),
                    waktu_kirim = IF(VALUES(waktu_kirim) IS NOT NULL AND VALUES(waktu_kirim) != '', VALUES(waktu_kirim), qc_reports.waktu_kirim),
                    checker_name = IF(VALUES(checker_name) IS NOT NULL AND VALUES(checker_name) != '-' AND VALUES(checker_name) != '', VALUES(checker_name), qc_reports.checker_name),
                    packer_name = IF(VALUES(packer_name) IS NOT NULL AND VALUES(packer_name) != '', VALUES(packer_name), qc_reports.packer_name),
                    picker_name = IF(VALUES(picker_name) IS NOT NULL AND VALUES(picker_name) != '', VALUES(picker_name), qc_reports.picker_name),
                    total_item = IF(VALUES(total_item) > 0, VALUES(total_item), qc_reports.total_item),
                    total_qty = IF(VALUES(total_qty) > 0, VALUES(total_qty), qc_reports.total_qty)`,
                  liveRows.flat()
                );

                // Also keep so_checkers in sync so invoice table has live checker/picker/packer from DO Checker
                const checkerRows = liveRows.map((r) => [r[1], r[5], r[6], r[7]]);
                const checkerPlaceholders = checkerRows.map(() => "(?, ?, ?, ?)").join(", ");
                await conn.execute(
                  `INSERT INTO so_checkers (so_number, checker_name, packer_name, picker_name)
                   VALUES ${checkerPlaceholders}
                   ON DUPLICATE KEY UPDATE
                     checker_name = IF(VALUES(checker_name) IS NOT NULL AND VALUES(checker_name) != '-' AND VALUES(checker_name) != '', VALUES(checker_name), so_checkers.checker_name),
                     packer_name = IF(VALUES(packer_name) IS NOT NULL AND VALUES(packer_name) != '', VALUES(packer_name), so_checkers.packer_name),
                     picker_name = IF(VALUES(picker_name) IS NOT NULL AND VALUES(picker_name) != '', VALUES(picker_name), so_checkers.picker_name)`,
                  checkerRows.flat()
                );
              }
            }
          }
        } catch (e) {
          console.warn("Direct Firebase sync error:", e);
        }
      }

      const tableName = warehouse === "MAI" ? "so_checkers_mai" : "so_checkers";
      const rows = (await conn.execute(
        `SELECT 
           ? as warehouse,
           t.so_number,
           MAX(t.no_do) as no_do,
           MAX(t.customer_name) as customer_name,
           MAX(t.so_date) as so_date,
           MAX(t.waktu_kirim) as waktu_kirim,
           COALESCE(NULLIF(MAX(t.checker_name), '-'), '-') as checker_name,
           COALESCE(NULLIF(MAX(t.packer_name), '-'), '-') as packer_name,
           COALESCE(NULLIF(MAX(t.picker_name), '-'), '-') as picker_name,
           COALESCE(MAX(t.kategori), '1P') as kategori,
           COALESCE(MAX(t.kategori_produk), 'FARMA') as kategori_produk,
           MAX(t.total_item) as total_item,
           MAX(t.total_qty) as total_qty,
           MAX(t.barang_catatan) as barang_catatan,
           COALESCE(MAX(t.is_done), '') as is_done,
           MAX(t.done_by) as done_by,
           MAX(t.done_at) as done_at,
           MAX(t.noted_items) as noted_items,
           COALESCE(MAX(t.status), 'QC_DONE') as status,
           MAX(t.sheet_row) as sheet_row,
           MAX(t.updated_at) as updated_at
         FROM (
           SELECT 
             warehouse, so_number, no_do, customer_name, so_date, waktu_kirim,
             checker_name, packer_name, picker_name, kategori, kategori_produk,
             total_item, total_qty, barang_catatan, is_done, done_by, done_at, noted_items, status, sheet_row, updated_at
           FROM qc_reports
           WHERE warehouse = ? AND updated_at >= NOW() - INTERVAL 30 DAY
           UNION ALL
           SELECT 
             ? as warehouse, so_number, NULL as no_do, NULL as customer_name, NULL as so_date, NULL as waktu_kirim,
             checker_name, packer_name, picker_name, '1P' as kategori, 'FARMA' as kategori_produk,
             0 as total_item, 0 as total_qty, 0 as barang_catatan, '' as is_done, NULL as done_by, NULL as done_at, NULL as noted_items, 'QC_DONE' as status, 0 as sheet_row, updated_at
           FROM ${tableName}
           WHERE updated_at >= NOW() - INTERVAL 30 DAY
             AND so_number IS NOT NULL AND LENGTH(TRIM(so_number)) >= 3 AND so_number != '-'
         ) t
         LEFT JOIN cancelled_qc_sos cqs ON t.so_number = cqs.so_number
         WHERE cqs.so_number IS NULL
         GROUP BY t.so_number
         ORDER BY updated_at DESC, sheet_row DESC
         LIMIT 1500;`,
        [warehouse, warehouse, warehouse]
      )) as any[];
      const payload = { success: true, count: rows.length, data: rows };
      memoryQcReportsCache[warehouse] = { payload, ts: Date.now() };

      return compressedJsonResponse(
        req,
        payload,
        {
          "Cache-Control": isFresh ? "no-store, no-cache, must-revalidate" : "public, s-maxage=60, stale-while-revalidate=300",
          "CDN-Cache-Control": isFresh ? "no-store" : "public, s-maxage=60",
          "Vercel-CDN-Cache-Control": isFresh ? "no-store" : "public, s-maxage=60",
        }
      );
    }

    // ==========================================
    // 1. CUSTOMERS DIRECTORY
    // ==========================================
    if (action === "get_all_customers_for_sheet") {
      const rows = await conn.execute(
        "SELECT * FROM customers WHERE (name != '#N/A' AND name != '' AND name IS NOT NULL) ORDER BY id ASC"
      );
      return Response.json({ success: true, count: (rows as any[]).length, data: rows });
    }

    if (action === "customers") {
      const search = (searchParams.get("search") || "").trim();
      const category = searchParams.get("category") || "";
      const status = searchParams.get("status") || "";
      const activeOnly = searchParams.get("active_only") === "true";
      const hasDocs = searchParams.get("has_docs") === "true";
      const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
      const offset = Number(searchParams.get("offset")) || 0;

      let whereClause = "WHERE (name != '#N/A' AND name != '' AND name IS NOT NULL)";
      const params: (string | number)[] = [];

      if (activeOnly) {
        whereClause += " AND (status_merchant = 'ACTIVE' OR status_merchant IS NULL) AND name NOT LIKE '%[INACTIVE]%'";
      }
      if (hasDocs) {
        whereClause += " AND id IN (SELECT DISTINCT customer_id FROM customer_documents)";
      }

      if (search) {
        whereClause += " AND (name LIKE ? OR customer_id_oracle LIKE ? OR id LIKE ? OR address LIKE ? OR apj_name LIKE ? OR phone LIKE ?)";
        const s = `%${search}%`;
        params.push(s, s, s, s, s, s);
      }
      if (category && category !== "ALL") {
        whereClause += " AND category = ?";
        params.push(category);
      }
      if (status && status !== "ALL") {
        whereClause += " AND status_merchant = ?";
        params.push(status);
      }

      const countSql = `SELECT COUNT(*) as total FROM customers ${whereClause}`;
      const [countResult] = (await conn.execute(countSql, params)) as Array<{ total: number }>;

      const dataSql = `
        SELECT c.*, COALESCE(cd.doc_count, 0) AS doc_count
        FROM customers c
        LEFT JOIN (
          SELECT customer_id, COUNT(*) AS doc_count
          FROM customer_documents
          GROUP BY customer_id
        ) cd ON c.id = cd.customer_id
        ${whereClause.replace(/\b(name|customer_id_oracle|id|address|apj_name|phone|category|status_merchant)\b/g, "c.$1")}
        ORDER BY COALESCE(cd.doc_count, 0) DESC, CASE WHEN c.name LIKE '%[INACTIVE]%' THEN 1 ELSE 0 END ASC, c.name ASC
        LIMIT ? OFFSET ?
      `;
      const rows = await conn.execute(dataSql, [...params, limit, offset]);

      const isKomplainSuggestion = activeOnly && limit <= 200 && !search && !category && !status;

      return compressedJsonResponse(
        req,
        {
          success: true,
          total: Number(countResult?.total || 0),
          data: rows,
          limit,
          offset,
        },
        {
          "Cache-Control": isKomplainSuggestion
            ? "public, max-age=3600, stale-while-revalidate=86400"
            : "no-store, no-cache, must-revalidate",
          "CDN-Cache-Control": isKomplainSuggestion
            ? "public, s-maxage=86400, stale-while-revalidate=604800"
            : "no-store",
          "Vercel-CDN-Cache-Control": isKomplainSuggestion
            ? "public, s-maxage=86400, stale-while-revalidate=604800"
            : "no-store",
        }
      );
    }

    // ==========================================
    // 1b. VIEW CUSTOMER DOCUMENT (PDF / IMAGE STREAM)
    // ==========================================
    if (action === "view_document") {
      const fileId = (searchParams.get("file_id") || "").trim();
      if (!fileId) {
        return Response.json({ success: false, error: "Missing file_id" }, { status: 400 });
      }

      const metaRows = (await conn.execute(
        "SELECT file_name, mime_type FROM customer_documents WHERE file_id = ? LIMIT 1",
        [fileId]
      )) as any[];
      const meta = metaRows[0];

      const chunkRows = (await conn.execute(
        "SELECT chunk_data FROM customer_document_chunks WHERE file_id = ? ORDER BY chunk_index ASC",
        [fileId]
      )) as any[];

      if (!chunkRows || chunkRows.length === 0) {
        // Fallback to Google Drive preview if stored on Drive
        return Response.redirect(`https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`, 302);
      }

      const fullBase64 = chunkRows.map((r) => r.chunk_data).join("");
      const buf = Buffer.from(fullBase64, "base64");
      const mimeType = meta?.mime_type || "application/pdf";
      const safeName = (meta?.file_name || "document").replace(/["\r\n]/g, "_");

      return new Response(buf, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(buf.length),
          "Content-Disposition": `inline; filename="${safeName}"`,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // ==========================================
    // 2. CUSTOMER DETAIL + HISTORI
    // ==========================================
    if (action === "customer_detail") {
      const id = searchParams.get("id");
      const name = searchParams.get("name");

      if (!id && !name) {
        return Response.json({ success: false, error: "Missing customer id or name" }, { status: 400 });
      }

      let custQuery = "SELECT * FROM customers WHERE id = ? LIMIT 1";
      let custParam = id;
      if (!id && name) {
        custQuery = "SELECT * FROM customers WHERE name = ? LIMIT 1";
        custParam = name;
      }

      const custRows = (await conn.execute(custQuery, [custParam])) as any[];
      const customer = custRows[0] || null;

      let returns: any[] = [];
      let fakturs: any[] = [];
      let documents: any[] = [];

      if (customer) {
        returns = (await conn.execute(
          "SELECT * FROM shipment_returns WHERE customer_name LIKE ? ORDER BY id DESC LIMIT 50",
          [`%${customer.name}%`]
        )) as any[];

        fakturs = (await conn.execute(
          "SELECT * FROM fakturs_archive WHERE customer_name LIKE ? ORDER BY created_at DESC LIMIT 50",
          [`%${customer.name}%`]
        )) as any[];

        try {
          documents = (await conn.execute(
            "SELECT file_id, file_name, mime_type, size_bytes, folder_id, folder_name, modified_at FROM customer_documents WHERE customer_id = ? ORDER BY file_name ASC",
            [customer.id]
          )) as any[];
        } catch (e) {
          documents = [];
        }
      }

      return compressedJsonResponse(
        req,
        {
          success: true,
          customer,
          returns,
          fakturs,
          documents,
        },
        {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "Vercel-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        }
      );
    }

    // ==========================================
    // 3. SHIPMENT RETURNS / KOMPLAIN (LIVE DATA)
    // ==========================================
    if (action === "return_photo") {
      const id = searchParams.get("id");
      if (!id) return Response.json({ success: false, error: "Missing ID" }, { status: 400 });
      const rows = (await conn.execute("SELECT photo_url FROM shipment_returns WHERE id = ? LIMIT 1", [id])) as Array<{ photo_url: string }>;
      return new Response(JSON.stringify({ success: true, photo_url: rows[0]?.photo_url || null }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
        }
      });
    }

    if (action === "returns") {
      const search = (searchParams.get("search") || "").trim();
      const status = searchParams.get("status") || "";
      const pbf = searchParams.get("pbf") || "";
      const category = searchParams.get("category") || "";
      const limit = Math.min(Number(searchParams.get("limit")) || 50, 5000);
      const offset = Number(searchParams.get("offset")) || 0;
      const includePhoto = searchParams.get("include_photo") === "1";

      let whereClause = "WHERE customer_name != '#N/A' AND customer_name != '' AND customer_name IS NOT NULL";
      const params: (string | number)[] = [];

      if (search) {
        whereClause += " AND (invoice_no LIKE ? OR so_no LIKE ? OR customer_name LIKE ? OR product_name LIKE ? OR reason LIKE ? OR person LIKE ? OR batch_no LIKE ? OR root_cause LIKE ? OR note LIKE ?)";
        const s = `%${search}%`;
        params.push(s, s, s, s, s, s, s, s, s);
      }
      if (status && status !== "ALL") {
        if (status === "Pending") {
          whereClause += " AND (status = 'Pending' OR status IS NULL OR status = '')";
        } else if (status === "In Progress") {
          whereClause += " AND (status LIKE 'In Progress%' OR status = 'In Progress (Operasional)' OR status = 'In Progress (Klaim & Retur)')";
        } else if (status === "In Progress (Operasional)") {
          whereClause += " AND (status = 'In Progress (Operasional)' OR inprogress_type = 'Operasional')";
        } else if (status === "In Progress (Klaim & Retur)") {
          whereClause += " AND (status = 'In Progress (Klaim & Retur)' OR inprogress_type = 'Klaim & Retur')";
        } else if (status === "Resolved") {
          whereClause += " AND (status = 'Resolved' OR status = 'Selesai')";
        } else if (status === "Rejected") {
          whereClause += " AND (status = 'Rejected' OR status = 'Ditolak' OR status = 'Gagal')";
        } else if (status === "Unresolved" || status === "Open case") {
          whereClause += " AND (status != 'Resolved' AND status != 'Rejected' AND status != 'Ditolak' AND status != 'Gagal')";
        } else {
          whereClause += " AND status = ?";
          params.push(status);
        }
      }
      if (pbf && pbf !== "ALL") {
        whereClause += " AND pbf = ?";
        params.push(pbf);
      }
      if (category && category !== "ALL") {
        whereClause += " AND category = ?";
        params.push(category);
      }
      const monthParam = (searchParams.get("month") || "").trim();
      if (monthParam && monthParam !== "ALL") {
        const mNum = Number(monthParam);
        const mStr = String(mNum).padStart(2, '0');
        whereClause += " AND (month = ? OR report_date LIKE ? OR invoice_date LIKE ?)";
        params.push(mNum, `%-${mStr}-%`, `%-${mStr}-%`);
      }
      const weekParam = (searchParams.get("week") || "").trim();
      if (weekParam && weekParam !== "ALL") {
        if (weekParam === "LAST_3") {
          whereClause += " AND week >= (SELECT COALESCE(MAX(week), 45) - 2 FROM shipment_returns) AND week <= (SELECT COALESCE(MAX(week), 45) FROM shipment_returns)";
        } else if (weekParam.startsWith("3W:") || weekParam.includes("-")) {
          const clean = weekParam.replace(/^3W:/i, "");
          const [s1, s2] = clean.split("-");
          const n1 = Number(s1.replace(/[^0-9]/g, ""));
          const n2 = Number(s2.replace(/[^0-9]/g, ""));
          if (n1 > 0 && n2 > 0) {
            const minW = Math.min(n1, n2);
            const maxW = Math.max(n1, n2);
            whereClause += " AND week >= ? AND week <= ?";
            params.push(minW, maxW);
          }
        } else {
          const wNum = Number(weekParam.replace(/[^0-9]/g, ""));
          if (!isNaN(wNum) && wNum > 0) {
            whereClause += " AND week = ?";
            params.push(wNum);
          }
        }
      }

      const countSql = `SELECT COUNT(*) as total FROM shipment_returns ${whereClause}`;
      const [countResult] = (await conn.execute(countSql, params)) as Array<{ total: number }>;

      const dataSql = `
        SELECT 
          sr.id, sr.pbf, sr.report_date, sr.month, sr.week, sr.so_no, sr.customer_name,
          sr.invoice_no, sr.invoice_date, sr.product_name, sr.batch_no, sr.expiry_date,
          sr.qty, sr.reason, sr.person, sr.root_cause, sr.note, sr.status,
          sr.confirm, sr.action, sr.nota_retur_no, sr.resolved_date, sr.category, sr.created_at,
          sr.video_url, sr.reject_reason, sr.reject_media_url, sr.inprogress_type,
          CASE WHEN sr.photo_url IS NOT NULL AND CHAR_LENGTH(sr.photo_url) > 0 THEN 1 ELSE 0 END AS has_photo,
          CASE WHEN sr.video_url IS NOT NULL AND CHAR_LENGTH(sr.video_url) > 0 THEN 1 ELSE 0 END AS has_video,
          ${includePhoto ? "sr.photo_url" : "CASE WHEN CHAR_LENGTH(sr.photo_url) < 256 THEN sr.photo_url ELSE NULL END AS photo_url"},
          COALESCE(
            NULLIF(fa.order_date, ''),
            NULLIF(fa.transaction_date, ''),
            NULLIF(sr.invoice_date, '')
          ) AS matched_invoice_date
        FROM shipment_returns sr
        LEFT JOIN (
          SELECT no_faktur, MAX(order_date) as order_date, MAX(transaction_date) as transaction_date 
          FROM fakturs_archive 
          WHERE no_faktur != '' AND no_faktur IS NOT NULL
          GROUP BY no_faktur
        ) fa ON sr.invoice_no = fa.no_faktur
        ${whereClause.replace(/\b(invoice_no|so_no|customer_name|product_name|reason|person|batch_no|expiry_date|root_cause|note|status|pbf|category|month|week|report_date|invoice_date|action|nota_retur_no|resolved_date|inprogress_type)\b/g, 'sr.$1')}
        ORDER BY CASE WHEN sr.report_date IS NOT NULL AND sr.report_date != '' THEN sr.report_date ELSE '1970-01-01' END DESC, sr.id DESC 
        LIMIT ? OFFSET ?
      `;
      const rows = await conn.execute(dataSql, [...params, limit, offset]);

      // Quick statistics
      let statsCondition = "";
      const statsQueryParams: (string | number)[] = [];
      if (monthParam && monthParam !== "ALL") {
        const mNum = Number(monthParam);
        const mStr = String(mNum).padStart(2, '0');
        statsCondition = " WHERE (month = ? OR report_date LIKE ? OR invoice_date LIKE ?)";
        statsQueryParams.push(mNum, `%-${mStr}-%`, `%-${mStr}-%`);
      }

      const [stats] = (await conn.execute(`
        SELECT 
          COUNT(*) as totalAll,
          SUM(CASE WHEN LOWER(status) = 'resolved' OR LOWER(status) LIKE '%selesai%' THEN 1 ELSE 0 END) as totalResolved,
          SUM(CASE WHEN LOWER(status) = 'pending' OR status IS NULL OR status = '' THEN 1 ELSE 0 END) as totalPending,
          SUM(CASE WHEN LOWER(status) LIKE '%in progress%' THEN 1 ELSE 0 END) as totalInProgress,
          SUM(CASE WHEN status = 'In Progress (Operasional)' OR inprogress_type = 'Operasional' THEN 1 ELSE 0 END) as totalInProgressOperasional,
          SUM(CASE WHEN status = 'In Progress (Klaim & Retur)' OR inprogress_type = 'Klaim & Retur' THEN 1 ELSE 0 END) as totalInProgressKlaim,
          SUM(CASE WHEN pbf = 'MBI' THEN 1 ELSE 0 END) as totalMbi,
          SUM(CASE WHEN pbf = 'MAI' THEN 1 ELSE 0 END) as totalMai,
          SUM(CASE WHEN pbf = 'MBI' AND LOWER(status) NOT LIKE '%reject%' AND (confirm = 'Approve' OR confirm = '' OR confirm IS NULL) THEN 1 ELSE 0 END) as mbiApproved,
          SUM(CASE WHEN pbf = 'MAI' AND LOWER(status) NOT LIKE '%reject%' AND (confirm = 'Approve' OR confirm = '' OR confirm IS NULL) THEN 1 ELSE 0 END) as maiApproved,
          SUM(CASE WHEN pbf = 'MBI' AND LOWER(status) NOT LIKE '%resolved%' AND LOWER(status) NOT LIKE '%reject%' AND (confirm != 'Reject' OR confirm IS NULL) THEN 1 ELSE 0 END) as openMbi,
          SUM(CASE WHEN pbf = 'MAI' AND LOWER(status) NOT LIKE '%resolved%' AND LOWER(status) NOT LIKE '%reject%' AND (confirm != 'Reject' OR confirm IS NULL) THEN 1 ELSE 0 END) as openMai,
          SUM(CASE WHEN LOWER(status) NOT LIKE '%resolved%' AND LOWER(status) NOT LIKE '%reject%' AND (confirm != 'Reject' OR confirm IS NULL) THEN 1 ELSE 0 END) as totalOpen,
          SUM(CASE WHEN LOWER(status) = 'rejected' OR LOWER(status) LIKE '%reject%' OR LOWER(status) LIKE '%tolak%' THEN 1 ELSE 0 END) as totalReject
        FROM shipment_returns ${statsCondition};
      `, statsQueryParams)) as any[];

      const isFreshReq = searchParams.get("fresh") === "true" || searchParams.has("_t");

      return compressedJsonResponse(
        req, 
        {
          success: true,
          total: Number(countResult?.total || 0),
          stats: {
            totalAll: Number(stats?.totalAll || 0),
            totalResolved: Number(stats?.totalResolved || 0),
            totalPending: Number(stats?.totalPending || 0),
            totalInProgress: Number(stats?.totalInProgress || 0),
            totalInProgressOperasional: Number(stats?.totalInProgressOperasional || 0),
            totalInProgressKlaim: Number(stats?.totalInProgressKlaim || 0),
            totalMbi: Number(stats?.totalMbi || 0),
            totalMai: Number(stats?.totalMai || 0),
            mbiApproved: Number(stats?.mbiApproved || 0),
            maiApproved: Number(stats?.maiApproved || 0),
            openMbi: Number(stats?.openMbi || 0),
            openMai: Number(stats?.openMai || 0),
            totalOpen: Number(stats?.totalOpen || 0),
            totalReject: Number(stats?.totalReject || 0),
          },
          data: rows,
          limit,
          offset,
        },
        {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          "CDN-Cache-Control": "public, s-maxage=60",
          "Vercel-CDN-Cache-Control": "public, s-maxage=60",
        }
      );
    }

    // ==========================================
    // 4. ACTIVE COMPLAINTS MAP (UNTUK FAKTUR TRACKER)
    // ==========================================
    if (action === "active_complaints_map") {
      // Returns a map of customer_name -> count of unresolved complaints
      const rows = (await conn.execute(`
        SELECT customer_name, COUNT(*) as cnt 
        FROM shipment_returns 
        WHERE status NOT LIKE '%Resolved%' AND customer_name != ''
        GROUP BY customer_name
      `)) as Array<{ customer_name: string; cnt: number }>;

      const map: Record<string, number> = {};
      for (const r of rows) {
        if (r.customer_name) {
          map[r.customer_name.trim().toLowerCase()] = Number(r.cnt);
        }
      }

      return compressedJsonResponse(
        req,
        { success: true, map },
        {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "Vercel-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        }
      );
    }

    // ==========================================
    // 4.1. PUBLIC RETURN TRACKER (KHUSUS APOTEK)
    // ==========================================
    if (action === "track_return") {
      const invoiceNo = (searchParams.get("invoice_no") || "").trim();
      if (!invoiceNo) {
        return Response.json({ success: false, error: "Nomor faktur wajib diisi" }, { status: 400 });
      }

      const rows = (await conn.execute(
        `SELECT id, invoice_no, so_no, customer_name, product_name, qty, reason, status, confirm, action, nota_retur_no, resolved_date, report_date, photo_url, note, video_url, reject_reason, reject_media_url, inprogress_type
         FROM shipment_returns 
         WHERE invoice_no = ? OR invoice_no LIKE ?
         ORDER BY id DESC LIMIT 20`,
        [invoiceNo, `%${invoiceNo}%`]
      )) as any[];

      return compressedJsonResponse(
        req,
        { success: true, count: rows.length, data: rows },
        {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "CDN-Cache-Control": "no-store",
          "Vercel-CDN-Cache-Control": "no-store",
        }
      );
    }

    // ==========================================
    // 5. FAKTURS ARCHIVE & CHECK (DUAL-SYNC)
    // ==========================================
    if (action === "count") {
      const result = (await conn.execute("SELECT COUNT(*) as count FROM fakturs_archive;")) as Array<{ count: number }>;
      return Response.json({
        success: true,
        totalArchived: Number(result[0]?.count || 0),
        timestamp: Date.now(),
      });
    }

    if (action === "keys") {
      const allKeys: string[] = [];
      let lastKey = "";
      while (true) {
        const batch = (await conn.execute(
          "SELECT invoice_key FROM fakturs_archive WHERE invoice_key > ? AND invoice_key NOT LIKE 'TEST-%' ORDER BY invoice_key ASC LIMIT 5000;",
          [lastKey]
        )) as Array<{ invoice_key: string }>;
        if (!batch || batch.length === 0) break;
        for (const r of batch) allKeys.push(r.invoice_key);
        lastKey = batch[batch.length - 1].invoice_key;
        if (batch.length < 5000) break;
      }
      return compressedJsonResponse(
        req,
        { success: true, count: allKeys.length, keys: allKeys },
        {
          "CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          "Vercel-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        }
      );
    }

    if (action === "check") {
      const now = Date.now();
      let totalCount = 0;
      let maxUpdated = 0;

      if (memoryCheckCache && (now - memoryCheckCache.ts < 15000)) {
        totalCount = memoryCheckCache.payload.totalCount;
        maxUpdated = memoryCheckCache.payload.maxUpdated;
      } else {
        const result = (await conn.execute(
          "SELECT COUNT(*) as count, UNIX_TIMESTAMP(MAX(updated_at)) as max_updated FROM fakturs_archive WHERE invoice_key NOT LIKE 'TEST-%';"
        )) as Array<{ count: number; max_updated: number | null }>;
        totalCount = Number(result[0]?.count || 0);
        maxUpdated = Number(result[0]?.max_updated || 0);
        memoryCheckCache = { payload: { totalCount, maxUpdated }, ts: now };
      }

      const clientCount = Number(searchParams.get("count") || 0);
      const clientUpdated = Number(searchParams.get("updated") || 0);
      const isUpToDate = clientCount === totalCount && totalCount > 0 && clientUpdated > 0 && clientUpdated >= maxUpdated;

      return compressedJsonResponse(
        req,
        {
          success: true,
          upToDate: isUpToDate,
          totalCount,
          maxUpdated,
        },
        {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
          "CDN-Cache-Control": "public, s-maxage=30",
          "Vercel-CDN-Cache-Control": "public, s-maxage=30",
        }
      );
    }

    if (action === "delta") {
      const sinceTimestamp = Number(searchParams.get("since") || 0);
      const cursor = (searchParams.get("cursor") || "").trim();
      const limit = Math.min(Number(searchParams.get("limit")) || 5000, 10000);

      const querySql = sinceTimestamp > 0
        ? cursor
          ? `SELECT 
              invoice_key, no_faktur, no_sales_order, customer_name,
              order_date, transaction_date, jenis_transaksi, kategori,
              kategori_produk, status_cetak, printed_at, printed_by,
              total_harga, items_json, UNIX_TIMESTAMP(updated_at) as row_updated
            FROM fakturs_archive 
            WHERE invoice_key NOT LIKE 'TEST-%' AND UNIX_TIMESTAMP(updated_at) > ? AND invoice_key > ?
            ORDER BY invoice_key ASC LIMIT ?;`
          : `SELECT 
              invoice_key, no_faktur, no_sales_order, customer_name,
              order_date, transaction_date, jenis_transaksi, kategori,
              kategori_produk, status_cetak, printed_at, printed_by,
              total_harga, items_json, UNIX_TIMESTAMP(updated_at) as row_updated
            FROM fakturs_archive 
            WHERE invoice_key NOT LIKE 'TEST-%' AND UNIX_TIMESTAMP(updated_at) > ?
            ORDER BY invoice_key ASC LIMIT ?;`
        : cursor
          ? `SELECT 
              invoice_key, no_faktur, no_sales_order, customer_name,
              order_date, transaction_date, jenis_transaksi, kategori,
              kategori_produk, status_cetak, printed_at, printed_by,
              total_harga, items_json, UNIX_TIMESTAMP(updated_at) as row_updated
            FROM fakturs_archive 
            WHERE invoice_key NOT LIKE 'TEST-%' AND invoice_key > ?
            ORDER BY invoice_key ASC LIMIT ?;`
          : `SELECT 
              invoice_key, no_faktur, no_sales_order, customer_name,
              order_date, transaction_date, jenis_transaksi, kategori,
              kategori_produk, status_cetak, printed_at, printed_by,
              total_harga, items_json, UNIX_TIMESTAMP(updated_at) as row_updated
            FROM fakturs_archive 
            WHERE invoice_key NOT LIKE 'TEST-%'
            ORDER BY invoice_key ASC LIMIT ?;`;

      const queryParams = sinceTimestamp > 0
        ? (cursor ? [sinceTimestamp, cursor, limit] : [sinceTimestamp, limit])
        : (cursor ? [cursor, limit] : [limit]);

      const deltaRows = (await conn.execute(querySql, queryParams)) as Array<{
        invoice_key: string;
        no_faktur: string;
        no_sales_order: string;
        customer_name: string;
        order_date: string;
        transaction_date: string;
        jenis_transaksi: string;
        kategori: string;
        kategori_produk: string;
        status_cetak: number;
        printed_at: string | null;
        printed_by: string | null;
        total_harga: string | number;
        items_json: string | null;
        row_updated?: number | string;
      }>;

      let maxUpdated = sinceTimestamp;
      const docs = deltaRows.map((r) => {
        if (r.row_updated) {
          const ts = Number(r.row_updated);
          if (ts > maxUpdated) maxUpdated = ts;
        }
        let parsedItems: unknown[] = [];
        if (r.items_json) {
          try {
            const parsed = typeof r.items_json === "string" ? JSON.parse(r.items_json) : r.items_json;
            parsedItems = Array.isArray(parsed) ? parsed : [];
          } catch {
            parsedItems = [];
          }
        }

        const rowUpdatedNum = Number(r.row_updated || 0);
        const rowUpdatedIso = rowUpdatedNum > 0 ? new Date(rowUpdatedNum * 1000).toISOString() : new Date().toISOString();

        return {
          id: r.invoice_key,
          no_faktur: r.no_faktur,
          no_sales_order: r.no_sales_order || "-",
          customer_name: r.customer_name || "-",
          order_date: r.order_date || "-",
          transaction_date: r.transaction_date || r.order_date || "-",
          jenis_transaksi: r.jenis_transaksi || "DOO",
          kategori: r.kategori || "3P",
          status_cetak: Number(r.status_cetak) === 1,
          printed_at: r.printed_at || null,
          printed_by: r.printed_by || null,
          row_updated: rowUpdatedNum,
          updated_at: rowUpdatedIso,
          extra: {
            nama_pelanggan: r.customer_name || "-",
            order_date: r.order_date || "-",
            transaction_date: r.transaction_date || r.order_date || "-",
            jenis_transaksi: r.jenis_transaksi || "DOO",
            kategori: r.kategori || "3P",
            total_harga: Number(r.total_harga || 0),
            row_updated: rowUpdatedNum,
            updated_at: rowUpdatedIso,
            items: parsedItems,
          },
        };
      });

      const nextCursor = deltaRows.length > 0 ? deltaRows[deltaRows.length - 1].invoice_key : null;
      const hasMore = deltaRows.length === limit;

      return compressedJsonResponse(
        req,
        {
          success: true,
          count: docs.length,
          fakturs: docs,
          maxUpdated,
          nextCursor,
          hasMore,
        },
        {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
          "CDN-Cache-Control": "public, s-maxage=10",
          "Vercel-CDN-Cache-Control": "public, s-maxage=10",
        }
      );
    }

    // ==========================================
    // 4.5. LOGISTICS ANALYTICS & PERSONNEL LEADERBOARD
    // ==========================================
    if (action === "personnel_stats") {
      const monthParam = (searchParams.get("month") || "").trim();
      const weekParam = (searchParams.get("week") || "").trim();
      let filterCondition = "";
      const statsParams: (string | number)[] = [];

      if (monthParam && monthParam !== "ALL") {
        const mNum = Number(monthParam);
        const mStr = String(mNum).padStart(2, '0');
        filterCondition += " AND (month = ? OR report_date LIKE ? OR invoice_date LIKE ?)";
        statsParams.push(mNum, `%-${mStr}-%`, `%-${mStr}-%`);
      }

      if (weekParam && weekParam !== "ALL") {
        if (weekParam === "LAST_3") {
          filterCondition += " AND week >= (SELECT COALESCE(MAX(week), 45) - 2 FROM shipment_returns) AND week <= (SELECT COALESCE(MAX(week), 45) FROM shipment_returns)";
        } else if (weekParam.startsWith("3W:") || weekParam.includes("-")) {
          const clean = weekParam.replace(/^3W:/i, "");
          const [s1, s2] = clean.split("-");
          const n1 = Number(s1.replace(/[^0-9]/g, ""));
          const n2 = Number(s2.replace(/[^0-9]/g, ""));
          if (n1 > 0 && n2 > 0) {
            const minW = Math.min(n1, n2);
            const maxW = Math.max(n1, n2);
            filterCondition += " AND week >= ? AND week <= ?";
            statsParams.push(minW, maxW);
          }
        } else {
          const wNum = Number(weekParam.replace(/[^0-9]/g, ""));
          if (!isNaN(wNum) && wNum > 0) {
            filterCondition += " AND week = ?";
            statsParams.push(wNum);
          }
        }
      }

      const reasonParam = (searchParams.get("reason") || "").trim();
      if (reasonParam && reasonParam !== "ALL") {
        if (reasonParam === "PRIMARY_4") {
          filterCondition += " AND reason IN ('Fisik yang dikirim kurang', 'Fisik yang dikirim lebih', 'Fisik yang dikirim salah', 'Fisik yang dikirim tidak ada')";
        } else if (reasonParam === "OTHER") {
          filterCondition += " AND (reason NOT IN ('Fisik yang dikirim kurang', 'Fisik yang dikirim lebih', 'Fisik yang dikirim salah', 'Fisik yang dikirim tidak ada') OR reason IS NULL)";
        } else {
          filterCondition += " AND reason = ?";
          statsParams.push(reasonParam);
        }
      }

      // Transparent case counts for the active filter
      const caseCountsResult = (await conn.execute(`
        SELECT 
          COUNT(*) as total_cases,
          SUM(CASE WHEN person != '' AND person IS NOT NULL AND UPPER(TRIM(person)) NOT IN ('REJECT', '-', '#N/A', 'ADMIN', 'NONE', 'NULL') THEN 1 ELSE 0 END) as with_person_count,
          SUM(CASE WHEN person = '' OR person IS NULL OR UPPER(TRIM(person)) IN ('REJECT', '-', '#N/A', 'ADMIN', 'NONE', 'NULL') THEN 1 ELSE 0 END) as unassigned_count,
          SUM(CASE WHEN pbf = 'MBI' THEN 1 ELSE 0 END) as mbi_total,
          SUM(CASE WHEN pbf = 'MAI' THEN 1 ELSE 0 END) as mai_total
        FROM shipment_returns
        WHERE 1=1 ${filterCondition}
      `, statsParams)) as any[];
      const caseCounts = caseCountsResult[0] || {
        total_cases: 0,
        with_person_count: 0,
        unassigned_count: 0,
        mbi_total: 0,
        mai_total: 0,
      };

      const rawReturns = (await conn.execute(`
        SELECT person, pbf, status
        FROM shipment_returns
        WHERE person != '' 
          AND person IS NOT NULL 
          AND UPPER(TRIM(person)) NOT IN ('REJECT', '-', '#N/A', 'ADMIN', 'NONE', 'NULL')
          ${filterCondition}
      `, statsParams)) as any[];

      const personMap = new Map<string, {
        person: string;
        total_cases: number;
        mbi_cases: number;
        mai_cases: number;
        resolved_cases: number;
        pending_cases: number;
      }>();

      // Shared parser (lib/personnelUtils.ts) keeps Personil tab and Analisis tab 100% identical
      for (const r of rawReturns) {
        const names = parsePersonNames(r.person);
        for (const canonical of names) {
          let entry = personMap.get(canonical);
          if (!entry) {
            entry = {
              person: canonical,
              total_cases: 0,
              mbi_cases: 0,
              mai_cases: 0,
              resolved_cases: 0,
              pending_cases: 0,
            };
            personMap.set(canonical, entry);
          }

          entry.total_cases++;
          if (r.pbf === "MBI") entry.mbi_cases++;
          if (r.pbf === "MAI") entry.mai_cases++;
          if (String(r.status || "").toLowerCase().includes("resolved")) {
            entry.resolved_cases++;
          } else {
            entry.pending_cases++;
          }
        }
      }

      const rows = Array.from(personMap.values())
        .sort((a, b) => b.total_cases - a.total_cases);

      const rootCauses = (await conn.execute(`
        SELECT 
          root_cause,
          COUNT(*) as total
        FROM shipment_returns
        WHERE root_cause != '' AND root_cause IS NOT NULL AND UPPER(TRIM(root_cause)) NOT IN ('-', '#N/A', 'NONE', 'NULL')
          ${filterCondition}
        GROUP BY root_cause
        ORDER BY total DESC
        LIMIT 20;
      `, statsParams)) as any[];

      const reasons = (await conn.execute(`
        SELECT 
          reason,
          COUNT(*) as total
        FROM shipment_returns
        WHERE reason != '' AND reason IS NOT NULL AND UPPER(TRIM(reason)) NOT IN ('-', '#N/A', 'NONE', 'NULL')
          ${filterCondition}
        GROUP BY reason
        ORDER BY total DESC
        LIMIT 20;
      `, statsParams)) as any[];

      const pbfComparison = (await conn.execute(`
        SELECT 
          pbf,
          COUNT(*) as total,
          SUM(CASE WHEN status LIKE '%Resolved%' THEN 1 ELSE 0 END) as resolved,
          SUM(CASE WHEN status NOT LIKE '%Resolved%' THEN 1 ELSE 0 END) as pending
        FROM shipment_returns
        WHERE pbf IN ('MBI', 'MAI')
          ${filterCondition}
        GROUP BY pbf;
      `, statsParams)) as any[];

      return compressedJsonResponse(req, {
        success: true,
        personnel: rows,
        caseCounts,
        rootCauses,
        reasons,
        pbfComparison,
        selectedMonth: monthParam || "ALL",
        selectedWeek: weekParam || "ALL",
      }, {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "CDN-Cache-Control": "public, s-maxage=60",
        "Vercel-CDN-Cache-Control": "public, s-maxage=60",
      });
    }

    if (action === "fetch_all") {
      const fakturs = (await conn.execute(
        "SELECT * FROM fakturs_archive ORDER BY order_date DESC LIMIT 5000;"
      )) as any[];
      return compressedJsonResponse(req, { success: true, count: fakturs.length, data: fakturs });
    }

    // ==========================================
    // 6. RETURN REQUESTS (PENGAJUAN RETUR)
    // ==========================================
    if (action === "return_requests") {
      const search = (searchParams.get("search") || "").trim();
      const status = searchParams.get("status") || "";
      const limit = Math.min(Number(searchParams.get("limit")) || 300, 1000);
      const offset = Number(searchParams.get("offset")) || 0;

      let whereClause = "WHERE 1=1";
      const params: (string | number)[] = [];

      if (search) {
        whereClause += " AND (request_id LIKE ? OR customer_name LIKE ? OR invoice_no LIKE ? OR product_name LIKE ? OR requester_name LIKE ?)";
        const s = `%${search}%`;
        params.push(s, s, s, s, s);
      }
      if (status && status !== "ALL" && status !== "all") {
        if (status.toLowerCase() === "in progress") {
          whereClause += " AND LOWER(status) IN ('in progress', 'dikonfirmasi', 'dalam perjalanan', 'terkirim')";
        } else if (status.toLowerCase() === "resolved") {
          whereClause += " AND LOWER(status) IN ('resolved', 'selesai')";
        } else if (status.toLowerCase() === "rejected") {
          whereClause += " AND LOWER(status) IN ('rejected', 'gagal')";
        } else {
          whereClause += " AND LOWER(status) = LOWER(?)";
          params.push(status);
        }
      }

      const rows = (await conn.execute(
        `SELECT * FROM return_requests ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      )) as any[];

      const counts = (await conn.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN LOWER(status) = 'dikonfirmasi' THEN 1 ELSE 0 END) as dikonfirmasi,
          SUM(CASE WHEN LOWER(status) = 'dalam perjalanan' THEN 1 ELSE 0 END) as dalam_perjalanan,
          SUM(CASE WHEN LOWER(status) = 'terkirim' THEN 1 ELSE 0 END) as terkirim,
          SUM(CASE WHEN LOWER(status) = 'selesai' THEN 1 ELSE 0 END) as selesai,
          SUM(CASE WHEN LOWER(status) = 'gagal' THEN 1 ELSE 0 END) as gagal,
          SUM(CASE WHEN LOWER(status) IN ('in progress','dikonfirmasi','dalam perjalanan','terkirim') THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN LOWER(status) IN ('resolved','selesai') THEN 1 ELSE 0 END) as resolved,
          SUM(CASE WHEN LOWER(status) IN ('rejected','gagal') THEN 1 ELSE 0 END) as rejected
        FROM return_requests;
      `)) as any[];

      const summary = counts[0] || {};

      return compressedJsonResponse(req, {
        success: true,
        data: rows,
        summary: {
          total: Number(summary.total || 0),
          pending: Number(summary.pending || 0),
          dikonfirmasi: Number(summary.dikonfirmasi || 0),
          dalam_perjalanan: Number(summary.dalam_perjalanan || 0),
          terkirim: Number(summary.terkirim || 0),
          selesai: Number(summary.selesai || 0),
          gagal: Number(summary.gagal || 0),
          // 4-status baku
          in_progress: Number(summary.dikonfirmasi || 0) + Number(summary.dalam_perjalanan || 0) + Number(summary.terkirim || 0),
          resolved: Number(summary.selesai || 0),
          rejected: Number(summary.gagal || 0),
        },
      });
    }

    // ==========================================
    // 5.4. SMART ARCHIVE SEARCH (Full-Archive Search < 300ms across 19,000+ fakturs)
    // ==========================================
    if (action === "search_fakturs") {
      const q = (searchParams.get("q") || "").trim();
      const entity = (searchParams.get("entity") || "").trim().toUpperCase(); // "MBI" | "MAI"
      const limit = Math.min(Number(searchParams.get("limit")) || 60, 200);

      if (!q || q.length < 2) {
        return compressedJsonResponse(req, { success: true, count: 0, fakturs: [] });
      }

      const cleanQ = q.replace(/_(1p|2p|3p)$/i, "").trim();
      const s = `%${cleanQ}%`;

      let whereClause = `
        WHERE (
          no_faktur = ? 
          OR no_sales_order = ? 
          OR invoice_key = ?
          OR no_faktur LIKE ? 
          OR no_sales_order LIKE ? 
          OR customer_name LIKE ?
        )
        AND invoice_key NOT LIKE 'TEST-%'
      `;
      const params: (string | number)[] = [cleanQ, cleanQ, cleanQ, s, s, s];

      if (entity === "MAI") {
        whereClause += " AND (invoice_key LIKE 'MAI-%' OR customer_name LIKE '%MAI%')";
      } else if (entity === "MBI") {
        whereClause += " AND invoice_key NOT LIKE 'MAI-%'";
      }

      const rows = (await conn.execute(
        `SELECT 
          invoice_key, no_faktur, no_sales_order, customer_name,
          order_date, transaction_date, jenis_transaksi, kategori,
          kategori_produk, status_cetak, printed_at, printed_by,
          total_harga, items_json
        FROM fakturs_archive 
        ${whereClause}
        ORDER BY updated_at DESC LIMIT ?;`,
        [...params, limit]
      )) as any[];

      const docs = rows.map((r) => {
        let parsedItems: unknown[] = [];
        if (r.items_json) {
          try {
            const parsed = typeof r.items_json === "string" ? JSON.parse(r.items_json) : r.items_json;
            parsedItems = Array.isArray(parsed) ? parsed : [];
          } catch {
            parsedItems = [];
          }
        }

        const rowUpdatedNum = Number(r.row_updated || 0);
        const rowUpdatedIso = rowUpdatedNum > 0 ? new Date(rowUpdatedNum * 1000).toISOString() : new Date().toISOString();

        return {
          id: r.invoice_key,
          no_faktur: r.no_faktur,
          no_sales_order: r.no_sales_order || "-",
          customer_name: r.customer_name || "-",
          order_date: r.order_date || "-",
          transaction_date: r.transaction_date || r.order_date || "-",
          jenis_transaksi: r.jenis_transaksi || "DOO",
          kategori: r.kategori || "3P",
          status_cetak: Number(r.status_cetak) === 1,
          printed_at: r.printed_at || null,
          printed_by: r.printed_by || null,
          row_updated: rowUpdatedNum,
          updated_at: rowUpdatedIso,
          extra: {
            nama_pelanggan: r.customer_name || "-",
            order_date: r.order_date || "-",
            transaction_date: r.transaction_date || r.order_date || "-",
            jenis_transaksi: r.jenis_transaksi || "DOO",
            kategori: r.kategori || "3P",
            total_harga: Number(r.total_harga || 0),
            row_updated: rowUpdatedNum,
            updated_at: rowUpdatedIso,
            items: parsedItems,
          },
        };
      });

      return compressedJsonResponse(req, {
        success: true,
        count: docs.length,
        fakturs: docs,
        query: q,
      });
    }

    // ==========================================
    // 5.5. CURSOR-PAGINATED FAKTURS (Safely bypasses 4.5MB Vercel serverless limit)
    // ==========================================
    if (action === "paged") {
      const limit = Math.min(Number(searchParams.get("limit")) || 3500, 5000);
      const cursor = (searchParams.get("cursor") || "").trim();
      const hasOffset = searchParams.has("offset");
      const offset = Number(searchParams.get("offset") || 0);

      const rows = (await conn.execute(
        hasOffset
          ? `SELECT 
              invoice_key, no_faktur, no_sales_order, customer_name,
              order_date, transaction_date, jenis_transaksi, kategori,
              kategori_produk, status_cetak, printed_at, printed_by,
              total_harga, items_json, UNIX_TIMESTAMP(updated_at) as row_updated
            FROM fakturs_archive 
            WHERE invoice_key NOT LIKE 'TEST-%'
            ORDER BY invoice_key ASC LIMIT ? OFFSET ?;`
          : `SELECT 
              invoice_key, no_faktur, no_sales_order, customer_name,
              order_date, transaction_date, jenis_transaksi, kategori,
              kategori_produk, status_cetak, printed_at, printed_by,
              total_harga, items_json, UNIX_TIMESTAMP(updated_at) as row_updated
            FROM fakturs_archive 
            WHERE invoice_key > ? AND invoice_key NOT LIKE 'TEST-%'
            ORDER BY invoice_key ASC LIMIT ?;`,
        hasOffset ? [limit, offset] : [cursor, limit]
      )) as Array<{
        invoice_key: string;
        no_faktur: string;
        no_sales_order: string;
        customer_name: string;
        order_date: string;
        transaction_date: string;
        jenis_transaksi: string;
        kategori: string;
        kategori_produk: string;
        status_cetak: number;
        printed_at: string | null;
        printed_by: string | null;
        total_harga: string | number;
        items_json: string | null;
        row_updated?: number | string;
      }>;

      const resultMeta = (await conn.execute(
        "SELECT COUNT(*) as total_count, UNIX_TIMESTAMP(MAX(updated_at)) as max_updated FROM fakturs_archive WHERE invoice_key NOT LIKE 'TEST-%';"
      )) as Array<{ total_count: number | string; max_updated: number | null }>;
      const totalCount = Number(resultMeta[0]?.total_count || 0);
      const maxUpdated = Number(resultMeta[0]?.max_updated || 0);

      const docs = rows.map((r) => {
        let parsedItems: unknown[] = [];
        if (r.items_json) {
          try {
            const parsed = typeof r.items_json === "string" ? JSON.parse(r.items_json) : r.items_json;
            parsedItems = Array.isArray(parsed) ? parsed : [];
          } catch {
            parsedItems = [];
          }
        }

        const rowUpdatedNum = Number(r.row_updated || 0);
        const rowUpdatedIso = rowUpdatedNum > 0 ? new Date(rowUpdatedNum * 1000).toISOString() : new Date().toISOString();

        return {
          id: r.invoice_key,
          no_faktur: r.no_faktur,
          no_sales_order: r.no_sales_order || "-",
          customer_name: r.customer_name || "-",
          order_date: r.order_date || "-",
          transaction_date: r.transaction_date || r.order_date || "-",
          jenis_transaksi: r.jenis_transaksi || "DOO",
          kategori: r.kategori || "3P",
          status_cetak: Number(r.status_cetak) === 1,
          printed_at: r.printed_at || null,
          printed_by: r.printed_by || null,
          row_updated: rowUpdatedNum,
          updated_at: rowUpdatedIso,
          extra: {
            nama_pelanggan: r.customer_name || "-",
            order_date: r.order_date || "-",
            transaction_date: r.transaction_date || r.order_date || "-",
            jenis_transaksi: r.jenis_transaksi || "DOO",
            kategori: r.kategori || "3P",
            total_harga: Number(r.total_harga || 0),
            row_updated: rowUpdatedNum,
            updated_at: rowUpdatedIso,
            items: parsedItems,
          },
        };
      });

      const nextCursor = rows.length > 0 ? rows[rows.length - 1].invoice_key : null;
      const hasMore = rows.length === limit;

      return compressedJsonResponse(
        req,
        {
          success: true,
          count: docs.length,
          totalCount,
          fakturs: docs,
          maxUpdated,
          nextCursor,
          hasMore,
        },
        {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
          "CDN-Cache-Control": "public, s-maxage=1800",
          "Vercel-CDN-Cache-Control": "public, s-maxage=1800",
        }
      );
    }

    // ==========================================
    // DEFAULT (!action): FETCH ALL FAKTURS FROM TiDB (Cursor Paginated to bypass 10k HTTP driver cap)
    // ==========================================
    if (!action) {
      const allRows: Array<{
        invoice_key: string;
        no_faktur: string;
        no_sales_order: string;
        customer_name: string;
        order_date: string;
        transaction_date: string;
        jenis_transaksi: string;
        kategori: string;
        kategori_produk: string;
        status_cetak: number;
        printed_at: string | null;
        printed_by: string | null;
        total_harga: string | number;
        items_json: string | null;
        row_updated?: number | string;
      }> = [];

      let lastKey = "";
      while (true) {
        const batch = (await conn.execute(
          `SELECT 
            invoice_key, no_faktur, no_sales_order, customer_name,
            order_date, transaction_date, jenis_transaksi, kategori,
            kategori_produk, status_cetak, printed_at, printed_by,
            total_harga, items_json, UNIX_TIMESTAMP(updated_at) as row_updated
          FROM fakturs_archive 
          WHERE invoice_key > ? AND invoice_key NOT LIKE 'TEST-%'
          ORDER BY invoice_key ASC LIMIT 5000;`,
          [lastKey]
        )) as typeof allRows;

        if (!batch || batch.length === 0) break;
        allRows.push(...batch);
        lastKey = batch[batch.length - 1].invoice_key;
        if (batch.length < 5000) break;
      }

      const resultMeta = (await conn.execute(
        "SELECT UNIX_TIMESTAMP(MAX(updated_at)) as max_updated FROM fakturs_archive WHERE invoice_key NOT LIKE 'TEST-%';"
      )) as Array<{ max_updated: number | null }>;
      const maxUpdated = Number(resultMeta[0]?.max_updated || 0);

      const docs = allRows.map((r) => {
        let parsedItems: unknown[] = [];
        if (r.items_json) {
          try {
            const parsed = typeof r.items_json === "string" ? JSON.parse(r.items_json) : r.items_json;
            parsedItems = Array.isArray(parsed) ? parsed : [];
          } catch {
            parsedItems = [];
          }
        }

        const rowUpdatedNum = Number(r.row_updated || 0);
        const rowUpdatedIso = rowUpdatedNum > 0 ? new Date(rowUpdatedNum * 1000).toISOString() : new Date().toISOString();

        return {
          id: r.invoice_key,
          no_faktur: r.no_faktur,
          no_sales_order: r.no_sales_order || "-",
          customer_name: r.customer_name || "-",
          order_date: r.order_date || "-",
          transaction_date: r.transaction_date || r.order_date || "-",
          jenis_transaksi: r.jenis_transaksi || "DOO",
          kategori: r.kategori || "3P",
          status_cetak: Number(r.status_cetak) === 1,
          printed_at: r.printed_at || null,
          printed_by: r.printed_by || null,
          row_updated: rowUpdatedNum,
          updated_at: rowUpdatedIso,
          extra: {
            nama_pelanggan: r.customer_name || "-",
            order_date: r.order_date || "-",
            transaction_date: r.transaction_date || r.order_date || "-",
            jenis_transaksi: r.jenis_transaksi || "DOO",
            kategori: r.kategori || "3P",
            total_harga: Number(r.total_harga || 0),
            row_updated: rowUpdatedNum,
            updated_at: rowUpdatedIso,
            items: parsedItems,
          },
        };
      });

      return compressedJsonResponse(
        req,
        {
          success: true,
          count: docs.length,
          fakturs: docs,
          maxUpdated,
        },
        {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
          "CDN-Cache-Control": "public, s-maxage=1800",
          "Vercel-CDN-Cache-Control": "public, s-maxage=1800",
        }
      );
    }

    return Response.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("GET /api/tidb error:", error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conn = getTiDBClient();
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      body = {};
    }
    const action = searchParams.get("action") || body?.action;

    // 0. Mark QC Done (Tindakan Admin: Selesai proses di Report QC)
    // 0. Mark ALL QC Done (Tandai Semua Selesai Sekaligus - Bulletproof INSERT ... ON DUPLICATE KEY UPDATE)
    if (action === "mark_all_qc_done") {
      const so_numbers = (Array.isArray(body?.so_numbers) ? body.so_numbers : []).map((s: any) => String(s).trim()).filter(Boolean);
      const warehouse = String(body?.warehouse || "MBI").toUpperCase() === "MAI" ? "MAI" : "MBI";
      const userName = String(body?.user_name || body?.userName || "Admin").trim();
      const nowFormatted = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

      if (so_numbers.length > 0) {
        for (let i = 0; i < so_numbers.length; i += 100) {
          const chunk = so_numbers.slice(i, i + 100);
          const placeholders = chunk.map(() => "(?, ?, 'DONE', ?, ?, 'QC_DONE')").join(", ");
          const params = chunk.flatMap((so: string) => [warehouse, so, userName, nowFormatted]);
          await conn.execute(
            `INSERT INTO qc_reports (warehouse, so_number, is_done, done_by, done_at, status)
             VALUES ${placeholders}
             ON DUPLICATE KEY UPDATE 
               is_done = VALUES(is_done),
               done_by = VALUES(done_by),
               done_at = VALUES(done_at),
               updated_at = CURRENT_TIMESTAMP`,
            params
          );
        }
        delete memoryQcReportsCache[warehouse];

        try {
          await conn.execute(
            `INSERT INTO activity_logs (user_name, user_email, action_type, module, target_id, details)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userName, body?.user_email || "", "MARK_ALL_QC_DONE", "REPORT_QC", `${so_numbers.length} SOs`, `Menandai DONE ${so_numbers.length} SO sekaligus (${warehouse})`]
          );
        } catch {}
      }

      return Response.json({ success: true, count: so_numbers.length, done_by: userName, done_at: nowFormatted });
    }

    // 0. Mark Single QC Done (Bulletproof INSERT ... ON DUPLICATE KEY UPDATE)
    if (action === "mark_qc_done") {
      const so_number = String(body?.so_number || searchParams.get("so_number") || "").trim();
      const warehouse = String(body?.warehouse || searchParams.get("warehouse") || "MBI").toUpperCase() === "MAI" ? "MAI" : "MBI";
      const userName = String(body?.user_name || body?.userName || "Admin").trim();
      const isDone = String(body?.is_done || "DONE").trim();
      const nowFormatted = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

      if (!so_number) {
        return Response.json({ success: false, error: "Missing so_number" }, { status: 400 });
      }

      await conn.execute(
        `INSERT INTO qc_reports (warehouse, so_number, is_done, done_by, done_at, status)
         VALUES (?, ?, ?, ?, ?, 'QC_DONE')
         ON DUPLICATE KEY UPDATE 
           is_done = VALUES(is_done),
           done_by = VALUES(done_by),
           done_at = VALUES(done_at),
           updated_at = CURRENT_TIMESTAMP`,
        [warehouse, so_number, isDone, userName, nowFormatted]
      );

      delete memoryQcReportsCache[warehouse];

      try {
        await conn.execute(
          `INSERT INTO activity_logs (user_name, user_email, action_type, module, target_id, details)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [userName, body?.user_email || "", "MARK_QC_DONE", "REPORT_QC", so_number, `Menandai DONE SO #${so_number} (${warehouse})`]
        );
      } catch {}

      return Response.json({ success: true, message: `SO ${so_number} berhasil ditandai ${isDone} oleh ${userName}`, done_by: userName, done_at: nowFormatted });
    }

    // 0. Cancel QC SO (Cancel by Oracle - keluarkan dari antrean Report QC)
    if (action === "cancel_qc_so") {
      const so_number = String(body?.so_number || searchParams.get("so_number") || "").trim();
      const warehouse = String(body?.warehouse || searchParams.get("warehouse") || "MBI").toUpperCase() === "MAI" ? "MAI" : "MBI";
      const userName = String(body?.user_name || body?.userName || "Admin").trim();
      const reason = String(body?.reason || "Cancel by Oracle").trim();

      if (!so_number) {
        return Response.json({ success: false, error: "Missing so_number" }, { status: 400 });
      }

      await conn.execute(`
        CREATE TABLE IF NOT EXISTS cancelled_qc_sos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          so_number VARCHAR(100) NOT NULL UNIQUE,
          warehouse VARCHAR(20) NOT NULL,
          cancelled_by VARCHAR(100) DEFAULT '',
          reason VARCHAR(255) DEFAULT 'Cancel by Oracle',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await conn.execute(
        `INSERT INTO cancelled_qc_sos (so_number, warehouse, cancelled_by, reason)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE reason = VALUES(reason), cancelled_by = VALUES(cancelled_by)`,
        [so_number, warehouse, userName, reason]
      );

      await conn.execute("DELETE FROM qc_reports WHERE so_number = ?", [so_number]);
      const tableName = warehouse === "MAI" ? "so_checkers_mai" : "so_checkers";
      await conn.execute(`DELETE FROM ${tableName} WHERE so_number = ?`, [so_number]);

      try {
        await conn.execute(
          `INSERT INTO activity_logs (user_name, user_email, action_type, module, target_id, details)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [userName, body?.user_email || "", "CANCEL_QC_SO", "REPORT_QC", so_number, `Membatalkan antrean QC SO #${so_number} (${warehouse}) - ${reason}`]
        );
      } catch {}

      return Response.json({ success: true, message: `SO ${so_number} berhasil dibatalkan dari antrean Report QC` });
    }

    // 0. Log Activity (Audit Trail)
    if (action === "log_activity") {
      const userName = String(body?.user_name || body?.userName || "User").trim();
      const userEmail = String(body?.user_email || body?.userEmail || "").trim();
      const actionType = String(body?.action_type || body?.actionType || "GENERAL").trim();
      const moduleName = String(body?.module || "SYSTEM").trim();
      const targetId = String(body?.target_id || body?.targetId || "").trim();
      const details = String(body?.details || "").trim();
      const metadata = body?.metadata ? JSON.stringify(body.metadata) : null;

      if (!details) {
        return Response.json({ success: false, error: "Missing log details" }, { status: 400 });
      }

      const res = await conn.execute(
        `INSERT INTO activity_logs (user_name, user_email, action_type, module, target_id, details, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userName, userEmail, actionType, moduleName, targetId, details, metadata]
      );

      return Response.json({ success: true, logId: (res as any)?.insertId });
    }

    // 0. Sync checkers from Google Sheets (PERMANENTLY DISCONNECTED per user mandate)
    // All QC/Checker data is now synced directly App-to-App from DO Checker Firebase RTDB.
    if (action === "sync_checkers") {
      return Response.json({
        success: true,
        count: 0,
        message: "Google Sheets sync for checkers/QC has been permanently disconnected. All QC data is synced directly App-to-App from DO Checker Firebase."
      });
    }

    // 0.1. Sync shipment errors from Google Sheets (Bulk sync / Sheet sync)
    if (action === "sync_shipment_errors") {
      const items = Array.isArray(body?.items) ? body.items : Array.isArray(body) ? body : [];
      const mode = body?.mode || "upsert";
      const webhookUrl = body?.webhook_url || body?.webhookUrl || "";

      if (webhookUrl) {
        await saveWebhookUrl(conn, webhookUrl);
      }

      if (items.length === 0) {
        return Response.json({ success: true, count: 0, inserted: 0, updated: 0 });
      }

      if (mode === "replace") {
        await conn.execute("DELETE FROM shipment_returns");
      }

      // Pre-load existing returns into in-memory Map for sub-second batch matching
      const existingMap = new Map<string, { id: number; photo_url: string | null }>();
      try {
        const rows = (await conn.execute(
          "SELECT id, invoice_no, product_name, photo_url FROM shipment_returns"
        )) as Array<{ id: number; invoice_no: string; product_name: string; photo_url: string | null }>;
        if (Array.isArray(rows)) {
          for (const r of rows) {
            const invLower = (r.invoice_no || "").trim().toLowerCase();
            const prodLower = (r.product_name || "").trim().toLowerCase();
            if (invLower && prodLower) {
              existingMap.set(`${invLower}:::${prodLower}`, { id: r.id, photo_url: r.photo_url });
            }
          }
        }
      } catch (e) {
        console.error("Error preloading returns map:", e);
      }

      const toInsert: any[][] = [];
      const toUpdate: Array<{ id: number; params: any[] }> = [];

      for (const item of items) {
        const cust = String(item.customer_name || item.apotek || item["Nama Apotek"] || "").trim();
        const inv = String(item.invoice_no || item.faktur || item["No.Faktur"] || item["No. Invoice"] || "").trim();
        const prod = String(item.product_name || item.produk || item["Nama Produk (diisi sesuai penamaan di invoice)"] || "").trim();
        
        // Skip empty or #N/A formula rows
        if ((!cust || cust === "#N/A") && (!inv || inv === "#N/A") && (!prod || prod === "#N/A")) continue;
        if (cust === "#N/A" && (!inv || inv === "#N/A")) continue;

        const invLower = inv.toLowerCase();
        const prodLower = prod.toLowerCase();
        const matchKey = `${invLower}:::${prodLower}`;
        const existing = mode !== "replace" ? existingMap.get(matchKey) : null;

        const pbf = item.pbf || item["PBF"] || "MBI";
        const soNo = item.so_no || item.so || item["No. Sales order/Transfer order/Shipmet ID HDP"] || item["SO number"] || "";
        const qty = Number(item.qty || item["Kuantitas (yg di retur)"]) || 1;
        const batchNo = item.batch_no || item.batch || item["Batch Number"] || "";
        const expDate = normalizeDateStr(item.expiry_date || item.ed || item["Expiry Date"] || "");
        const reason = item.reason || item.jenis || item["Reason"] || "";
        const invDate = normalizeDateStr(item.invoice_date || item.tanggal || item["Tanggal Faktur"] || "");
        const week = Number(item.week || item["Week"]) || null;
        const cat = item.category || item.cat || item["Category"] || "";
        const month = Number(item.month || item["Month"]) || null;
        const repDate = normalizeDateStr(item.report_date || item.tgl_report || item["Tanggal report"] || invDate || new Date().toISOString().split("T")[0]);
        const confirmVal = item.confirm || item["Confirm"] || "Pending";
        const actionVal = item.action || item["Action"] || "";
        const notaReturNo = item.nota_retur_no || item["No. Nota Retur"] || "";
        const resDate = normalizeDateStr(item.resolved_date || item["Tanggal penyelesaian"] || "");
        const statusVal = item.status || item["Status"] || "Open case";
        const noteVal = item.note || item["Note"] || "";
        let personVal = String(
          item.person || item.pelaku || item.personil || item.checker || item.picker ||
          item["Person"] || item["Pelaku"] || item["Personil"] || item["Nama Personil"] ||
          item["Checker"] || item["Picker"] || item["Checker / Picker"] || item["Picker / Checker"] || ""
        ).trim();
        if (['REJECT', '-', '#N/A', 'NONE', 'NULL'].includes(personVal.toUpperCase())) {
          personVal = '';
        }
        const rootCause = item.root_cause || item.cause || item["Root cause"] || "";
        const photoUrl = item.photo_url || existing?.photo_url || null;

        if (existing) {
          toUpdate.push({
            id: existing.id,
            params: [
              pbf, cust, soNo, qty, batchNo, expDate, reason, invDate, week, cat, month,
              repDate, confirmVal, actionVal, notaReturNo, resDate || null, statusVal,
              noteVal, personVal, rootCause, photoUrl, existing.id
            ]
          });
        } else {
          toInsert.push([
            pbf, cust, inv, soNo, prod, qty, batchNo, expDate, reason, invDate, week, cat, month,
            repDate, confirmVal, actionVal, notaReturNo, resDate || null, statusVal, noteVal,
            personVal, rootCause, photoUrl
          ]);
        }
      }

      let insertedCount = 0;
      let updatedCount = 0;

      // Ultra-fast Batch INSERT in chunks of 100
      const INSERT_CHUNK = 100;
      for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
        const chunk = toInsert.slice(i, i + INSERT_CHUNK);
        const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
        await conn.execute(
          `INSERT INTO shipment_returns (
            pbf, customer_name, invoice_no, so_no, product_name, qty, batch_no, expiry_date,
            reason, invoice_date, week, category, month, report_date, confirm, action,
            nota_retur_no, resolved_date, status, note, person, root_cause, photo_url
          ) VALUES ${placeholders}`,
          chunk.flat()
        );
        insertedCount += chunk.length;
      }

      // Concurrent batch UPDATE
      if (toUpdate.length > 0) {
        const UPDATE_CHUNK = 20;
        for (let i = 0; i < toUpdate.length; i += UPDATE_CHUNK) {
          const chunk = toUpdate.slice(i, i + UPDATE_CHUNK);
          await Promise.all(
            chunk.map(u =>
              conn.execute(
                `UPDATE shipment_returns SET
                  pbf = ?, customer_name = ?, so_no = ?, qty = ?, batch_no = ?, expiry_date = ?,
                  reason = ?, invoice_date = ?, week = ?, category = ?, month = ?, report_date = ?,
                  confirm = ?, action = ?, nota_retur_no = ?, resolved_date = ?, status = ?,
                  note = ?, person = ?, root_cause = ?, photo_url = ?
                WHERE id = ?`,
                u.params
              )
            )
          );
          updatedCount += chunk.length;
        }
      }

      return Response.json({
        success: true,
        count: insertedCount + updatedCount,
        inserted: insertedCount,
        updated: updatedCount,
      });
    }

    // 0.1b. Sync single shipment error from Google Sheets (onEdit trigger in real-time)
    if (action === "sync_single_shipment_error") {
      const item = body?.item || body?.return || body;
      const webhookUrl = body?.webhook_url || body?.webhookUrl || "";
      if (webhookUrl) {
        await saveWebhookUrl(conn, webhookUrl);
      }

      const cust = String(item.customer_name || item.apotek || item["Nama Apotek"] || "").trim();
      const inv = String(item.invoice_no || item.faktur || item["No.Faktur"] || item["No. Invoice"] || "").trim();
      const prod = String(item.product_name || item.produk || item["Nama Produk (diisi sesuai penamaan di invoice)"] || "").trim();

      // Handshake ping saat install trigger
      if (cust === "SYSTEM_PING" || inv === "PING") {
        return Response.json({ success: true, message: "Webhook ping received and registered successfully" });
      }

      if (!cust && !inv && !prod) {
        return Response.json({ success: false, error: "Empty row data" }, { status: 400 });
      }

      const pbf = item.pbf || item["PBF"] || "MBI";
      const soNo = item.so_no || item.so || item["No. Sales order/Transfer order/Shipmet ID HDP"] || item["SO number"] || "";
      const qty = Number(item.qty || item["Kuantitas (yg di retur)"]) || 1;
      const batchNo = item.batch_no || item.batch || item["Batch Number"] || "";
      const expDate = normalizeDateStr(item.expiry_date || item.ed || item["Expiry Date"] || "");
      const reason = item.reason || item.jenis || item["Reason"] || "";
      const invDate = normalizeDateStr(item.invoice_date || item.tanggal || item["Tanggal Faktur"] || "");
      const week = Number(item.week || item["Week"]) || null;
      const cat = item.category || item.cat || item["Category"] || "";
      const month = Number(item.month || item["Month"]) || null;
      const repDate = normalizeDateStr(item.report_date || item.tgl_report || item["Tanggal report"] || invDate || new Date().toISOString().split("T")[0]);
      const confirmVal = item.confirm || item["Confirm"] || "Pending";
      const actionVal = item.action || item["Action"] || "";
      const notaReturNo = item.nota_retur_no || item["No. Nota Retur"] || "";
      const resDate = normalizeDateStr(item.resolved_date || item["Tanggal penyelesaian"] || "");
      const statusVal = item.status || item["Status"] || "Open case";
      const noteVal = item.note || item["Note"] || "";
      let personVal = String(
        item.person || item.pelaku || item.personil || item.checker || item.picker ||
        item["Person"] || item["Pelaku"] || item["Personil"] || item["Nama Personil"] ||
        item["Checker"] || item["Picker"] || item["Checker / Picker"] || item["Picker / Checker"] || ""
      ).trim();
      if (['REJECT', '-', '#N/A', 'NONE', 'NULL'].includes(personVal.toUpperCase())) {
        personVal = '';
      }
      const rootCause = item.root_cause || item.cause || item["Root cause"] || "";
      const photoUrl = item.photo_url || null;

      let existingRows: any[] = [];
      if (inv && prod) {
        existingRows = (await conn.execute(
          "SELECT id, photo_url FROM shipment_returns WHERE invoice_no = ? AND product_name = ? LIMIT 1",
          [inv, prod]
        )) as any[];
      }
      if ((!existingRows || existingRows.length === 0) && inv) {
        existingRows = (await conn.execute(
          "SELECT id, photo_url FROM shipment_returns WHERE invoice_no = ? LIMIT 1",
          [inv]
        )) as any[];
      }

      if (existingRows && existingRows.length > 0) {
        const targetId = existingRows[0].id;
        const finalPhoto = photoUrl || existingRows[0].photo_url || null;
        await conn.execute(
          `UPDATE shipment_returns SET
            pbf = ?, customer_name = ?, invoice_no = ?, so_no = ?, product_name = ?,
            qty = ?, batch_no = ?, expiry_date = ?, reason = ?, invoice_date = ?,
            week = ?, category = ?, month = ?, report_date = ?, confirm = ?,
            action = ?, nota_retur_no = ?, resolved_date = ?, status = ?, note = ?,
            person = ?, root_cause = ?, photo_url = ?
          WHERE id = ?`,
          [
            pbf, cust, inv, soNo, prod,
            qty, batchNo, expDate, reason, invDate,
            week, cat, month, repDate, confirmVal,
            actionVal, notaReturNo, resDate || null, statusVal, noteVal,
            personVal, rootCause, finalPhoto,
            targetId
          ]
        );
        return Response.json({ success: true, mode: "updated", id: targetId });
      } else {
        const [res] = (await conn.execute(
          `INSERT INTO shipment_returns (
            pbf, customer_name, invoice_no, so_no, product_name, qty, batch_no, expiry_date,
            reason, invoice_date, week, category, month, report_date, confirm, action,
            nota_retur_no, resolved_date, status, note, person, root_cause, photo_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pbf, cust, inv, soNo, prod,
            qty, batchNo, expDate, reason, invDate,
            week, cat, month, repDate, confirmVal,
            actionVal, notaReturNo, resDate || null, statusVal, noteVal,
            personVal, rootCause, photoUrl
          ]
        )) as any;
        return Response.json({ success: true, mode: "inserted", id: res?.insertId });
      }
    }

    // 0.2. Sync customers from Google Sheets (DISABLED - Disconnected per user request)
    if (action === "sync_customers") {
      return Response.json({
        success: false,
        message: "Google Sheets sync for customers has been disconnected. Customer data is now managed independently in the system.",
      }, { status: 410 });
    }

    // 0.3a. Sync indeks dokumen Google Drive per customer (dikirim oleh Apps Script)
    if (action === "sync_customer_documents") {
      // Panggilan awal sync penuh: kembalikan waktu server DB sebagai penanda untuk prune
      if (body?.start) {
        const [row] = (await conn.execute("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS now_ts")) as any[];
        return Response.json({ success: true, server_time: row?.now_ts });
      }
      const items = Array.isArray(body?.items) ? body.items : [];
      const rows: any[][] = [];
      for (const it of items) {
        const fileId = String(it.file_id || "").trim();
        const custId = String(it.customer_id || "").trim();
        if (!fileId || !custId) continue;
        rows.push([
          fileId,
          custId,
          String(it.file_name || "").slice(0, 512),
          it.mime_type || null,
          Number(it.size_bytes) || null,
          it.folder_id || null,
          it.folder_name ? String(it.folder_name).slice(0, 512) : null,
          it.modified_at || null,
        ]);
      }

      const CHUNK = 200;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        await conn.execute(
          `INSERT INTO customer_documents
             (file_id, customer_id, file_name, mime_type, size_bytes, folder_id, folder_name, modified_at)
           VALUES ${chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
           ON DUPLICATE KEY UPDATE
             customer_id = VALUES(customer_id),
             file_name = VALUES(file_name),
             mime_type = VALUES(mime_type),
             size_bytes = VALUES(size_bytes),
             folder_id = VALUES(folder_id),
             folder_name = VALUES(folder_name),
             modified_at = VALUES(modified_at),
             synced_at = CURRENT_TIMESTAMP`,
          chunk.flat()
        );
      }

      // Hapus dokumen yang sudah tidak ada lagi di Drive (hanya dikirim di akhir sync penuh)
      let removed = 0;
      if (body?.prune_before) {
        const res: any = await conn.execute(
          "DELETE FROM customer_documents WHERE synced_at < ?",
          [String(body.prune_before)]
        );
        removed = Number(res?.rowsAffected ?? res?.affectedRows ?? 0);
      }

      return Response.json({ success: true, count: rows.length, removed });
    }

    // 0.3b. Upload Customer Document Chunk (from ZIP bulk upload or single file upload in Web App)
    if (action === "upload_customer_document") {
      const fileId = String(body?.file_id || "").trim();
      const customerId = String(body?.customer_id || "").trim().toUpperCase();
      const fileName = String(body?.file_name || "document").trim().slice(0, 512);
      const mimeType = String(body?.mime_type || "application/pdf").trim();
      const sizeBytes = Number(body?.size_bytes) || 0;
      const folderName = String(body?.folder_name || customerId).trim().slice(0, 512);
      const chunkIndex = Number(body?.chunk_index) || 0;
      const totalChunks = Number(body?.total_chunks) || 1;
      const chunkData = String(body?.chunk_data || "");

      if (!fileId || !customerId || !chunkData) {
        return Response.json({ success: false, error: "Missing required upload fields" }, { status: 400 });
      }

      if (chunkIndex === 0) {
        await conn.execute("DELETE FROM customer_document_chunks WHERE file_id = ?", [fileId]);
      }

      await conn.execute(
        "INSERT INTO customer_document_chunks (file_id, chunk_index, chunk_data) VALUES (?, ?, ?)",
        [fileId, chunkIndex, chunkData]
      );

      if (chunkIndex >= totalChunks - 1) {
        await conn.execute(
          `INSERT INTO customer_documents (file_id, customer_id, file_name, mime_type, size_bytes, folder_id, folder_name, modified_at)
           VALUES (?, ?, ?, ?, ?, 'local_zip', ?, ?)
           ON DUPLICATE KEY UPDATE
             customer_id = VALUES(customer_id),
             file_name = VALUES(file_name),
             mime_type = VALUES(mime_type),
             size_bytes = VALUES(size_bytes),
             folder_name = VALUES(folder_name),
             modified_at = VALUES(modified_at),
             synced_at = CURRENT_TIMESTAMP`,
          [fileId, customerId, fileName, mimeType, sizeBytes, folderName, new Date().toISOString()]
        );

        const viewUrl = `/api/tidb?action=view_document&file_id=${encodeURIComponent(fileId)}`;
        if (/npwp/i.test(fileName)) {
          await conn.execute("UPDATE customers SET npwp_file_url = ? WHERE id = ?", [viewUrl, customerId]);
        } else {
          await conn.execute(
            "UPDATE customers SET document_url = COALESCE(document_url, ?), document_name = COALESCE(document_name, ?) WHERE id = ?",
            [viewUrl, fileName, customerId]
          );
        }
      }

      return Response.json({ success: true, file_id: fileId, chunk_index: chunkIndex });
    }

    // 0.3c. Delete Customer Document
    if (action === "delete_customer_document") {
      const fileId = String(body?.file_id || "").trim();
      if (!fileId) {
        return Response.json({ success: false, error: "Missing file_id" }, { status: 400 });
      }
      await conn.execute("DELETE FROM customer_document_chunks WHERE file_id = ?", [fileId]);
      await conn.execute("DELETE FROM customer_documents WHERE file_id = ?", [fileId]);
      return Response.json({ success: true });
    }

    // 0.3. Bulk Import Customers (From user-provided Excel/File)
    if (action === "bulk_import_customers") {
      const items = Array.isArray(body?.items) ? body.items : Array.isArray(body) ? body : [];
      if (items.length === 0) {
        return Response.json({ success: true, count: 0 });
      }

      const validCustomers: any[] = [];
      for (const item of items) {
        const id = String(item.id || item.customer_id || item["CUSTOMER ID"] || "").trim();
        const name = String(item.name || item.nama_apotek || item["NAMA APOTEK/RS/PBF/KLINIK"] || "").trim();
        if (!id || id === "#N/A" || !name || name === "#N/A") continue;

        validCustomers.push([
          id,
          item.customer_id_oracle || item.oracle_id || item["CUSTOMER ID ORACLE"] || "",
          name,
          item.status_merchant || item.status || item["STATUS MERCHANT"] || "ACTIVE",
          item.phone || item.no_telf_apj || item["NO TELF APJ"] || "",
          item.email || item.alamat_email || item["Alamat email"] || "",
          item.address || item.default_billing_address || item["Default Billing Address"] || "",
          item.vat_id || item["VAT ID"] || "",
          item.nik || item.nik_number || item["NIK NUMBER (npwp 16 digit)"] || "",
          item.owner_name || item.nama_pemilik_npwp || item["NAMA PEMILIK NPWP"] || "",
          item.owner_address || item.alamat_wajib_pajak || item["ALAMAT WAJIB PAJAK"] || "",
          item.sia_number || item.izin_apotek_number || item["IZIN APOTEK/KLINIK/PBF/RS NUMBER"] || "",
          item.sia_expired || item.sia_expired_date || item["SIA EXPIRED DATE"] || "",
          item.sipa_number || item["SIPA NUMBER"] || "",
          item.sipa_expired || item.sipa_expired_date || item["SIPA EXPIRED DATE"] || "",
          item.apj_name || item.nama_apj || item["NAMA APJ"] || "",
          item.sipnap_code || item.kode_sipnap || item["KODE SIPNAP"] || "",
          item.site_bill_to || item.site_number_bill_to || item["SITE NUMBER (BILL TO)"] || "",
          item.site_ship_to || item.site_number_ship_to || item["SITE NUMBER (SHIP TO)"] || "",
          item.branch || item.mbi_branch || item["MBI BRANCH"] || "",
          item.zone || item["Zone"] || "",
          item.category || item.kategori_customer || item["KATEGORI CUSTOMER"] || "",
          item.halodoc_pharma || item.branch_name_halodoc || item["BRANCH NAME HALODOC FOR PHARMA"] || "",
          item.is_active_2p || item["LIST APOTEK 2P AKTIF"] || "",
          item.document_url || item["DOKUMEN LEGALITAS"] || "",
          item.document_name || "",
          item.npwp_drive_url || item["GDRIVE NPWP"] || item["NPWP GDRIVE"] || "",
          item.npwp_file_url || "",
          item.coa_rec || item["COA - REC"] || "",
          item.coa_rev || item["COA - REV"] || "",
          item.order_status || item["SUDAH PERNAH ORDER/BELUM"] || "",
        ]);
      }

      let insertedCount = 0;
      const CHUNK_SIZE = 500;
      for (let i = 0; i < validCustomers.length; i += CHUNK_SIZE) {
        const chunk = validCustomers.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
        const flatParams = chunk.flat();

        await conn.execute(
          `INSERT INTO customers (
            id, customer_id_oracle, name, status_merchant, phone, email, address,
            vat_id, nik, owner_name, owner_address, sia_number, sia_expired,
            sipa_number, sipa_expired, apj_name, sipnap_code, site_bill_to,
            site_ship_to, branch, zone, category, halodoc_pharma, is_active_2p,
            document_url, document_name, npwp_drive_url, npwp_file_url,
            coa_rec, coa_rev, order_status
          ) VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE
            customer_id_oracle = VALUES(customer_id_oracle),
            name = VALUES(name),
            status_merchant = VALUES(status_merchant),
            phone = VALUES(phone),
            email = VALUES(email),
            address = VALUES(address),
            vat_id = VALUES(vat_id),
            nik = VALUES(nik),
            owner_name = VALUES(owner_name),
            owner_address = VALUES(owner_address),
            sia_number = VALUES(sia_number),
            sia_expired = VALUES(sia_expired),
            sipa_number = VALUES(sipa_number),
            sipa_expired = VALUES(sipa_expired),
            apj_name = VALUES(apj_name),
            sipnap_code = VALUES(sipnap_code),
            site_bill_to = VALUES(site_bill_to),
            site_ship_to = VALUES(site_ship_to),
            branch = VALUES(branch),
            zone = VALUES(zone),
            category = VALUES(category),
            halodoc_pharma = VALUES(halodoc_pharma),
            is_active_2p = VALUES(is_active_2p),
            document_url = COALESCE(VALUES(document_url), document_url),
            document_name = COALESCE(VALUES(document_name), document_name),
            npwp_drive_url = COALESCE(VALUES(npwp_drive_url), npwp_drive_url),
            npwp_file_url = COALESCE(VALUES(npwp_file_url), npwp_file_url),
            coa_rec = COALESCE(VALUES(coa_rec), coa_rec),
            coa_rev = COALESCE(VALUES(coa_rev), coa_rev),
            order_status = COALESCE(VALUES(order_status), order_status)`,
          flatParams
        );
        insertedCount += chunk.length;
      }

      // Automatically persist to activity_logs & broadcast realtime to all active web tabs
      if (insertedCount > 0) {
        try {
          await conn.execute(
            `INSERT INTO activity_logs (user_name, user_email, action_type, module, target_id, details, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              "Google Sheet Sync",
              "sheet-sync@mhealth.tech",
              "BULK_SYNC_CUSTOMER_GSHEET",
              "CUSTOMERS",
              `SYNC_${insertedCount}_CUST`,
              `Sinkronisasi massal pelanggan dari Google Sheet: ${insertedCount} data pelanggan diperbarui`,
              JSON.stringify({ total_synced: insertedCount }),
            ]
          );
        } catch (logErr) {
          console.warn("Failed to record activity log for bulk customer sync:", logErr);
        }
        await broadcastSignalFromApi("customers");
      }

      return Response.json({ success: true, count: insertedCount });
    }

    // 0.35. Acknowledge Synced Customers from Google Sheet Auto-Queue
    if (action === "ack_pending_customer_sync") {
      const ids = body?.synced_ids || [];
      if (Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => "?").join(",");
        await conn.execute(
          `DELETE FROM customer_sync_queue WHERE customer_id IN (${placeholders})`,
          ids
        );
      }
      return Response.json({ success: true, acknowledged: ids.length });
    }

    // 0.4. Bidirectional Sync: Single Customer from Google Sheet "Data Pelanggan MBI"
    if (action === "sync_customer_from_sheet" || action === "sync_single_customer") {
      const item = body?.customer || body;
      const id = String(item.id || item.customer_id || item["CUSTOMER ID"] || "").trim();
      const name = String(item.name || item.nama_apotek || item["NAMA APOTEK/RS/PBF/KLINIK"] || "").trim();

      const webhookUrl = body?.webhook_url || body?.webhookUrl || item?.webhook_url || searchParams.get("webhook_url") || "";
      if (webhookUrl) {
        await saveCustomerWebhookUrl(conn, webhookUrl);
      }

      if (!id || !name) {
        return Response.json({ success: false, error: "Missing customer id or name" }, { status: 400 });
      }

      await conn.execute(
        `INSERT INTO customers (
          id, customer_id_oracle, name, status_merchant, phone, email, address,
          vat_id, nik, owner_name, owner_address, sia_number, sia_expired,
          sipa_number, sipa_expired, apj_name, sipnap_code, site_bill_to,
          site_ship_to, branch, zone, category, halodoc_pharma, is_active_2p,
          document_url, document_name, npwp_drive_url, npwp_file_url,
          coa_rec, coa_rev, order_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          customer_id_oracle = COALESCE(VALUES(customer_id_oracle), customer_id_oracle),
          name = VALUES(name),
          status_merchant = COALESCE(VALUES(status_merchant), status_merchant),
          phone = COALESCE(VALUES(phone), phone),
          email = COALESCE(VALUES(email), email),
          address = COALESCE(VALUES(address), address),
          vat_id = COALESCE(VALUES(vat_id), vat_id),
          nik = COALESCE(VALUES(nik), nik),
          owner_name = COALESCE(VALUES(owner_name), owner_name),
          owner_address = COALESCE(VALUES(owner_address), owner_address),
          sia_number = COALESCE(VALUES(sia_number), sia_number),
          sia_expired = COALESCE(VALUES(sia_expired), sia_expired),
          sipa_number = COALESCE(VALUES(sipa_number), sipa_number),
          sipa_expired = COALESCE(VALUES(sipa_expired), sipa_expired),
          apj_name = COALESCE(VALUES(apj_name), apj_name),
          sipnap_code = COALESCE(VALUES(sipnap_code), sipnap_code),
          site_bill_to = COALESCE(VALUES(site_bill_to), site_bill_to),
          site_ship_to = COALESCE(VALUES(site_ship_to), site_ship_to),
          branch = COALESCE(VALUES(branch), branch),
          zone = COALESCE(VALUES(zone), zone),
          category = COALESCE(VALUES(category), category),
          halodoc_pharma = COALESCE(VALUES(halodoc_pharma), halodoc_pharma),
          is_active_2p = COALESCE(VALUES(is_active_2p), is_active_2p),
          document_url = COALESCE(VALUES(document_url), document_url),
          document_name = COALESCE(VALUES(document_name), document_name),
          npwp_drive_url = COALESCE(VALUES(npwp_drive_url), npwp_drive_url),
          npwp_file_url = COALESCE(VALUES(npwp_file_url), npwp_file_url),
          coa_rec = COALESCE(VALUES(coa_rec), coa_rec),
          coa_rev = COALESCE(VALUES(coa_rev), coa_rev),
          order_status = COALESCE(VALUES(order_status), order_status)`,
        [
          id,
          item.customer_id_oracle || item.oracle_id || item["CUSTOMER ID ORACLE"] || "",
          name,
          item.status_merchant || item.status || item["STATUS MERCHANT"] || "ACTIVE",
          item.phone || item.no_telf_apj || item["NO TELF APJ"] || "",
          item.email || item.alamat_email || item["Alamat email"] || "",
          item.address || item.default_billing_address || item["Default Billing Address"] || "",
          item.vat_id || item["VAT ID"] || "",
          item.nik || item.nik_number || item["NIK NUMBER (npwp 16 digit)"] || "",
          item.owner_name || item.nama_pemilik_npwp || item["NAMA PEMILIK NPWP"] || "",
          item.owner_address || item.alamat_wajib_pajak || item["ALAMAT WAJIB PAJAK"] || "",
          item.sia_number || item.izin_apotek_number || item["IZIN APOTEK/KLINIK/PBF/RS NUMBER"] || "",
          item.sia_expired || item.sia_expired_date || item["SIA EXPIRED DATE"] || "",
          item.sipa_number || item["SIPA NUMBER"] || "",
          item.sipa_expired || item.sipa_expired_date || item["SIPA EXPIRED DATE"] || "",
          item.apj_name || item.nama_apj || item["NAMA APJ"] || "",
          item.sipnap_code || item.kode_sipnap || item["KODE SIPNAP"] || "",
          item.site_bill_to || item.site_number_bill_to || item["SITE NUMBER (BILL TO)"] || "",
          item.site_ship_to || item.site_number_ship_to || item["SITE NUMBER (SHIP TO)"] || "",
          item.branch || item.mbi_branch || item["MBI BRANCH"] || "",
          item.zone || item["Zone"] || "",
          item.category || item.kategori_customer || item["KATEGORI CUSTOMER"] || "REG",
          item.halodoc_pharma || item.branch_name_halodoc || item["BRANCH NAME HALODOC FOR PHARMA"] || "",
          item.is_active_2p || item["LIST APOTEK 2P AKTIF"] || "",
          item.document_url || item["DOKUMEN LEGALITAS"] || null,
          item.document_name || null,
          item.npwp_drive_url || item["GDRIVE NPWP"] || null,
          item.npwp_file_url || null,
          item.coa_rec || item["COA - REC"] || item.coaRec || null,
          item.coa_rev || item["COA - REV"] || item.coaRev || null,
          item.order_status || item["SUDAH PERNAH ORDER/BELUM"] || item.orderStatus || null,
        ]
      );

      // Automatically persist to activity_logs for Google Sheet sync
      if (id && id !== "PING") {
        try {
          await conn.execute(
            `INSERT INTO activity_logs (user_name, user_email, action_type, module, target_id, details, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              "Google Sheet Sync",
              "sheet-sync@mhealth.tech",
              "SYNC_CUSTOMER_GSHEET",
              "CUSTOMERS",
              id,
              `Sinkronisasi otomatis dari Google Sheet: ${name} (${id})`,
              JSON.stringify({ id, name, status_merchant: item.status_merchant || item.status || "ACTIVE" }),
            ]
          );
        } catch (logErr) {
          console.warn("Failed to record activity log for sheet sync:", logErr);
        }
      }

      // Realtime trigger to all connected browser Web Apps!
      await broadcastSignalFromApi("customers");

      return Response.json({ success: true, id, message: "Customer synced successfully from Google Sheet" });
    }

    // 1. Create new shipment return (supports multi-product and photo_url)
    if (action === "create_return") {
      const {
        pbf,
        customer_name,
        invoice_no,
        so_no,
        product_name,
        qty,
        batch_no,
        expiry_date,
        reason,
        invoice_date,
        report_date,
        category,
        confirm,
        action: returnAction,
        status,
        note,
        person,
        root_cause,
        photo_url,
        video_url,
        reject_reason,
        reject_media_url,
        inprogress_type,
        products, // multi-product array
      } = body;

      if (!customer_name?.trim() || !invoice_no?.trim() || !so_no?.trim()) {
        return Response.json(
          { success: false, error: "Nama apotek, nomor invoice (faktur), dan nomor Sales Order (SO) wajib diisi." },
          { status: 400 }
        );
      }

      const items =
        Array.isArray(products) && products.length > 0
          ? products
          : [
              {
                product_name,
                qty,
                batch_no,
                expiry_date,
                reason,
                note,
                action: returnAction,
                root_cause,
                photo_url,
                video_url,
                reject_reason,
                reject_media_url,
                inprogress_type,
              },
            ];

      const insertedIds: number[] = [];

      for (const item of items) {
        const itemInv = invoice_no || item.invoice_no || "";
        let invDate = invoice_date || item.invoice_date || "";

        // Auto-lookup invoice date from fakturs_archive if not specified
        if (!invDate && itemInv) {
          try {
            const [matched] = (await conn.execute(
              "SELECT order_date, transaction_date FROM fakturs_archive WHERE no_faktur = ? ORDER BY order_date DESC LIMIT 1",
              [itemInv]
            )) as any[];
            if (matched && (matched.order_date || matched.transaction_date)) {
              invDate = matched.order_date || matched.transaction_date;
            }
          } catch {}
        }

        const repDate = report_date || item.report_date || new Date().toISOString().split("T")[0];
        let repMonth = Number(item.month);
        if (!repMonth || isNaN(repMonth) || repMonth < 1 || repMonth > 12) {
          const d = new Date(repDate);
          repMonth = !isNaN(d.getTime()) ? d.getMonth() + 1 : new Date().getMonth() + 1;
        }

        let repWeek = Number(item.week);
        if (!repWeek || isNaN(repWeek) || repWeek < 1 || repWeek > 53) {
          const d = new Date(repDate);
          if (!isNaN(d.getTime())) {
            const startOfYear = new Date(d.getFullYear(), 0, 1);
            repWeek = Math.max(1, Math.min(52, Math.floor((d.getTime() - startOfYear.getTime()) / 604800000) + 1));
          } else {
            repWeek = 1;
          }
        }

        const [res] = (await conn.execute(
          `INSERT INTO shipment_returns (
            pbf, customer_name, invoice_no, so_no, product_name, qty, batch_no, expiry_date, reason, invoice_date, report_date,
            category, confirm, action, status, note, person, root_cause, photo_url, video_url, reject_reason, reject_media_url, inprogress_type, month, week
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pbf || item.pbf || "MBI",
            customer_name || item.customer_name || "",
            itemInv,
            so_no || item.so_no || "",
            item.product_name || item.name || "",
            Number(item.qty) || 1,
            item.batch_no || "",
            item.expiry_date || "",
            item.reason || "",
            invDate || new Date().toISOString().split("T")[0],
            repDate,
            category !== undefined && category !== null ? category : (item.category ?? ""),
            confirm !== undefined && confirm !== null ? confirm : (item.confirm ?? ""),
            item.action !== undefined && item.action !== null ? item.action : (returnAction ?? ""),
            status || item.status || "Pending",
            item.note || note || "",
            person !== undefined && person !== null ? person : (item.person ?? ""),
            item.root_cause || root_cause || "",
            item.photo_url || photo_url || null,
            item.video_url || video_url || null,
            item.reject_reason || reject_reason || null,
            item.reject_media_url || reject_media_url || null,
            item.inprogress_type || inprogress_type || null,
            repMonth,
            repWeek,
          ]
        )) as any;
        if (res?.insertId) insertedIds.push(res.insertId);

        forwardToGSheetWebhook(conn, {
          actionType: "create",
          pbf: pbf || item.pbf || "MBI",
          namaApotek: customer_name || item.customer_name || "",
          invoiceNo: itemInv,
          soNo: so_no || item.so_no || "",
          productName: item.product_name || item.name || "",
          qty: Number(item.qty) || 1,
          batchNo: item.batch_no || "",
          expiryDate: item.expiry_date || "",
          reason: item.reason || "",
          invoiceDate: invDate || new Date().toISOString().split("T")[0],
          reportDate: report_date || item.report_date || new Date().toISOString().split("T")[0],
          category: category !== undefined && category !== null ? category : (item.category ?? ""),
          confirm: confirm !== undefined && confirm !== null ? confirm : (item.confirm ?? ""),
          action: item.action !== undefined && item.action !== null ? item.action : (returnAction ?? ""),
          status: status || item.status || "Pending",
          note: item.note || note || "",
          person: person !== undefined && person !== null ? person : (item.person ?? ""),
          rootCause: item.root_cause || root_cause || "",
        });
      }

      // Automatically persist to activity_logs
      try {
        const actorName = body.user_name || body.submitted_by || "Form Komplain / Pelanggan";
        const actorEmail = body.user_email || "";
        const custName = customer_name || items[0]?.customer_name || "-";
        const invNo = invoice_no || items[0]?.invoice_no || "-";
        const summaryDetails = `Input shipment error (${items.length} item) untuk apotek ${custName} (Faktur #${invNo})`;

        await conn.execute(
          `INSERT INTO activity_logs (user_name, user_email, action_type, module, target_id, details, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            actorName,
            actorEmail,
            "CREATE_RETURN",
            "SHIPMENT_ERROR",
            String(invNo || custName),
            summaryDetails,
            JSON.stringify({ count: items.length, ids: insertedIds, invoice_no: invNo, customer_name: custName }),
          ]
        );
      } catch (logErr) {
        console.warn("Failed to write activity_log in create_return:", logErr);
      }

      return Response.json({ success: true, count: items.length, insertedIds });
    }

    // 2. Update existing shipment return (supports all columns + photo_url)
    if (action === "update_return") {
      const {
        id,
        pbf,
        customer_name,
        invoice_no,
        so_no,
        product_name,
        qty,
        batch_no,
        expiry_date,
        reason,
        invoice_date,
        report_date,
        category,
        confirm,
        action: returnAction,
        nota_retur_no,
        resolved_date,
        status,
        note,
        person,
        root_cause,
        photo_url,
        video_url,
        reject_reason,
        reject_media_url,
        inprogress_type,
      } = body;

      if (!id) {
        return Response.json({ success: false, error: "Missing return id" }, { status: 400 });
      }

      let existingRow: any = null;
      try {
        const rows = (await conn.execute("SELECT * FROM shipment_returns WHERE id = ? LIMIT 1", [id])) as any[];
        existingRow = rows?.[0];
      } catch {}

      await conn.execute(
        `UPDATE shipment_returns SET 
          pbf = COALESCE(?, pbf),
          customer_name = COALESCE(?, customer_name),
          invoice_no = COALESCE(?, invoice_no),
          so_no = COALESCE(?, so_no),
          product_name = COALESCE(?, product_name),
          qty = COALESCE(?, qty),
          batch_no = COALESCE(?, batch_no),
          expiry_date = COALESCE(?, expiry_date),
          reason = COALESCE(?, reason),
          invoice_date = COALESCE(?, invoice_date),
          report_date = COALESCE(?, report_date),
          category = COALESCE(?, category),
          confirm = COALESCE(?, confirm),
          action = COALESCE(?, action),
          nota_retur_no = COALESCE(?, nota_retur_no),
          resolved_date = COALESCE(?, resolved_date),
          status = COALESCE(?, status),
          note = COALESCE(?, note),
          person = COALESCE(?, person),
          root_cause = COALESCE(?, root_cause),
          photo_url = COALESCE(?, photo_url),
          video_url = COALESCE(?, video_url),
          reject_reason = COALESCE(?, reject_reason),
          reject_media_url = COALESCE(?, reject_media_url),
          inprogress_type = COALESCE(?, inprogress_type)
        WHERE id = ?`,
        [
          pbf,
          customer_name,
          invoice_no,
          so_no,
          product_name,
          qty !== undefined ? Number(qty) : null,
          batch_no,
          expiry_date,
          reason,
          invoice_date,
          report_date,
          category,
          confirm,
          returnAction,
          nota_retur_no,
          resolved_date,
          status,
          note,
          person,
          root_cause,
          photo_url || null,
          video_url || null,
          reject_reason || null,
          reject_media_url || null,
          inprogress_type || null,
          id,
        ]
      );

      forwardToGSheetWebhook(conn, {
        actionType: "update",
        pbf: pbf ?? existingRow?.pbf,
        namaApotek: customer_name ?? existingRow?.customer_name,
        invoiceNo: invoice_no ?? existingRow?.invoice_no,
        soNo: so_no ?? existingRow?.so_no,
        productName: product_name ?? existingRow?.product_name,
        qty: qty ?? existingRow?.qty,
        batchNo: batch_no ?? existingRow?.batch_no,
        expiryDate: expiry_date ?? existingRow?.expiry_date,
        reason: reason ?? existingRow?.reason,
        invoiceDate: invoice_date ?? existingRow?.invoice_date,
        reportDate: report_date ?? existingRow?.report_date,
        category: category ?? existingRow?.category,
        confirm: confirm ?? existingRow?.confirm,
        action: returnAction ?? existingRow?.action,
        notaReturNo: nota_retur_no ?? existingRow?.nota_retur_no,
        resolvedDate: resolved_date ?? existingRow?.resolved_date,
        status: status ?? existingRow?.status,
        note: note ?? existingRow?.note,
        person: person ?? existingRow?.person,
        rootCause: root_cause ?? existingRow?.root_cause,
      });

      // Automatically persist to activity_logs
      try {
        const actorName = body.user_name || "Admin";
        const actorEmail = body.user_email || "";
        const isResolved = status === "Resolved";
        const actType = isResolved ? "RESOLVE_RETURN" : "UPDATE_RETURN";
        const actDetails = `${isResolved ? "Menyelesaikan (Resolve)" : "Mengubah"} komplain #${id} (Faktur #${invoice_no || existingRow?.invoice_no || "-"})`;

        await conn.execute(
          `INSERT INTO activity_logs (user_name, user_email, action_type, module, target_id, details, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            actorName,
            actorEmail,
            actType,
            "SHIPMENT_ERROR",
            String(id),
            actDetails,
            JSON.stringify({ id, invoice_no: invoice_no || existingRow?.invoice_no, status, action: returnAction }),
          ]
        );
      } catch (logErr) {
        console.warn("Failed to write activity_log in update_return:", logErr);
      }

      return Response.json({ success: true });
    }

    // 2.5. Delete shipment return
    if (action === "delete_return") {
      const id = searchParams.get("id") || body?.id;
      if (!id) {
        return Response.json({ success: false, error: "Missing return id" }, { status: 400 });
      }

      let targetInvoice = "";
      let targetProduct = "";
      try {
        const rows = (await conn.execute("SELECT invoice_no, product_name FROM shipment_returns WHERE id = ? LIMIT 1", [id])) as any[];
        targetInvoice = rows?.[0]?.invoice_no || "";
        targetProduct = rows?.[0]?.product_name || "";
      } catch (e) {}

      await conn.execute("DELETE FROM shipment_returns WHERE id = ?", [id]);

      // Automatically persist to activity_logs
      try {
        const actorName = body?.user_name || "Admin";
        const actorEmail = body?.user_email || "";
        await conn.execute(
          `INSERT INTO activity_logs (user_name, user_email, action_type, module, target_id, details, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            actorName,
            actorEmail,
            "DELETE_RETURN",
            "SHIPMENT_ERROR",
            String(id),
            `Menghapus komplain #${id} (Faktur #${targetInvoice || "-"})`,
            JSON.stringify({ id, invoice_no: targetInvoice, product: targetProduct }),
          ]
        );
      } catch (logErr) {
        console.warn("Failed to write activity_log in delete_return:", logErr);
      }

      if (targetInvoice) {
        forwardToGSheetWebhook(conn, {
          actionType: "delete",
          invoiceNo: targetInvoice,
          productName: targetProduct,
        });
      }

      return Response.json({ success: true, deletedInvoice: targetInvoice });
    }

    // 2.5b. Migrate historical shipment returns status workflow
    if (action === "migrate_returns_workflow") {
      // 1. Sinkronkan tiket yang sudah di-Approve tapi statusnya tertinggal
      await conn.execute(`
        UPDATE shipment_returns 
        SET status = 'In Progress' 
        WHERE LOWER(confirm) = 'approve' AND status IN ('Pending', 'Approve', 'Open case');
      `);
      // 2. Normalisasi status 'Open case' yang belum di-approve menjadi 'Pending'
      await conn.execute(`
        UPDATE shipment_returns 
        SET status = 'Pending' 
        WHERE status = 'Open case';
      `);
      // 3. Pastikan seluruh kasus reject berstatus 'Rejected'
      await conn.execute(`
        UPDATE shipment_returns 
        SET status = 'Rejected' 
        WHERE (LOWER(confirm) LIKE '%reject%' OR LOWER(confirm) LIKE '%tolak%') 
          AND status != 'Rejected';
      `);
      // 4. Normalisasi casing untuk seluruh status
      await conn.execute("UPDATE shipment_returns SET status = 'Pending' WHERE LOWER(status) = 'pending';");
      await conn.execute("UPDATE shipment_returns SET status = 'In Progress' WHERE LOWER(status) = 'in progress';");
      await conn.execute("UPDATE shipment_returns SET status = 'Resolved' WHERE LOWER(status) = 'resolved';");
      await conn.execute("UPDATE shipment_returns SET status = 'Rejected' WHERE LOWER(status) = 'rejected';");
      // 5. Backfill resolved_date yang kosong pada status Resolved
      await conn.execute(`
        UPDATE shipment_returns 
        SET resolved_date = CASE 
          WHEN report_date IS NOT NULL AND report_date != '' AND report_date != '-' THEN report_date 
          WHEN invoice_date IS NOT NULL AND invoice_date != '' AND invoice_date != '-' THEN invoice_date 
          ELSE resolved_date 
        END 
        WHERE status = 'Resolved' AND (resolved_date IS NULL OR resolved_date = '' OR resolved_date = '-');
      `);

      return Response.json({ success: true, message: "Migration of shipment returns workflow completed successfully." });
    }

    // 2.6. Batch Import shipment returns from Excel
    if (action === "batch_import_returns") {
      const items = Array.isArray(body) ? body : body.items || [];
      if (items.length === 0) {
        return Response.json({ success: true, count: 0 });
      }

      let insertedCount = 0;
      for (const item of items) {
        if (!item.customer_name && !item.invoice_no && !item.product_name) continue;
        await conn.execute(
          `INSERT INTO shipment_returns (
            pbf, customer_name, invoice_no, so_no, product_name, qty, batch_no, expiry_date, reason, invoice_date, report_date,
            category, confirm, action, status, nota_retur_no, resolved_date, note, person, root_cause
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.pbf || "MBI",
            item.customer_name || "-",
            item.invoice_no || "-",
            item.so_no || "-",
            item.product_name || "-",
            Number(item.qty) || 1,
            item.batch_no || "-",
            item.expiry_date || "-",
            item.reason || "-",
            item.invoice_date || "",
            item.report_date || item.invoice_date || new Date().toISOString().split("T")[0],
            item.category || "DOO",
            item.confirm || "Pending",
            item.action || "-",
            item.status || "Pending",
            item.nota_retur_no || "-",
            item.resolved_date || null,
            item.note || "-",
            ['REJECT', '-', '#N/A', 'NONE', 'NULL'].includes(String(item.person || '').trim().toUpperCase()) ? '' : (item.person || ''),
            item.root_cause || "-",
          ]
        );
        insertedCount++;
      }

      return Response.json({ success: true, count: insertedCount });
    }

    // 2.7. Update Customer
    if (action === "update_customer") {
      const {
        id,
        name,
        customer_id_oracle,
        status_merchant,
        phone,
        email,
        address,
        vat_id,
        nik,
        owner_name,
        owner_address,
        sia_number,
        sia_expired,
        sipa_number,
        sipa_expired,
        apj_name,
        sipnap_code,
        site_bill_to,
        site_ship_to,
        branch,
        zone,
        category,
        is_active_2p,
        document_url,
        document_name,
        npwp_drive_url,
        npwp_file_url,
        coa_rec,
        coa_rev,
        order_status,
      } = body;

      if (!id) {
        return Response.json({ success: false, error: "Missing customer id" }, { status: 400 });
      }

      await conn.execute(
        `UPDATE customers SET
          name = COALESCE(?, name),
          customer_id_oracle = COALESCE(?, customer_id_oracle),
          status_merchant = COALESCE(?, status_merchant),
          phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          address = COALESCE(?, address),
          vat_id = COALESCE(?, vat_id),
          nik = COALESCE(?, nik),
          owner_name = COALESCE(?, owner_name),
          owner_address = COALESCE(?, owner_address),
          sia_number = COALESCE(?, sia_number),
          sia_expired = COALESCE(?, sia_expired),
          sipa_number = COALESCE(?, sipa_number),
          sipa_expired = COALESCE(?, sipa_expired),
          apj_name = COALESCE(?, apj_name),
          sipnap_code = COALESCE(?, sipnap_code),
          site_bill_to = COALESCE(?, site_bill_to),
          site_ship_to = COALESCE(?, site_ship_to),
          branch = COALESCE(?, branch),
          zone = COALESCE(?, zone),
          category = COALESCE(?, category),
          is_active_2p = COALESCE(?, is_active_2p),
          document_url = COALESCE(?, document_url),
          document_name = COALESCE(?, document_name),
          npwp_drive_url = COALESCE(?, npwp_drive_url),
          npwp_file_url = COALESCE(?, npwp_file_url),
          coa_rec = COALESCE(?, coa_rec),
          coa_rev = COALESCE(?, coa_rev),
          order_status = COALESCE(?, order_status)
        WHERE id = ?`,
        [
          name !== undefined ? name : null,
          customer_id_oracle !== undefined ? customer_id_oracle : null,
          status_merchant !== undefined ? status_merchant : null,
          phone !== undefined ? phone : null,
          email !== undefined ? email : null,
          address !== undefined ? address : null,
          vat_id !== undefined ? vat_id : null,
          nik !== undefined ? nik : null,
          owner_name !== undefined ? owner_name : null,
          owner_address !== undefined ? owner_address : null,
          sia_number !== undefined ? sia_number : null,
          sia_expired !== undefined ? sia_expired : null,
          sipa_number !== undefined ? sipa_number : null,
          sipa_expired !== undefined ? sipa_expired : null,
          apj_name !== undefined ? apj_name : null,
          sipnap_code !== undefined ? sipnap_code : null,
          site_bill_to !== undefined ? site_bill_to : null,
          site_ship_to !== undefined ? site_ship_to : null,
          branch !== undefined ? branch : null,
          zone !== undefined ? zone : null,
          category !== undefined ? category : null,
          is_active_2p !== undefined ? is_active_2p : null,
          document_url !== undefined ? document_url : null,
          document_name !== undefined ? document_name : null,
          npwp_drive_url !== undefined ? npwp_drive_url : null,
          npwp_file_url !== undefined ? npwp_file_url : null,
          coa_rec !== undefined ? coa_rec : null,
          coa_rev !== undefined ? coa_rev : null,
          order_status !== undefined ? order_status : null,
          id,
        ]
      );

      // Auto-Queue for Google Sheet sync (guaranteed 100% sync even under Halodoc domain lock)
      try {
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS customer_sync_queue (
            customer_id VARCHAR(64) PRIMARY KEY,
            action VARCHAR(32) DEFAULT 'update_row',
            payload MEDIUMTEXT,
            queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        await conn.execute(
          `INSERT INTO customer_sync_queue (customer_id, action, payload) VALUES (?, 'update_row', ?)
           ON DUPLICATE KEY UPDATE payload = VALUES(payload), queued_at = CURRENT_TIMESTAMP`,
          [id, JSON.stringify(body)]
        );
      } catch (qErr) {
        console.error("Failed to enqueue customer sync:", qErr);
      }

      // 2-Way Realtime Sync: notify Google Sheet "Data Pelanggan MBI" webhook (immediate attempt)
      await forwardToCustomerGSheetWebhook(conn, {
        action: "update_row",
        customer: body,
      });

      // Automatically persist to activity_logs for Web App update
      if (id) {
        try {
          const actorName = body.user_name || "Admin Web";
          const actorEmail = body.user_email || "";
          await conn.execute(
            `INSERT INTO activity_logs (user_name, user_email, action_type, module, target_id, details, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              actorName,
              actorEmail,
              "UPDATE_CUSTOMER",
              "CUSTOMERS",
              id,
              `Memperbarui data customer ${name || id}`,
              JSON.stringify({ id, name, status_merchant: body.status_merchant }),
            ]
          );
        } catch (logErr) {
          console.warn("Failed to record activity log for update customer:", logErr);
        }
      }

      // Realtime trigger to all connected browser Web Apps!
      await broadcastSignalFromApi("customers");

      return Response.json({ success: true });
    }

    // 3. Batch sync fakturs / upsert_batch (Multi-row high-speed batch with items_json)
    if (action === "sync_fakturs" || action === "upsert_batch" || Array.isArray(body)) {
      const fakturs = Array.isArray(body) ? body : body.fakturs || [];
      if (fakturs.length === 0) {
        return Response.json({ success: true, count: 0 });
      }

      const CHUNK_SIZE = 100;
      const sqlSlices: any[][] = [];
      for (let i = 0; i < fakturs.length; i += CHUNK_SIZE) {
        const slice = fakturs
          .slice(i, i + CHUNK_SIZE)
          .filter((item: any) => Boolean(String(item.invoice_key || item.invoiceKey || item.no_faktur || item.invoiceNumber || "").trim()));
        if (slice.length > 0) sqlSlices.push(slice);
      }

      for (const slice of sqlSlices) {
        const placeholders = slice.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
        const params: (string | number | null)[] = [];

        for (const item of slice) {
          let invKey = String(item.invoice_key || item.invoiceKey || item.no_faktur || item.invoiceNumber || "").trim();
          const noFaktur = String(item.no_faktur || item.invoiceNumber || invKey).trim();
          const noSO = String(item.no_sales_order || item.so || "-").trim();
          const cust = String(item.customer_name || item.customerName || "-").trim();
          const oDate = String(item.order_date || item.orderDate || "-").trim();
          const txDate = String(item.transaction_date || item.transactionDate || oDate || "-").trim();

          const jenis = String(item.jenis_transaksi || item.jenisTransaksi || "DOO").trim();
          const isOraItem = jenis === "ORA" || cust.toUpperCase().startsWith("HAK") || cust.toUpperCase().startsWith("IHC") || cust.toUpperCase().includes("HELIOS");
          // Ensure ORA keys ALWAYS retain their -1P suffix per LOCKED_RULES.md Sec 1.A.2
          if (isOraItem && !invKey.includes("__") && !invKey.endsWith("-1P")) {
            invKey = `${invKey}-1P`;
          }
          const kat = String(item.kategori || "3P").trim();
          let katProd = String(item.kategori_produk || item.kategoriProduk || "").trim();
          if (Array.isArray(item.items) && item.items.length > 0) {
            katProd = calculateDominantCategory(item.items);
          } else if (!katProd) {
            katProd = "FARMA";
          }
          const isPrinted = item.status_cetak ? 1 : 0;
          const pAt = item.printed_at || null;
          const pBy = item.printed_by || null;
          const totalHarga = Number(item.total_harga || item.totalHarga || 0);
          const itemsJson = Array.isArray(item.items) && item.items.length > 0 ? JSON.stringify(item.items) : null;

          params.push(
            invKey,
            noFaktur,
            noSO,
            cust,
            oDate,
            txDate,
            jenis,
            kat,
            katProd,
            isPrinted,
            pAt,
            pBy,
            totalHarga,
            itemsJson
          );
        }

        await conn.execute(
          `INSERT INTO fakturs_archive (
            invoice_key, no_faktur, no_sales_order, customer_name,
            order_date, transaction_date, jenis_transaksi, kategori,
            kategori_produk, status_cetak, printed_at, printed_by,
            total_harga, items_json
          ) VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE
            no_sales_order = IF(
              LOCATE('__', fakturs_archive.invoice_key) = 0 AND SUBSTRING(fakturs_archive.order_date, 4, 7) <> SUBSTRING(VALUES(order_date), 4, 7) AND CHAR_LENGTH(fakturs_archive.order_date) >= 10 AND CHAR_LENGTH(VALUES(order_date)) >= 10,
              fakturs_archive.no_sales_order,
              IF(VALUES(no_sales_order) IS NOT NULL AND CHAR_LENGTH(VALUES(no_sales_order)) > 1, VALUES(no_sales_order), fakturs_archive.no_sales_order)
            ),
            customer_name = IF(
              LOCATE('__', fakturs_archive.invoice_key) = 0 AND SUBSTRING(fakturs_archive.order_date, 4, 7) <> SUBSTRING(VALUES(order_date), 4, 7) AND CHAR_LENGTH(fakturs_archive.order_date) >= 10 AND CHAR_LENGTH(VALUES(order_date)) >= 10,
              fakturs_archive.customer_name,
              IF(
                VALUES(customer_name) IS NOT NULL AND CHAR_LENGTH(VALUES(customer_name)) > 1
                  AND NOT (
                    (UPPER(VALUES(customer_name)) LIKE _utf8mb4 '%HELIOS%' COLLATE utf8mb4_unicode_ci OR VALUES(customer_name) = _utf8mb4 '1001' COLLATE utf8mb4_unicode_ci)
                    AND fakturs_archive.customer_name IS NOT NULL
                    AND CHAR_LENGTH(fakturs_archive.customer_name) > 1
                    AND UPPER(fakturs_archive.customer_name) NOT LIKE _utf8mb4 '%HELIOS%' COLLATE utf8mb4_unicode_ci
                    AND fakturs_archive.customer_name <> _utf8mb4 '1001' COLLATE utf8mb4_unicode_ci
                  ),
                VALUES(customer_name),
                fakturs_archive.customer_name
              )
            ),
            transaction_date = IF(
              LOCATE('__', fakturs_archive.invoice_key) = 0 AND SUBSTRING(fakturs_archive.order_date, 4, 7) <> SUBSTRING(VALUES(order_date), 4, 7) AND CHAR_LENGTH(fakturs_archive.order_date) >= 10 AND CHAR_LENGTH(VALUES(order_date)) >= 10,
              fakturs_archive.transaction_date,
              IF(VALUES(transaction_date) IS NOT NULL AND CHAR_LENGTH(VALUES(transaction_date)) > 1, VALUES(transaction_date), fakturs_archive.transaction_date)
            ),
            kategori = VALUES(kategori),
            kategori_produk = IF(VALUES(items_json) IS NOT NULL, VALUES(kategori_produk), fakturs_archive.kategori_produk),
            status_cetak = IF(fakturs_archive.status_cetak = 1, 1, VALUES(status_cetak)),
            printed_at = IF(fakturs_archive.status_cetak = 1, fakturs_archive.printed_at, VALUES(printed_at)),
            printed_by = IF(fakturs_archive.status_cetak = 1, fakturs_archive.printed_by, VALUES(printed_by)),
            total_harga = IF(VALUES(items_json) IS NOT NULL OR VALUES(total_harga) <> 0, VALUES(total_harga), fakturs_archive.total_harga),
            items_json = IF(
              LOCATE('__', fakturs_archive.invoice_key) = 0 AND SUBSTRING(fakturs_archive.order_date, 4, 7) <> SUBSTRING(VALUES(order_date), 4, 7) AND CHAR_LENGTH(fakturs_archive.order_date) >= 10 AND CHAR_LENGTH(VALUES(order_date)) >= 10,
              fakturs_archive.items_json,
              IF(VALUES(items_json) IS NOT NULL, VALUES(items_json), fakturs_archive.items_json)
            );`,
          params
        );
      }

      return Response.json({ success: true, count: fakturs.length, processed: fakturs.length });
    }

    if (action === "update_category") {
      const invKey = String(body.invoice_key || "").trim();
      const cust = String(body.customer_name || "").trim();
      const kat = String(body.kategori || "1P").trim();
      if (invKey || cust) {
        if (cust) {
          await conn.execute("UPDATE fakturs_archive SET kategori = ?, updated_at = NOW() WHERE customer_name = ? AND jenis_transaksi <> 'ORA'", [kat, cust]);
        }
        if (invKey) {
          await conn.execute("UPDATE fakturs_archive SET kategori = ?, updated_at = NOW() WHERE invoice_key = ? AND jenis_transaksi <> 'ORA'", [kat, invKey]);
        }
      }
      return Response.json({ success: true, updated: true });
    }

    if (action === "update_print") {
      const keys: string[] = (body.keys || []).map((k: string) => String(k).trim()).filter(Boolean);
      if (keys.length === 0) {
        return Response.json({ success: true, updated: 0 });
      }
      const isPrinted = body.isPrinted ? 1 : 0;
      const printedAt = body.printedAt || null;
      const printedBy = body.printedBy || null;

      const CHUNK_SIZE = 100;
      for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
        const slice = keys.slice(i, i + CHUNK_SIZE);
        const inPlaceholders = slice.map(() => "?").join(", ");
        await conn.execute(
          `UPDATE fakturs_archive SET status_cetak = ?, printed_at = ?, printed_by = ? WHERE invoice_key IN (${inPlaceholders});`,
          [isPrinted, printedAt, printedBy, ...slice]
        );
      }

      return Response.json({ success: true, updated: keys.length });
    }

    // ==========================================
    // 7. PENGAJUAN RETUR (SUBMIT & UPDATE STATUS)
    // ==========================================
    if (action === "submit_return_request") {
      const {
        pbf,
        customer_name,
        invoice_no,
        product_name,
        qty,
        batch_no,
        expiry_date,
        reason,
        note,
        requester_name,
        photos,
      } = body;

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const idStr = `RTR-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const dateDisp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      const photoJson = Array.isArray(photos) ? JSON.stringify(photos) : (photos || "");

      const [res] = (await conn.execute(
        `INSERT INTO return_requests (
          request_id, request_date, pbf, customer_name, invoice_no, product_name,
          qty, batch_no, expiry_date, reason, note, requester_name, status, photos
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`,
        [
          idStr,
          dateDisp,
          pbf || "MBI",
          customer_name || "",
          invoice_no || "",
          product_name || "",
          Number(qty) || 1,
          batch_no || "",
          expiry_date || "",
          reason || "",
          note || "",
          requester_name || "",
          photoJson,
        ]
      )) as any;

      return Response.json({
        success: true,
        request_id: idStr,
        message: `Pengajuan retur berhasil dibuat dengan ID: ${idStr}`,
        id: res?.insertId,
        payload: {
          customer_name: customer_name || "",
          invoice_no: invoice_no || "",
          reason: reason || "",
          pbf: pbf || "MBI",
          request_id: idStr,
        },
      });
    }

    if (action === "update_return_request_status") {
      const { request_id, id, status: newStatus, processed_by } = body;
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const dateDisp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const todayYMD = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

      let whereCol = "request_id = ?";
      let whereVal = request_id;
      if (!request_id && id) {
        whereCol = "id = ?";
        whereVal = id;
      }

      const rows = (await conn.execute(
        `SELECT * FROM return_requests WHERE ${whereCol} LIMIT 1`,
        [whereVal]
      )) as any[];
      const existing = rows[0];

      if (!existing) {
        return Response.json({ success: false, error: "Data pengajuan retur tidak ditemukan" }, { status: 404 });
      }

      await conn.execute(
        `UPDATE return_requests SET status = ?, processed_date = ?, processed_by = ? WHERE ${whereCol}`,
        [newStatus, dateDisp, processed_by || "Admin", whereVal]
      );

      // Auto-insert to shipment_returns if status is "In Progress" (approved)
      if (newStatus === "In Progress") {
        let photoFirst = "";
        try {
          if (existing.photos) {
            if (String(existing.photos).startsWith("[")) {
              const arr = JSON.parse(existing.photos);
              if (Array.isArray(arr) && arr.length > 0) photoFirst = arr[0];
            } else {
              photoFirst = existing.photos;
            }
          }
        } catch {}

        await conn.execute(
          `INSERT INTO shipment_returns (
            pbf, customer_name, invoice_no, product_name, qty, batch_no, expiry_date,
            reason, invoice_date, report_date, category, confirm, action, status,
            note, root_cause, photo_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Retur', 'Approve', 'Proses Retur', 'In Progress', ?, 'Human Error', ?)`,
          [
            existing.pbf || "MBI",
            existing.customer_name || "",
            existing.invoice_no || "",
            existing.product_name || "",
            Number(existing.qty) || 1,
            existing.batch_no || "",
            existing.expiry_date || "",
            existing.reason || "",
            todayYMD,
            todayYMD,
            existing.note || "",
            photoFirst || null,
          ]
        );

        // Otomatis teruskan retur yang dikonfirmasi ke Google Sheet Order Proses
        forwardToGSheetWebhook(conn, {
          actionType: "create",
          pbf: existing.pbf || "MBI",
          namaApotek: existing.customer_name || "",
          invoiceNo: existing.invoice_no || "",
          productName: existing.product_name || "",
          qty: Number(existing.qty) || 1,
          batchNo: existing.batch_no || "",
          expiryDate: existing.expiry_date || "",
          reason: existing.reason || "",
          invoiceDate: todayYMD,
          reportDate: todayYMD,
          category: "Retur",
          confirm: "Approve",
          action: "Proses Retur",
          status: "In Progress",
          note: existing.note || "",
          person: "Admin",
          rootCause: "Human Error",
        });
      }

      return Response.json({
        success: true,
        message: `Status berhasil diubah ke: ${newStatus}`,
        payload: {
          customer_name: existing.customer_name || "",
          invoice_no: existing.invoice_no || "",
          reason: existing.reason || "",
          pbf: existing.pbf || "MBI",
          request_id: existing.request_id || "",
        },
      });
    }

    if (action === "deduplicate_fakturs") {
      const allRows = (await conn.execute(
        "SELECT invoice_key, no_faktur, no_sales_order, customer_name, order_date, transaction_date, jenis_transaksi, kategori, kategori_produk, status_cetak, printed_at, printed_by, total_harga, items_json FROM fakturs_archive WHERE invoice_key NOT LIKE 'TEST-%';"
      )) as any[];

      const byKey = new Map<string, any>();
      for (const r of allRows) byKey.set(String(r.invoice_key), r);

      const keysToDelete: string[] = [];
      const rowsToUpsert: any[] = [];
      const keysToMarkPrinted: string[] = [];

      for (const r of allRows) {
        const k = String(r.invoice_key || "");
        if (!k.includes("__")) continue;

        const [prefix] = k.split("__");
        const cleanInv = prefix.replace(/^MAI-/i, "").replace(/-1P$/i, "");
        const isMai = k.startsWith("MAI-");
        const custUpper = String(r.customer_name || "").toUpperCase();
        const isOra = r.jenis_transaksi === "ORA" || custUpper.startsWith("HAK") || custUpper.startsWith("IHC") || custUpper.includes("HELIOS");
        const canonicalBaseKey = isMai ? (isOra ? `MAI-${cleanInv}-1P` : `MAI-${cleanInv}`) : (isOra ? `${cleanInv}-1P` : cleanInv);

        const existingBase = byKey.get(canonicalBaseKey);
        if (existingBase) {
          const baseSO = String(existingBase.no_sales_order || "").trim();
          const compSO = String(r.no_sales_order || "").trim();
          const baseDate = String(existingBase.order_date || existingBase.transaction_date || "").trim();
          const compDate = String(r.order_date || r.transaction_date || "").trim();
          const isDiffMonth = baseDate.length >= 7 && compDate.length >= 7 && baseDate.slice(-7) !== compDate.slice(-7);

          if (baseSO === compSO || !isDiffMonth) {
            // Same transaction / same month duplicate -> delete the composite ghost and preserve printed status on base!
            keysToDelete.push(k);
            if (Number(r.status_cetak) === 1 && Number(existingBase.status_cetak) !== 1) {
              keysToMarkPrinted.push(canonicalBaseKey);
            }
          }
        } else {
          // Canonical base key (e.g. 28136-1P) does not exist because old bug stripped -1P into 28136__1765462!
          // Migrate row to canonicalBaseKey and delete the __ row!
          keysToDelete.push(k);
          rowsToUpsert.push({
            ...r,
            invoice_key: canonicalBaseKey,
            jenis_transaksi: isOra ? "ORA" : r.jenis_transaksi,
          });
          byKey.set(canonicalBaseKey, r);
        }
      }

      for (const up of rowsToUpsert) {
        await conn.execute(
          `INSERT INTO fakturs_archive (
            invoice_key, no_faktur, no_sales_order, customer_name,
            order_date, transaction_date, jenis_transaksi, kategori,
            kategori_produk, status_cetak, printed_at, printed_by,
            total_harga, items_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            no_sales_order = VALUES(no_sales_order),
            customer_name = VALUES(customer_name),
            status_cetak = IF(fakturs_archive.status_cetak = 1, 1, VALUES(status_cetak)),
            printed_at = COALESCE(fakturs_archive.printed_at, VALUES(printed_at)),
            printed_by = COALESCE(fakturs_archive.printed_by, VALUES(printed_by)),
            total_harga = VALUES(total_harga),
            items_json = COALESCE(VALUES(items_json), fakturs_archive.items_json)`,
          [
            up.invoice_key, up.no_faktur, up.no_sales_order, up.customer_name,
            up.order_date, up.transaction_date, up.jenis_transaksi, up.kategori,
            up.kategori_produk, up.status_cetak, up.printed_at, up.printed_by,
            up.total_harga, up.items_json
          ]
        );
      }

      if (keysToMarkPrinted.length > 0) {
        const ph = keysToMarkPrinted.map(() => "?").join(", ");
        await conn.execute(`UPDATE fakturs_archive SET status_cetak = 1 WHERE invoice_key IN (${ph})`, keysToMarkPrinted);
      }

      const CHUNK = 100;
      for (let i = 0; i < keysToDelete.length; i += CHUNK) {
        const slice = keysToDelete.slice(i, i + CHUNK);
        const ph = slice.map(() => "?").join(", ");
        await conn.execute(`DELETE FROM fakturs_archive WHERE invoice_key IN (${ph})`, slice);
      }

      return Response.json({
        success: true,
        deletedDuplicates: keysToDelete.length,
        migratedTo1P: rowsToUpsert.length,
        markedPrinted: keysToMarkPrinted.length,
      });
    }

    if (action === "clear_all_fakturs") {
      try {
        await conn.execute("TRUNCATE TABLE fakturs_archive;");
      } catch {
        await conn.execute("DELETE FROM fakturs_archive;");
      }
      return Response.json({
        success: true,
        message: "Seluruh data fakturs_archive di TiDB berhasil dihapus.",
      });
    }

    return Response.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/tidb error:", error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
