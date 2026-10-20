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

      let whereClause = "WHERE customer_name != '#N/A' AND customer_name != '' AND customer_name IS NOT NULL";
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
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      body = {};
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
        const [res] = (await conn.execute(
          `INSERT INTO shipment_returns (
            pbf, customer_name, invoice_no, so_no, product_name, qty, batch_no, expiry_date, reason, invoice_date,
            category, confirm, action, status, note, person, root_cause, photo_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pbf || item.pbf || "MBI",
            customer_name || item.customer_name || "",
            invoice_no || item.invoice_no || "",
            so_no || item.so_no || "",
            item.product_name || item.name || "",
            Number(item.qty) || 1,
            item.batch_no || "",
            item.expiry_date || "",
            item.reason || "",
            invoice_date || item.invoice_date || new Date().toISOString().split("T")[0],
            category || "3P",
            confirm || "Approve",
            item.action || returnAction || "Tukar fisik",
            status || "Pending",
            item.note || note || "",
            person || "Admin",
            item.root_cause || root_cause || "",
            item.photo_url || photo_url || null,
          ]
        )) as any;
        if (res?.insertId) insertedIds.push(res.insertId);
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

      return Response.json({ success: true });
    }

    // 2.5. Delete shipment return
    if (action === "delete_return") {
      const id = searchParams.get("id") || body?.id;
      if (!id) {
        return Response.json({ success: false, error: "Missing return id" }, { status: 400 });
      }

      await conn.execute("DELETE FROM shipment_returns WHERE id = ?", [id]);

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
