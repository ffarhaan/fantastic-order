const { connect } = require('@tidbcloud/serverless');

const conn = connect({
  url: 'mysql://2F3e9mNrkPjPFFP.root:mOxC1v2lxbsc7FmF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}'
});

async function main() {
  console.log('Altering customers table...');
  try {
    await conn.execute('ALTER TABLE customers ADD COLUMN document_url LONGTEXT;');
    console.log('Added document_url column.');
  } catch (e) {
    console.log('document_url already exists or:', e.message);
  }

  try {
    await conn.execute('ALTER TABLE customers ADD COLUMN document_name VARCHAR(255);');
    console.log('Added document_name column.');
  } catch (e) {
    console.log('document_name already exists or:', e.message);
  }

  const res = await conn.execute('DESCRIBE customers');
  console.log(res.map(r => `${r.Field} (${r.Type})`));
}

main().catch(console.error);
