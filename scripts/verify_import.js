const { connect } = require('@tidbcloud/serverless');

const conn = connect({
  url: 'mysql://2F3e9mNrkPjPFFP.root:mOxC1v2lxbsc7FmF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}'
});

async function main() {
  const [cnt] = await conn.execute('SELECT COUNT(*) as c FROM customers');
  console.log('Total customers in TiDB:', cnt.c);

  const [docCnt] = await conn.execute('SELECT COUNT(*) as c FROM customers WHERE document_url IS NOT NULL');
  console.log('Customers with Google Drive document links:', docCnt.c);

  const rows = await conn.execute('SELECT id, name, status_merchant, sia_number, sia_expired, document_name, document_url FROM customers WHERE document_url IS NOT NULL LIMIT 3');
  console.log('Sample customer data:', rows);
}

main().catch(console.error);
