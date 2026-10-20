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

  if (acceptEncoding.includes("gzip")) {
    const compressed = zlib.gzipSync(Buffer.from(jsonStr), { level: 6 });
    return new Response(compressed as unknown as BodyInit, {
      status,
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
        "Vary": "Accept-Encoding",
        ...customHeaders,
      },
    });
  }

  return new Response(jsonStr, {
    status,
    headers: {
      "Content-Type": "application/json",
      ...customHeaders,
    },
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const conn = getTiDBClient();

    // ==========================================
    // 1. CUSTOMERS DIRECTORY
    // ==========================================
    if (action === "customers") {
      const search = (searchParams.get("search") || "").trim();
      const category = searchParams.get("category") || "";
      const status = searchParams.get("status") || "";
      const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
      const offset = Number(searchParams.get("offset")) || 0;

      let whereClause = "WHERE 1=1";
      const params: (string | number)[] = [];

      if (search) {
        whereClause += " AND (name LIKE ? OR customer_id_oracle LIKE ? OR id LIKE ? OR address LIKE ? OR apj_name LIKE ?)";
        const s = `%${search}%`;
        params.push(s, s, s, s, s);
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

      const dataSql = `SELECT * FROM customers ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`;
      const rows = await conn.execute(dataSql, [...params, limit, offset]);

      return compressedJsonResponse(req, {
        success: true,
        total: Number(countResult?.total || 0),
        data: rows,
        limit,
        offset,
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

      if (customer) {
        returns = (await conn.execute(
          "SELECT * FROM shipment_returns WHERE customer_name LIKE ? ORDER BY id DESC LIMIT 50",
          [`%${customer.name}%`]
        )) as any[];

        fakturs = (await conn.execute(
          "SELECT * FROM fakturs_archive WHERE customer_name LIKE ? ORDER BY created_at DESC LIMIT 50",
          [`%${customer.name}%`]
        )) as any[];
      }

      return compressedJsonResponse(req, {
        success: true,
        customer,
        returns,
        fakturs,
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

      let whereClause = "WHERE 1=1";
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

      const dataSql = `SELECT * FROM shipment_returns ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`;
      const rows = await conn.execute(dataSql, [...params, limit, offset]);

      // Quick statistics
      const [stats] = (await conn.execute(`
        SELECT 
          COUNT(*) as totalAll,
          SUM(CASE WHEN status LIKE '%Resolved%' THEN 1 ELSE 0 END) as totalResolved,
          SUM(CASE WHEN status NOT LIKE '%Resolved%' AND status != '' THEN 1 ELSE 0 END) as totalPending
        FROM shipment_returns;
      `)) as any[];

      return compressedJsonResponse(req, {
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
      });
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

      return Response.json({ success: true, map });
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

    if (action === "check") {
      const result = (await conn.execute(
        "SELECT COUNT(*) as count, UNIX_TIMESTAMP(MAX(updated_at)) as max_updated FROM fakturs_archive;"
      )) as Array<{ count: number; max_updated: number | null }>;
      const totalCount = Number(result[0]?.count || 0);
      const maxUpdated = Number(result[0]?.max_updated || 0);

      const clientCount = Number(searchParams.get("count") || 0);
      const clientUpdated = Number(searchParams.get("updated") || 0);
      const isUpToDate = clientCount === totalCount && (clientUpdated === 0 || clientUpdated >= maxUpdated);

      return Response.json({
        success: true,
        upToDate: isUpToDate,
        totalCount,
        maxUpdated,
      });
    }

    if (action === "fetch_all") {
      const fakturs = (await conn.execute(
        "SELECT * FROM fakturs_archive ORDER BY order_date DESC LIMIT 5000;"
      )) as any[];
      return compressedJsonResponse(req, { success: true, count: fakturs.length, data: fakturs });
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
    const action = searchParams.get("action");
    const conn = getTiDBClient();
    const body = await req.json();

    // 1. Create new shipment return
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
        category,
        confirm,
        action: returnAction,
        status,
        note,
        person,
        root_cause,
      } = body;

      const [res] = (await conn.execute(
        `INSERT INTO shipment_returns (
          pbf, customer_name, invoice_no, so_no, product_name, qty, batch_no, expiry_date, reason, invoice_date,
          category, confirm, action, status, note, person, root_cause
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pbf || "MBI",
          customer_name || "",
          invoice_no || "",
          so_no || "",
          product_name || "",
          Number(qty) || 1,
          batch_no || "",
          expiry_date || "",
          reason || "",
          invoice_date || new Date().toISOString().split("T")[0],
          category || "3P",
          confirm || "Approve",
          returnAction || "Tukar fisik",
          status || "Pending",
          note || "",
          person || "Admin",
          root_cause || "",
        ]
      )) as any;

      return Response.json({ success: true, insertId: res?.insertId });
    }

    // 2. Update existing shipment return
    if (action === "update_return") {
      const { id, status, confirm, action: returnAction, note, resolved_date, root_cause } = body;
      if (!id) {
        return Response.json({ success: false, error: "Missing return id" }, { status: 400 });
      }

      await conn.execute(
        `UPDATE shipment_returns SET 
          status = COALESCE(?, status),
          confirm = COALESCE(?, confirm),
          action = COALESCE(?, action),
          note = COALESCE(?, note),
          resolved_date = COALESCE(?, resolved_date),
          root_cause = COALESCE(?, root_cause)
        WHERE id = ?`,
        [status, confirm, returnAction, note, resolved_date, root_cause, id]
      );

      return Response.json({ success: true });
    }

    // 3. Batch sync fakturs
    if (action === "sync_fakturs" || Array.isArray(body)) {
      const fakturs = Array.isArray(body) ? body : body.fakturs || [];
      if (fakturs.length === 0) {
        return Response.json({ success: true, count: 0 });
      }

      for (const f of fakturs) {
        await conn.execute(
          `INSERT INTO fakturs_archive (
            invoice_key, no_faktur, no_sales_order, customer_name, order_date, transaction_date,
            jenis_transaksi, kategori, kategori_produk, status_cetak, printed_at, printed_by, total_harga
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            no_sales_order = COALESCE(VALUES(no_sales_order), no_sales_order),
            customer_name = COALESCE(VALUES(customer_name), customer_name),
            status_cetak = VALUES(status_cetak),
            printed_at = VALUES(printed_at),
            printed_by = VALUES(printed_by),
            total_harga = VALUES(total_harga)`,
          [
            f.invoiceKey || f.invoice_key,
            f.invoiceNumber || f.no_faktur,
            f.so || f.no_sales_order || "",
            f.customerName || f.customer_name || "",
            f.orderDate || f.order_date || "",
            f.transactionDate || f.transaction_date || "",
            f.jenisTransaksi || f.jenis_transaksi || "DOO",
            f.kategori || "3P",
            f.kategoriProduk || f.kategori_produk || "FARMA",
            f.status_cetak ? 1 : 0,
            f.printed_at || null,
            f.printed_by || null,
            f.totalHarga || f.total_harga || 0,
          ]
        );
      }

      return Response.json({ success: true, count: fakturs.length });
    }

    return Response.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/tidb error:", error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
