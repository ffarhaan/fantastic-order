const { connect } = require('@tidbcloud/serverless');

const conn = connect({
  url: 'mysql://2F3e9mNrkPjPFFP.root:mOxC1v2lxbsc7FmF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}'
});

async function main() {
  const gdriveUrl = 'https://drive.google.com/drive/folders/1vcadO7xGZXEdUxRLap7H76wTcQUxii1w';
  console.log('Menautkan Google Drive URL ke seluruh customers:', gdriveUrl);

  const res = await conn.execute(
    'UPDATE customers SET npwp_drive_url = ? WHERE npwp_drive_url IS NULL OR npwp_drive_url = ""',
    [gdriveUrl]
  );
  console.log('Hasil update:', res);

  const [cnt] = await conn.execute(
    'SELECT COUNT(*) as c FROM customers WHERE npwp_drive_url = ?',
    [gdriveUrl]
  );
  console.log(`Total apotek yang terhubung dengan link Google Drive ini: ${cnt.c}`);
}

main().catch(console.error);
