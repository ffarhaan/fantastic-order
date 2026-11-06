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
  console.log("=== RUNNING RETURN STATUS MIGRATION IN TIDB ===");

  // 1. Audit before
  const beforeStats = await conn.execute(`
    SELECT status, COUNT(*) as cnt FROM shipment_returns GROUP BY status
  `);
  console.log("Before migration status distribution:", beforeStats);

  const [conflictingBefore] = await conn.execute(`
    SELECT COUNT(*) as cnt 
    FROM shipment_returns 
    WHERE (LOWER(confirm) LIKE '%reject%' OR LOWER(confirm) LIKE '%tolak%') 
      AND LOWER(status) = 'resolved'
  `);
  console.log("Conflicting rows before (confirm reject, status resolved):", conflictingBefore?.cnt);

  // 2. Query 1: Fix conflicting resolved that were rejected
  const res1 = await conn.execute(`
    UPDATE shipment_returns 
    SET status = 'Rejected' 
    WHERE (LOWER(confirm) LIKE '%reject%' OR LOWER(confirm) LIKE '%tolak%') 
      AND LOWER(status) = 'resolved';
  `);
  console.log("1. Fixed conflicting resolved -> Rejected:", res1);

  // 3. Query 2: Standardize Pending
  const res2 = await conn.execute(`
    UPDATE shipment_returns SET status = 'Pending' WHERE LOWER(status) = 'pending';
  `);
  console.log("2. Standardized Pending:", res2);

  // 4. Query 3: Standardize In Progress
  const res3 = await conn.execute(`
    UPDATE shipment_returns SET status = 'In Progress' WHERE LOWER(status) = 'in progress';
  `);
  console.log("3. Standardized In Progress:", res3);

  // 5. Query 4: Standardize Resolved
  const res4 = await conn.execute(`
    UPDATE shipment_returns SET status = 'Resolved' WHERE LOWER(status) = 'resolved';
  `);
  console.log("4. Standardized Resolved:", res4);

  // 6. Query 5: Standardize Rejected
  const res5 = await conn.execute(`
    UPDATE shipment_returns SET status = 'Rejected' WHERE LOWER(status) = 'rejected';
  `);
  console.log("5. Standardized Rejected:", res5);

  // 7. Audit after
  const afterStats = await conn.execute(`
    SELECT status, COUNT(*) as cnt FROM shipment_returns GROUP BY status
  `);
  console.log("After migration status distribution:", afterStats);

  console.log("=== MIGRATION COMPLETED SUCCESSFULLY ===");
}

run().catch(console.error);
