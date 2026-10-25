const http = require('http');

const PORT = process.env.PORT || 4000;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  res.setHeader('Content-Type', 'application/json');

  if (pathname === '/healthy') {
    res.writeHead(200);
    return res.end(JSON.stringify({
      status: 'ok',
      service: 'demo-api',
      timestamp: new Date().toISOString()
    }));
  }

  if (pathname === '/slow') {
    const delay = parseInt(url.searchParams.get('delay') || '1500', 10);
    setTimeout(() => {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'slow_ok',
        delayMs: delay,
        timestamp: new Date().toISOString()
      }));
    }, delay);
    return;
  }

  if (pathname === '/error') {
    res.writeHead(500);
    return res.end(JSON.stringify({
      status: 'error',
      message: 'Simulated 500 Internal Server Error from Demo API',
      timestamp: new Date().toISOString()
    }));
  }

  if (pathname === '/schema-change') {
    const version = url.searchParams.get('v') || '1';
    if (version === '2') {
      res.writeHead(200);
      return res.end(JSON.stringify({
        apiVersion: '2.0.0',
        data: {
          items: [
            { id: 101, fullName: 'Alice Doe', active: true }
          ]
        }
      }));
    }
    res.writeHead(200);
    return res.end(JSON.stringify({
      apiVersion: '1.0.0',
      data: {
        users: [
          { id: 101, name: 'Alice', status: 'active' }
        ]
      }
    }));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Endpoint not found in demo API' }));
});

server.listen(PORT, () => {
  console.log(`[Demo API] Listening on port ${PORT}`);
});
