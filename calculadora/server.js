const http = require("http");
const { createClient } = require("redis");

const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL; // ex: redis://cache:6379
const CACHE_TTL = Number(process.env.CACHE_TTL || 60);

const ops = {
  soma: (a, b) => a + b,
  sub: (a, b) => a - b,
  mult: (a, b) => a * b,
  div: (a, b) => (b === 0 ? null : a / b),
};

// Cache opcional: se REDIS_URL não existir ou o Redis cair, a calculadora continua funcionando
let redis = null;
if (REDIS_URL) {
  redis = createClient({ url: REDIS_URL });
  redis.on("error", (e) => console.error("Redis:", e.message));
  redis.connect().then(() => console.log("Conectado ao Redis")).catch(() => {});
}
const cacheOk = () => redis && redis.isReady;

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/health") {
    return send(res, 200, { status: "ok", cache: cacheOk() ? "up" : "down" });
  }

  if (url.pathname === "/historico") {
    const itens = cacheOk() ? await redis.lRange("historico", 0, 9) : [];
    return send(res, 200, itens.map((i) => JSON.parse(i)));
  }

  if (url.pathname === "/calc") {
    const op = url.searchParams.get("op");
    const a = Number(url.searchParams.get("a"));
    const b = Number(url.searchParams.get("b"));

    if (!ops[op]) return send(res, 400, { erro: "operação inválida (use soma, sub, mult, div)" });
    if (Number.isNaN(a) || Number.isNaN(b)) return send(res, 400, { erro: "a e b precisam ser números" });

    const chave = `calc:${op}:${a}:${b}`;
    if (cacheOk()) {
      const salvo = await redis.get(chave);
      if (salvo) return send(res, 200, { ...JSON.parse(salvo), cache: true });
    }

    const resultado = ops[op](a, b);
    if (resultado === null) return send(res, 400, { erro: "divisão por zero" });

    const corpo = { op, a, b, resultado };
    console.log(`${op}(${a}, ${b}) = ${resultado}`);
    if (cacheOk()) {
      await redis.set(chave, JSON.stringify(corpo), { EX: CACHE_TTL });
      await redis.lPush("historico", JSON.stringify(corpo));
      await redis.lTrim("historico", 0, 99);
    }
    return send(res, 200, { ...corpo, cache: false });
  }

  send(res, 404, { erro: "rota não encontrada" });
});

server.listen(PORT, () => console.log(`Calculadora rodando na porta ${PORT}`));

// Encerramento limpo quando o Docker manda SIGTERM (docker compose down)
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
  if (redis) redis.quit().catch(() => {});
});
