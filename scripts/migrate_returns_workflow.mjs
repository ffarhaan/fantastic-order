import { connect } from "@tidbcloud/serverless";
import * as fs from "fs";
import * as path from "path";

// Read .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("DATABASE_URL=")) {
      databaseUrl = trimmed.substring("DATABASE_URL=".length).replace(/^["']|["']$/g, "");
    }
  }
}

if (!databaseUrl) {
  databaseUrl = 'mysql://2F3e9mNrkPjPFFP.root:mOxC1v2lxbsc7FmF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}';
}

const conn = connect({ url: databaseUrl });

async function run() {
  console.log("=== RUNNING ADVANCED DATA SINKRONISASI IN TIDB ===");

  // 1. Audit before
  const beforeStats = await conn.execute(`
    SELECT status, COUNT(*) as cnt FROM shipment_returns GROUP BY status ORDER BY cnt DESC
  `);
  console.log("Before migration status distribution:", beforeStats);

  // Check the two anomaly rows:
  const anomalies = await conn.execute(`
    SELECT id, invoice_no, confirm, status, person FROM shipment_returns 
    WHERE invoice_no IN ('MBI/INV/CFO/2611/24114', 'MBI/INV/DOO/2610/28901')
  `);
  console.log("Anomaly rows before:", anomalies);

  // Check Open case rows:
  const openCaseRows = await conn.execute(`
    SELECT id, invoice_no, confirm, status FROM shipment_returns WHERE status = 'Open case'
  `);
  console.log("Open case rows before:", openCaseRows);

  // Execute Step 1:
  const res1 = await conn.execute(`
    UPDATE shipment_returns 
    SET status = 'In Progress' 
    WHERE LOWER(confirm) = 'approve' AND status IN ('Pending', 'Approve', 'Open case');
  `);
  console.log("1. Updated approved but pending/open case -> In Progress:", res1);

  // Execute Step 2:
  const res2 = await conn.execute(`
    UPDATE shipment_returns 
    SET status = 'Pending' 
    WHERE status = 'Open case';
  `);
  console.log("2. Normalized remaining 'Open case' -> Pending:", res2);

  // Execute Step 3:
  const res3 = await conn.execute(`
    UPDATE shipment_returns 
    SET status = 'Rejected' 
    WHERE (LOWER(confirm) LIKE '%reject%' OR LOWER(confirm) LIKE '%tolak%') 
      AND status != 'Rejected';
  `);
  console.log("3. Ensured reject cases are 'Rejected':", res3);

  // Execute Step 4:
  await conn.execute("UPDATE shipment_returns SET status = 'Pending' WHERE LOWER(status) = 'pending';");
  await conn.execute("UPDATE shipment_returns SET status = 'In Progress' WHERE LOWER(status) = 'in progress';");
  await conn.execute("UPDATE shipment_returns SET status = 'Resolved' WHERE LOWER(status) = 'resolved';");
  await conn.execute("UPDATE shipment_returns SET status = 'Rejected' WHERE LOWER(status) = 'rejected';");
  console.log("4. Standardized casing for all 4 statuses.");

  // Execute Step 5: Backfill resolved_date for resolved rows
  const res5 = await conn.execute(`
    UPDATE shipment_returns 
    SET resolved_date = CASE 
      WHEN report_date IS NOT NULL AND report_date != '' AND report_date != '-' THEN report_date 
      WHEN invoice_date IS NOT NULL AND invoice_date != '' AND invoice_date != '-' THEN invoice_date 
      ELSE resolved_date 
    END 
    WHERE status = 'Resolved' AND (resolved_date IS NULL OR resolved_date = '' OR resolved_date = '-');
  `);
  console.log("5. Backfilled resolved_date for Resolved tickets:", res5);

  // Audit after:
  const afterStats = await conn.execute(`
    SELECT status, COUNT(*) as cnt FROM shipment_returns GROUP BY status ORDER BY cnt DESC
  `);
  console.log("After migration status distribution:", afterStats);

  const anomaliesAfter = await conn.execute(`
    SELECT id, invoice_no, confirm, status, person FROM shipment_returns 
    WHERE invoice_no IN ('MBI/INV/CFO/2611/24114', 'MBI/INV/DOO/2610/28901')
  `);
  console.log("Anomaly rows after:", anomaliesAfter);

  console.log("=== MIGRATION COMPLETED SUCCESSFULLY ===");
}

run().catch(console.error);
