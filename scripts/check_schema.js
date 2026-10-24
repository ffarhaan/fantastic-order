const { connect } = require('@tidbcloud/serverless');

const conn = connect({
  url: 'mysql://2F3e9mNrkPjPFFP.root:mOxC1v2lxbsc7FmF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}'
});

async function main() {
  const res = await conn.execute('DESCRIBE customers');
  console.log(res.map(r => `${r.Field} (${r.Type})`));
}
main().catch(console.error);
