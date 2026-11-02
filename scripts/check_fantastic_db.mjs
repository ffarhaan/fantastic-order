import { connect } from "@tidbcloud/serverless";

const tidbUrl = 'mysql://2F3e9mNrkPjPFFP.root:mOxC1v2lxbsc7FmF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}';

async function main() {
  const conn = connect({ url: tidbUrl });

  const allTables = await conn.execute("SELECT table_name, round((data_length+index_length)/1024/1024, 2) as total_mb, table_rows FROM information_schema.tables WHERE table_schema='test'");
  console.log('fantastic-order tables:', allTables);
}

main().catch(console.error);
