const http = require('http');
http.get('http://localhost:3000', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response Length: ' + data.length + '\n' + data.substring(0, 500)));
}).on('error', err => console.error(err));
