const { connect } = require('@tidbcloud/serverless');

const conn = connect({
  url: 'mysql://2F3e9mNrkPjPFFP.root:mOxC1v2lxbsc7FmF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}'
});

async function main() {
  console.log('1. Mengosongkan data customers (TRUNCATE TABLE customers)...');
  await conn.execute('TRUNCATE TABLE customers;');
  console.log('Tabel customers berhasil dikosongkan!');

  console.log('2. Memastikan kolom npwp_drive_url & npwp_file_url tersedia...');
  try {
    await conn.execute('ALTER TABLE customers ADD COLUMN npwp_drive_url TEXT;');
    console.log('Added npwp_drive_url column.');
  } catch (e) {
    console.log('npwp_drive_url status:', e.message);
  }

  try {
    await conn.execute('ALTER TABLE customers ADD COLUMN npwp_file_url LONGTEXT;');
    console.log('Added npwp_file_url column.');
  } catch (e) {
    console.log('npwp_file_url status:', e.message);
  }

  const [cnt] = await conn.execute('SELECT COUNT(*) as total FROM customers;');
  console.log('Jumlah data customer saat ini:', cnt.total);
}

main().catch(console.error);
