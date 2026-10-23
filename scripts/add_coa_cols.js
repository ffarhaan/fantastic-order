const { connect } = require('@tidbcloud/serverless');

const conn = connect({
  url: 'mysql://2F3e9mNrkPjPFFP.root:mOxC1v2lxbsc7FmF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}'
});

async function main() {
  console.log('Adding coa_rec, coa_rev, order_status columns to customers table...');
  try {
    await conn.execute('ALTER TABLE customers ADD COLUMN coa_rec VARCHAR(128);');
    console.log('Added coa_rec');
  } catch (e) {
    console.log('coa_rec status:', e.message);
  }

  try {
    await conn.execute('ALTER TABLE customers ADD COLUMN coa_rev VARCHAR(128);');
    console.log('Added coa_rev');
  } catch (e) {
    console.log('coa_rev status:', e.message);
  }

  try {
    await conn.execute('ALTER TABLE customers ADD COLUMN order_status VARCHAR(64);');
    console.log('Added order_status');
  } catch (e) {
    console.log('order_status status:', e.message);
  }

  console.log('Done altering table.');
}

main().catch(console.error);
