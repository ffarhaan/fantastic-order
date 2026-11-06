import { connect } from "@tidbcloud/serverless";
import fs from "fs";

async function main() {
  const envText = fs.readFileSync(".env.local", "utf8");
  let url = "";
  envText.split("\n").forEach((line) => {
    if (line.startsWith("DATABASE_URL=")) {
      url = line.split("=")[1].trim().replace(/^['"]|['"]$/g, "");
    }
  });

  const conn = connect({ url });

  console.log("--- Executing Idempotent TiDB Migration ---");

  // 1. Sync Approve tickets to In Progress
  const r1 = await conn.execute(
    `UPDATE shipment_returns 
     SET status = 'In Progress' 
     WHERE LOWER(confirm) = 'approve' AND status IN ('Pending', 'Approve', 'Open case');`
  );
  console.log("Step 1 (Approve -> In Progress): rowsAffected =", r1.rowsAffected);

  // 2. Normalize Open case -> Pending
  const r2 = await conn.execute(
    `UPDATE shipment_returns 
     SET status = 'Pending' 
     WHERE status = 'Open case';`
  );
  console.log("Step 2 (Open case -> Pending): rowsAffected =", r2.rowsAffected);

  // 3. Normalize Reject -> Rejected
  const r3 = await conn.execute(
    `UPDATE shipment_returns 
     SET status = 'Rejected' 
     WHERE (LOWER(confirm) LIKE '%reject%' OR LOWER(confirm) LIKE '%tolak%') 
       AND status != 'Rejected';`
  );
  console.log("Step 3 (Reject -> Rejected): rowsAffected =", r3.rowsAffected);

  // 4. Normalize Case Sensitivity
  await conn.execute("UPDATE shipment_returns SET status = 'Pending' WHERE LOWER(status) = 'pending';");
  await conn.execute("UPDATE shipment_returns SET status = 'In Progress' WHERE LOWER(status) = 'in progress';");
  await conn.execute("UPDATE shipment_returns SET status = 'Resolved' WHERE LOWER(status) = 'resolved';");
  await conn.execute("UPDATE shipment_returns SET status = 'Rejected' WHERE LOWER(status) = 'rejected';");
  console.log("Step 4 (Case sensitivity normalized)");

  // Summary counts
  const counts = await conn.execute(
    "SELECT status, COUNT(*) as cnt FROM shipment_returns GROUP BY status ORDER BY cnt DESC;"
  );
  console.log("Current DB Status Counts:", counts);
}

main().catch(console.error);
