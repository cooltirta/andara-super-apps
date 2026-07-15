const https = require('https');

const urls = [
  'https://andarasuperapps.my.id/status/1ab39b37-4c08-450a-aba5-04c41d191d2a',
  'https://taqlima.id/status/1ab39b37-4c08-450a-aba5-04c41d191d2a'
];

function testUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { rejectUnauthorized: false }, (res) => {
      console.log(`URL: ${url}`);
      console.log(`Status Code: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      console.log('----------------------------------------------------');
      resolve();
    }).on('error', (e) => {
      console.error(`URL: ${url} - Error: ${e.message}`);
      resolve();
    });
  });
}

async function run() {
  for (const url of urls) {
    await testUrl(url);
  }
}

run();
