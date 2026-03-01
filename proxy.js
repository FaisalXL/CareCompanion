const http = require("http");
const https = require("https");

const DEVICE = "http://192.168.3.254:7000";
const PORT = 7001;

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = DEVICE + req.url;
  const chunks = [];

  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const parsed = new URL(url);

    const opts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: req.method,
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    };

    const proxy = http.request(opts, (upstream) => {
      res.writeHead(upstream.statusCode, upstream.headers);
      upstream.pipe(res);
    });

    proxy.on("error", (e) => {
      res.writeHead(502);
      res.end(JSON.stringify({ error: "Device unreachable", detail: e.message }));
    });

    if (body) proxy.write(body);
    proxy.end();
  });
}).listen(PORT, () => {
  console.log(`CORS proxy: http://localhost:${PORT} → ${DEVICE}`);
});
