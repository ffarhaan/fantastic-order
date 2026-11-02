import { connect } from "@tidbcloud/serverless";

const tidbUrl = 'mysql://2F3e9mNrkPjPFFP.root:mOxC1v2lxbsc7FmF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}';

function calculateDominantCategory(items) {
  if (!items || items.length === 0) return "FARMA";
  const katCounts = {};
  for (const it of items) {
    const raw = String(it.kategori_produk || it.kategoriProduk || "FARMA").trim().toUpperCase();
    const k = raw || "FARMA";
    katCounts[k] = (katCounts[k] || 0) + 1;
  }
  const priorityOrder = ["CCP", "PREKURSOR", "OOT", "FARMA", "ALKES"];
  let dominantKat = "FARMA";
  let maxCount = -1;
  for (const [k, count] of Object.entries(katCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantKat = k;
    } else if (count === maxCount) {
      const currIdx = priorityOrder.indexOf(dominantKat);
      const newIdx = priorityOrder.indexOf(k);
      if (newIdx !== -1 && (currIdx === -1 || newIdx < currIdx)) {
        dominantKat = k;
      }
    }
  }
  return dominantKat;
}

async function main() {
  const conn = connect({ url: tidbUrl });
  console.log("Fetching fakturs with items_json from TiDB...");
  const rows = await conn.execute("SELECT invoice_key, no_sales_order, customer_name, kategori_produk, items_json FROM fakturs_archive WHERE items_json IS NOT NULL");
  
  const updates = [];
  for (const r of rows) {
    const items = typeof r.items_json === "string" ? JSON.parse(r.items_json) : (r.items_json || []);
    if (items.length === 0) continue;
    const dominant = calculateDominantCategory(items);
    const current = String(r.kategori_produk || "").trim().toUpperCase();
    if (dominant !== current) {
      updates.push({ invoice_key: r.invoice_key, dominant, current, so: r.no_sales_order });
    }
  }

  console.log(`Found ${updates.length} invoices needing kategori_produk correction out of ${rows.length} total.`);

  if (updates.length > 0) {
    console.log("Applying updates in batches...");
    const BATCH_SIZE = 100;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      const caseClauses = batch.map(() => "WHEN ? THEN ?").join(" ");
      const keys = batch.map((u) => u.invoice_key);
      const inPlaceholders = keys.map(() => "?").join(", ");
      
      const params = [];
      for (const u of batch) {
        params.push(u.invoice_key, u.dominant);
      }
      params.push(...keys);

      const sql = `UPDATE fakturs_archive SET kategori_produk = CASE invoice_key ${caseClauses} END WHERE invoice_key IN (${inPlaceholders});`;
      await conn.execute(sql, params);
      console.log(`Updated batch ${i + 1} to ${Math.min(i + BATCH_SIZE, updates.length)}`);
    }
    console.log("✅ All TiDB fakturs_archive records successfully corrected to dominant categories!");
  } else {
    console.log("✅ All records already 100% match dominant category!");
  }
}

main().catch(console.error);
