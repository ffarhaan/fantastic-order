import { connect } from "@tidbcloud/serverless";

const databaseUrl =
  process.env.DATABASE_URL ||
  "mysql://2F3e9mNrkPjPFFP.root:mOxC1v2lxbsc7FmF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={\"rejectUnauthorized\":true}";

export function getTiDBClient() {
  return connect({ url: databaseUrl });
}
