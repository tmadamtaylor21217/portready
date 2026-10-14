#!/usr/bin/env node
/**
 * portready — wait until TCP ports accept connections.
 *
 * Exits 0 once every requested port accepts a connection, 1 on timeout or
 * usage error. Designed for CI: `portready 5432 -t 30 && npm run migrate`.
 */
import net from "node:net";

const USAGE = `portready — wait until TCP ports accept connections

Usage:
  portready <port>[,<port>...] [options]

Options:
  -h, --host <host>     host to probe (default 127.0.0.1)
  -t, --timeout <sec>   give up after this many seconds (default 30; 0 = forever)
  -i, --interval <ms>   delay between probes (default 500; grows to 2s backoff)
  -q, --quiet           no progress output, exit code only
      --help            this help

Exit codes: 0 all ports ready · 1 timeout or bad usage`;

function parseArgs(argv) {
  const opts = { host: "127.0.0.1", timeout: 30, interval: 500, quiet: false, ports: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => (i + 1 < argv.length ? argv[++i] : fail(`missing value for ${a}`));
    if (a === "--help") { console.log(USAGE); process.exit(0); }
    else if (a === "-h" || a === "--host") opts.host = next();
    else if (a === "-t" || a === "--timeout") opts.timeout = num(next(), a);
    else if (a === "-i" || a === "--interval") opts.interval = num(next(), a);
    else if (a === "-q" || a === "--quiet") opts.quiet = true;
    else if (a.startsWith("-")) fail(`unknown option ${a} (see --help)`);
    else for (const p of a.split(",")) opts.ports.push(num(p, "port"));
  }
  if (!opts.ports.length) fail("no ports given (see --help)");
  if (opts.ports.some((p) => p < 1 || p > 65535)) fail("port out of range 1-65535");
  return opts;
}

function fail(msg) { console.error(`portready: ${msg}`); process.exit(1); }
function num(v, what) { const n = Number(v); if (!Number.isFinite(n)) fail(`${what} must be a number, got ${v}`); return n; }

/** single probe: true when the port accepts a connection */
function probe(host, port, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    const done = (ok) => { sock.destroy(); resolve(ok); };
    sock.setTimeout(timeoutMs, () => done(false));
    sock.once("connect", () => done(true));
    sock.once("error", () => done(false));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const log = (...a) => { if (!opts.quiet) process.stderr.write(a.join(" ") + "\n"); };
  const deadline = opts.timeout > 0 ? Date.now() + opts.timeout * 1000 : Infinity;
  const pending = new Map(opts.ports.map((p) => [`${opts.host}:${p}`, p]));
  let delay = opts.interval;

  log(`waiting for ${[...pending.keys()].join(", ")} (timeout ${opts.timeout}s)`);
  while (pending.size) {
    await Promise.all([...pending.entries()].map(async ([key, port]) => {
      if (await probe(opts.host, port)) { log(`ready: ${key}`); pending.delete(key); }
    }));
    if (!pending.size) break;
    if (Date.now() >= deadline) {
      log(`timeout: ${[...pending.keys()].join(", ")} still not ready`);
      process.exit(1);
    }
    await sleep(delay);
    delay = Math.min(delay * 2, 2000); // gentle backoff between rounds
  }
  process.exit(0);
}

main();
