import { connect } from "@tidbcloud/serverless";

const databaseUrl =
  process.env.DATABASE_URL ||
  (process.env.TIDB_HOST
    ? `mysql://${process.env.TIDB_USER}:${process.env.TIDB_PASSWORD}@${process.env.TIDB_HOST}:${process.env.TIDB_PORT || 4000}/${process.env.TIDB_DATABASE || "test"}?ssl={"rejectUnauthorized":true}`
    : "");

export function getTiDBClient() {
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL or TIDB_* environment variables for TiDB connection");
  }
  return connect({ url: databaseUrl });
}
