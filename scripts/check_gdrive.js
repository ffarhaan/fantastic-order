const https = require('https');

function fetchUrl(url) {
  https.get(url, (res) => {
    console.log('Status:', res.statusCode, 'Location:', res.headers.location);
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      fetchUrl(res.headers.location);
      return;
    }
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Final length:', data.length);
      const matchTitle = data.match(/<title>(.*?)<\/title>/);
      if (matchTitle) console.log('Title:', matchTitle[1]);
    });
  }).on('error', console.error);
}

fetchUrl('https://drive.google.com/drive/folders/1vcadO7xGZXEdUxRLap7H76wTcQUxii1w');
