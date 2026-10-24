import { getTiDBClient } from "@/lib/tidb";
import zlib from "zlib";

export const dynamic = "force-dynamic";

function compressedJsonResponse(
  req: Request,
  data: unknown,
  customHeaders: Record<string, string> = {},
  status = 200
): Response {
  const jsonStr = JSON.stringify(data);
  const acceptEncoding = req.headers.get("accept-encoding") || "";
  const url = new URL(req.url);
  const isNoCache = req.headers.get("cache-control") === "no-cache" || url.searchParams.get("fresh") === "true";

  // Always serve live, real-time data with zero CDN staleness
  const defaultCacheControl = "no-store, no-cache, must-revalidate";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": customHeaders["Cache-Control"] || defaultCacheControl,
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    ...customHeaders,
  };

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

function forwardToGSheetWebhook(conn: any, payload: any) {
  getWebhookUrl(conn).then((webhookUrl) => {
    if (!webhookUrl) return;
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error("GSheet webhook background error:", err);
    });
  }).catch(() => {});
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const conn = getTiDBClient();

    // ==========================================
    // CHECKERS & PACKERS MAPPING (SO -> Checker & Packer)
    // ==========================================
    if (action === "get_checkers") {
      const rows = (await conn.execute("SELECT so_number, checker_name, packer_name FROM so_checkers")) as Array<{
        so_number: string;
        checker_name: string;
        packer_name: string;
      }>;
      const map: Record<string, { checker: string; packer: string }> = {};
      if (Array.isArray(rows)) {
        for (const r of rows) {
          if (r.so_number) {
            const raw = String(r.so_number).trim();
            const val = {
              checker: r.checker_name || "",
              packer: r.packer_name || "",
            };
            map[raw] = val;
            const noSpace = raw.replace(/\s+/g, "");
            const alpha = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
            if (noSpace && !map[noSpace]) map[noSpace] = val;
            if (alpha && !map[alpha]) map[alpha] = val;
          }
        }
      }
      return compressedJsonResponse(
        req, 
        { success: true, data: map },
        { "Cache-Control": "no-store, no-cache, must-revalidate" }
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

      return compressedJsonResponse(
        req,
        {
          success: true,
          total: Number(countResult?.total || 0),
          data: rows,
          limit,
          offset,
        },
        { "Cache-Control": "no-store" }
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

      return compressedJsonResponse(req, {
        success: true,
        customer,
        returns,
        fakturs,
        documents,
      });
    }

    // ==========================================
    // 3. SHIPMENT RETURNS / KOMPLAIN
    // ==========================================
    if (action === "returns") {
      const search = (searchParams.get("search") || "").trim();
      const status = searchParams.get("status") || "";
      const pbf = searchParams.get("pbf") || "";
      const category = searchParams.get("category") || "";
      const limit = Math.min(Number(searchParams.get("limit")) || 50, 500);
      const offset = Number(searchParams.get("offset")) || 0;

      let whereClause = "WHERE customer_name != '#N/A' AND customer_name != '' AND customer_name IS NOT NULL";
      const params: (string | number)[] = [];

      if (search) {
        whereClause += " AND (invoice_no LIKE ? OR so_no LIKE ? OR customer_name LIKE ? OR product_name LIKE ? OR reason LIKE ?)";
        const s = `%${search}%`;
        params.push(s, s, s, s, s);
      }
      if (status && status !== "ALL") {
        whereClause += " AND status = ?";
        params.push(status);
      }
      if (pbf && pbf !== "ALL") {
        whereClause += " AND pbf = ?";
        params.push(pbf);
      }
      if (category && category !== "ALL") {
        whereClause += " AND category = ?";
        params.push(category);
      }

      const countSql = `SELECT COUNT(*) as total FROM shipment_returns ${whereClause}`;
      const [countResult] = (await conn.execute(countSql, params)) as Array<{ total: number }>;

      const dataSql = `
        SELECT 
          sr.*,
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
        ${whereClause.replace(/\b(invoice_no|so_no|customer_name|product_name|reason|status|pbf|category)\b/g, 'sr.$1')}
        ORDER BY CASE WHEN sr.report_date IS NOT NULL AND sr.report_date != '' THEN sr.report_date ELSE '1970-01-01' END DESC, sr.id DESC 
        LIMIT ? OFFSET ?
      `;
      const rows = await conn.execute(dataSql, [...params, limit, offset]);

      // Quick statistics
      const [stats] = (await conn.execute(`
        SELECT 
          COUNT(*) as totalAll,
          SUM(CASE WHEN status LIKE '%Resolved%' THEN 1 ELSE 0 END) as totalResolved,
          SUM(CASE WHEN status NOT LIKE '%Resolved%' AND status != '' THEN 1 ELSE 0 END) as totalPending
        FROM shipment_returns;
      `)) as any[];

      return compressedJsonResponse(
        req, 
        {
          success: true,
          total: Number(countResult?.total || 0),
          stats: {
            totalAll: Number(stats?.totalAll || 0),
            totalResolved: Number(stats?.totalResolved || 0),
            totalPending: Number(stats?.totalPending || 0),
          },
          data: rows,
          limit,
          offset,
        },
        { "Cache-Control": "no-store, no-cache, must-revalidate" }
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
        { "Cache-Control": "no-store, no-cache, must-revalidate" }
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
        `SELECT id, invoice_no, so_no, customer_name, product_name, qty, reason, status, action, nota_retur_no, resolved_date, report_date, photo_url, note
         FROM shipment_returns 
         WHERE invoice_no = ? OR invoice_no LIKE ?
         ORDER BY id DESC LIMIT 20`,
        [invoiceNo, `%${invoiceNo}%`]
      )) as any[];

      return compressedJsonResponse(
        req,
        { success: true, count: rows.length, data: rows },
        { "Cache-Control": "no-store, no-cache, must-revalidate" }
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
        { "Cache-Control": "no-store, no-cache, must-revalidate" }
      );
    }

    if (action === "check") {
      const result = (await conn.execute(
        "SELECT COUNT(*) as count, UNIX_TIMESTAMP(MAX(updated_at)) as max_updated FROM fakturs_archive WHERE invoice_key NOT LIKE 'TEST-%';"
      )) as Array<{ count: number; max_updated: number | null }>;
      const totalCount = Number(result[0]?.count || 0);
      const maxUpdated = Number(result[0]?.max_updated || 0);

      const clientCount = Number(searchParams.get("count") || 0);
      const clientUpdated = Number(searchParams.get("updated") || 0);
      const isUpToDate = clientCount === totalCount && totalCount > 0 && (clientUpdated === 0 || clientUpdated >= maxUpdated);

      return Response.json(
        {
          success: true,
          upToDate: isUpToDate,
          totalCount,
          maxUpdated,
        },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "CDN-Cache-Control": "no-store",
            "Vercel-CDN-Cache-Control": "no-store",
          },
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
          extra: {
            nama_pelanggan: r.customer_name || "-",
            order_date: r.order_date || "-",
            transaction_date: r.transaction_date || r.order_date || "-",
            jenis_transaksi: r.jenis_transaksi || "DOO",
            kategori: r.kategori || "3P",
            total_harga: Number(r.total_harga || 0),
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
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "CDN-Cache-Control": "no-store",
          "Vercel-CDN-Cache-Control": "no-store",
        }
      );
    }

    // ==========================================
    // 4.5. LOGISTICS ANALYTICS & PERSONNEL LEADERBOARD
    // ==========================================
    if (action === "personnel_stats") {
      const rows = (await conn.execute(`
        SELECT 
          person,
          COUNT(*) as total_cases,
          SUM(CASE WHEN pbf = 'MBI' THEN 1 ELSE 0 END) as mbi_cases,
          SUM(CASE WHEN pbf = 'MAI' THEN 1 ELSE 0 END) as mai_cases,
          SUM(CASE WHEN status LIKE '%Resolved%' THEN 1 ELSE 0 END) as resolved_cases,
          SUM(CASE WHEN status NOT LIKE '%Resolved%' THEN 1 ELSE 0 END) as pending_cases
        FROM shipment_returns
        WHERE person != '' AND person IS NOT NULL AND person != 'Admin' AND person != '#N/A'
        GROUP BY person
        ORDER BY total_cases DESC
        LIMIT 50;
      `)) as any[];

      const rootCauses = (await conn.execute(`
        SELECT 
          root_cause,
          COUNT(*) as total
        FROM shipment_returns
        WHERE root_cause != '' AND root_cause IS NOT NULL AND root_cause != '#N/A'
        GROUP BY root_cause
        ORDER BY total DESC
        LIMIT 20;
      `)) as any[];

      const reasons = (await conn.execute(`
        SELECT 
          reason,
          COUNT(*) as total
        FROM shipment_returns
        WHERE reason != '' AND reason IS NOT NULL AND reason != '#N/A'
        GROUP BY reason
        ORDER BY total DESC
        LIMIT 20;
      `)) as any[];

      const pbfComparison = (await conn.execute(`
        SELECT 
          pbf,
          COUNT(*) as total,
          SUM(CASE WHEN status LIKE '%Resolved%' THEN 1 ELSE 0 END) as resolved,
          SUM(CASE WHEN status NOT LIKE '%Resolved%' THEN 1 ELSE 0 END) as pending
        FROM shipment_returns
        WHERE pbf IN ('MBI', 'MAI')
        GROUP BY pbf;
      `)) as any[];

      return compressedJsonResponse(req, {
        success: true,
        personnel: rows,
        rootCauses,
        reasons,
        pbfComparison,
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
        whereClause += " AND LOWER(status) = LOWER(?)";
        params.push(status);
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
          SUM(CASE WHEN LOWER(status) = 'gagal' THEN 1 ELSE 0 END) as gagal
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
        },
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
              total_harga, items_json
            FROM fakturs_archive 
            WHERE invoice_key NOT LIKE 'TEST-%'
            ORDER BY invoice_key ASC LIMIT ? OFFSET ?;`
          : `SELECT 
              invoice_key, no_faktur, no_sales_order, customer_name,
              order_date, transaction_date, jenis_transaksi, kategori,
              kategori_produk, status_cetak, printed_at, printed_by,
              total_harga, items_json
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
          extra: {
            nama_pelanggan: r.customer_name || "-",
            order_date: r.order_date || "-",
            transaction_date: r.transaction_date || r.order_date || "-",
            jenis_transaksi: r.jenis_transaksi || "DOO",
            kategori: r.kategori || "3P",
            total_harga: Number(r.total_harga || 0),
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
          timestamp: Date.now(),
        },
        {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "CDN-Cache-Control": "no-store",
          "Vercel-CDN-Cache-Control": "no-store",
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
      }> = [];

      let lastKey = "";
      while (true) {
        const batch = (await conn.execute(
          `SELECT 
            invoice_key, no_faktur, no_sales_order, customer_name,
            order_date, transaction_date, jenis_transaksi, kategori,
            kategori_produk, status_cetak, printed_at, printed_by,
            total_harga, items_json
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
          extra: {
            nama_pelanggan: r.customer_name || "-",
            order_date: r.order_date || "-",
            transaction_date: r.transaction_date || r.order_date || "-",
            jenis_transaksi: r.jenis_transaksi || "DOO",
            kategori: r.kategori || "3P",
            total_harga: Number(r.total_harga || 0),
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
          timestamp: Date.now(),
        },
        {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "CDN-Cache-Control": "no-store",
          "Vercel-CDN-Cache-Control": "no-store",
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

    // 0. Sync checkers from Google Sheets
    if (action === "sync_checkers") {
      const items = Array.isArray(body?.items) ? body.items : Array.isArray(body) ? body : [];
      if (items.length === 0) {
        return Response.json({ success: true, count: 0 });
      }

      const validRows: [string, string, string | null][] = [];
      for (const item of items) {
        const so = String(item.so || item.so_number || "").trim();
        const checker = String(item.checker || item.checker_name || "").trim();
        const packer = String(item.packer || item.packer_name || "").trim();
        if (!so || so === "-" || so === "#N/A" || (!checker && !packer)) continue;

        validRows.push([so, checker || "-", packer || null]);
      }

      // High-speed Batch Upsert in chunks of 100
      let updatedCount = 0;
      const CHUNK_SIZE = 100;
      for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
        const chunk = validRows.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => "(?, ?, ?)").join(", ");
        const flatParams = chunk.flat();

        await conn.execute(
          `INSERT INTO so_checkers (so_number, checker_name, packer_name)
           VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE 
             checker_name = VALUES(checker_name),
             packer_name = COALESCE(VALUES(packer_name), packer_name)`,
          flatParams
        );
        updatedCount += chunk.length;
      }

      return Response.json({ success: true, count: updatedCount });
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
        const personVal = item.person || item.personil || item["Person"] || "";
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
      const personVal = item.person || item.personil || item["Person"] || "";
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

      return Response.json({ success: true, count: insertedCount });
    }

    // 0.4. Bidirectional Sync: Single Customer from Google Sheet "Data Pelanggan MBI"
    if (action === "sync_customer_from_sheet" || action === "sync_single_customer") {
      const item = body?.customer || body;
      const id = String(item.id || item.customer_id || item["CUSTOMER ID"] || "").trim();
      const name = String(item.name || item.nama_apotek || item["NAMA APOTEK/RS/PBF/KLINIK"] || "").trim();

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
        products, // multi-product array
      } = body;

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

        const [res] = (await conn.execute(
          `INSERT INTO shipment_returns (
            pbf, customer_name, invoice_no, so_no, product_name, qty, batch_no, expiry_date, reason, invoice_date, report_date,
            category, confirm, action, status, note, person, root_cause, photo_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            report_date || item.report_date || new Date().toISOString().split("T")[0],
            category !== undefined && category !== null ? category : (item.category ?? ""),
            confirm !== undefined && confirm !== null ? confirm : (item.confirm ?? ""),
            item.action !== undefined && item.action !== null ? item.action : (returnAction ?? ""),
            status || item.status || "Pending",
            item.note || note || "",
            person !== undefined && person !== null ? person : (item.person ?? ""),
            item.root_cause || root_cause || "",
            item.photo_url || photo_url || null,
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
      } = body;

      if (!id) {
        return Response.json({ success: false, error: "Missing return id" }, { status: 400 });
      }

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
          photo_url = COALESCE(?, photo_url)
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
          id,
        ]
      );

      forwardToGSheetWebhook(conn, {
        actionType: "update",
        pbf,
        namaApotek: customer_name,
        invoiceNo: invoice_no,
        soNo: so_no,
        productName: product_name,
        qty,
        batchNo: batch_no,
        expiryDate: expiry_date,
        reason,
        invoiceDate: invoice_date,
        reportDate: report_date,
        category,
        confirm,
        action: returnAction,
        notaReturNo: nota_retur_no,
        resolvedDate: resolved_date,
        status,
        note,
        person,
        rootCause: root_cause,
      });

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

      if (targetInvoice) {
        forwardToGSheetWebhook(conn, {
          actionType: "delete",
          invoiceNo: targetInvoice,
          productName: targetProduct,
        });
      }

      return Response.json({ success: true, deletedInvoice: targetInvoice });
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
            item.person || "-",
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

      // 2-Way Sync: notify Google Sheet "Data Pelanggan MBI" webhook if configured
      const gsheetWebhookUrl = process.env.GSHEET_CUSTOMER_WEBHOOK_URL;
      if (gsheetWebhookUrl) {
        fetch(gsheetWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_row",
            customer: body,
          }),
        }).catch((err) => console.warn("[GSheet Customer Sync Warning]:", err.message));
      }

      return Response.json({ success: true });
    }

    // 3. Batch sync fakturs / upsert_batch (Multi-row high-speed batch with items_json)
    if (action === "sync_fakturs" || action === "upsert_batch" || Array.isArray(body)) {
      const fakturs = Array.isArray(body) ? body : body.fakturs || [];
      if (fakturs.length === 0) {
        return Response.json({ success: true, count: 0 });
      }

      const CHUNK_SIZE = 500;
      for (let i = 0; i < fakturs.length; i += CHUNK_SIZE) {
        const slice = fakturs
          .slice(i, i + CHUNK_SIZE)
          .filter((item: any) => Boolean(String(item.invoice_key || item.invoiceKey || item.no_faktur || item.invoiceNumber || "").trim()));
        if (slice.length === 0) continue;

        const placeholders = slice.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
        const params: (string | number | null)[] = [];

        for (const item of slice) {
          const invKey = String(item.invoice_key || item.invoiceKey || item.no_faktur || item.invoiceNumber || "").trim();
          const noFaktur = String(item.no_faktur || item.invoiceNumber || invKey).trim();
          const noSO = String(item.no_sales_order || item.so || "-").trim();
          const cust = String(item.customer_name || item.customerName || "-").trim();
          const oDate = String(item.order_date || item.orderDate || "-").trim();
          const txDate = String(item.transaction_date || item.transactionDate || oDate || "-").trim();
          const jenis = String(item.jenis_transaksi || item.jenisTransaksi || "DOO").trim();
          const kat = String(item.kategori || "3P").trim();
          const katProd = String(item.kategori_produk || item.kategoriProduk || "FARMA").trim();
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
            no_sales_order = IF(VALUES(no_sales_order) IS NOT NULL AND CHAR_LENGTH(VALUES(no_sales_order)) > 1, VALUES(no_sales_order), fakturs_archive.no_sales_order),
            customer_name = IF(
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
            ),
            transaction_date = IF(VALUES(transaction_date) IS NOT NULL AND CHAR_LENGTH(VALUES(transaction_date)) > 1, VALUES(transaction_date), fakturs_archive.transaction_date),
            kategori = VALUES(kategori),
            kategori_produk = IF(VALUES(items_json) IS NOT NULL, VALUES(kategori_produk), fakturs_archive.kategori_produk),
            status_cetak = IF(fakturs_archive.status_cetak = 1, 1, VALUES(status_cetak)),
            printed_at = IF(fakturs_archive.status_cetak = 1, fakturs_archive.printed_at, VALUES(printed_at)),
            printed_by = IF(fakturs_archive.status_cetak = 1, fakturs_archive.printed_by, VALUES(printed_by)),
            total_harga = IF(VALUES(items_json) IS NOT NULL OR VALUES(total_harga) <> 0, VALUES(total_harga), fakturs_archive.total_harga),
            items_json = IF(VALUES(items_json) IS NOT NULL, VALUES(items_json), fakturs_archive.items_json);`,
          params
        );
      }

      return Response.json({ success: true, count: fakturs.length, processed: fakturs.length });
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

      // Auto-insert to shipment_returns if status is "Dikonfirmasi"
      if (newStatus === "Dikonfirmasi") {
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
