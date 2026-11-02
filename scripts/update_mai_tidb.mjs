import { connect } from "@tidbcloud/serverless";
import fs from "fs";

const databaseUrl =
  process.env.DATABASE_URL ||
  "mysql://2F3e9mNrkPjPFFP.root:mOxC1v2lxbsc7FmF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={\"rejectUnauthorized\":true}";

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/apotik/g, "apotek")
    .replace(/[^a-z0-9]/g, "");
}

const maiMap = JSON.parse(fs.readFileSync("lib/masterApotek_MAI.json", "utf8"));
const normMAI = {};
for (const [k, v] of Object.entries(maiMap)) normMAI[normalize(k)] = v;

async function updateTiDB() {
  const client = connect({ url: databaseUrl });
  const rows = await client.execute("SELECT invoice_key, customer_name, kategori FROM fakturs_archive WHERE invoice_key LIKE 'MAI-%'");
  let updatedCount = 0;
  for (const r of rows) {
    const cust = String(r.customer_name || "").trim().toLowerCase();
    const correctCat = maiMap[cust] || normMAI[normalize(cust)] || "3P";
    if (correctCat !== r.kategori) {
      console.log(`Updating ${r.invoice_key} (${r.customer_name}): ${r.kategori} -> ${correctCat}`);
      await client.execute("UPDATE fakturs_archive SET kategori = ? WHERE invoice_key = ?", [correctCat, r.invoice_key]);
      updatedCount++;
    }
  }
  console.log(`Updated ${updatedCount} MAI rows in TiDB fakturs_archive.`);
}

updateTiDB().catch(console.error);
