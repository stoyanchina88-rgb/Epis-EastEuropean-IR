/**
 * Epis Translation Proxy Server
 * Runs on the Mac, listens on port 3456.
 * The Capacitor app calls this server for translations.
 * Usage: node translate-server.js
 */
const http = require('http');
const os = require('os');
const PORT = 3456;
const MYMEMORY_BASE = 'https://api.mymemory.translated.net/get';
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST' || req.url !== '/translate') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' })); return;
  }
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { text, source = 'en', target = 'zh-CN' } = JSON.parse(body);
      if (!text) { res.writeHead(400); res.end(JSON.stringify({error:'Missing text'})); return; }
      const url = `${MYMEMORY_BASE}?q=${encodeURIComponent(text.slice(0,500))}&langpair=${source}|${target}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ translatedText: data.responseData.translatedText }));
      } else { throw new Error(data.responseDetails || 'Translation failed'); }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Epis Translation Server on http://0.0.0.0:${PORT}`);
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces))
    for (const iface of interfaces[name] || [])
      if (iface.family === 'IPv4' && !iface.internal)
        console.log(`Network: http://${iface.address}:${PORT}/translate`);
});