/** basic behavior tests: ready path, timeout path, multi-port, arg validation. */
import { spawn } from "node:child_process";
import net from "node:net";

const BIN = new URL("../bin/portready.mjs", import.meta.url).pathname;
let pass = 0, fail = 0;
const check = (desc, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗"} ${desc}${ok ? "" : ` → exit ${got}, want ${want}`}`);
};

/** run the CLI, resolve { code, err } */
function run(args, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    const p = spawn("node", [BIN, ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    const t = setTimeout(() => { p.kill(); resolve({ code: null, err: "test timeout" }); }, timeoutMs);
    p.on("close", (code) => { clearTimeout(t); resolve({ code, err }); });
  });
}

const listen = (port) => new Promise((r) => {
  const s = net.createServer(() => {});
  s.listen(port, "127.0.0.1", () => r(s));
});

// ready path: server already up
{
  const srv = await listen(0);
  const port = srv.address().port;
  const r = await run([String(port), "-t", "5"]);
  check(`port already accepting → exit 0 (${port})`, r.code, 0);
  await new Promise((r) => srv.close(r));
}

// wait path: server comes up after a delay
{
  const probePort = 18473;
  const t = setTimeout(() => listen(probePort).then((s) => setTimeout(() => s.close(), 1500)), 700);
  const r = await run([String(probePort), "-t", "5", "-i", "200"]);
  clearTimeout(t);
  check("port appears mid-wait → exit 0", r.code, 0);
}

// timeout path: nothing listens
{
  const r = await run(["18999", "-t", "1", "-i", "200"]);
  check("nothing listens → exit 1 (timeout)", r.code, 1);
  check("timeout message on stderr", /timeout/.test(r.err), true);
}

// multi-port: all must be ready
{
  const a = await listen(0), b = await listen(0);
  const pa = a.address().port, pb = b.address().port;
  const r = await run([`${pa},${pb}`, "-t", "5"]);
  check("multi-port all ready → exit 0", r.code, 0);
  await Promise.all([new Promise((r) => a.close(r)), new Promise((r) => b.close(r))]);
}

// arg validation
check("no args → exit 1", (await run([])).code, 1);
check("bad port → exit 1", (await run(["99999"])).code, 1);
check("unknown option → exit 1", (await run(["8080", "--nope"])).code, 1);

console.log(fail === 0 ? `\nall ${pass} tests passed` : `\n${fail} failed / ${pass} passed`);
process.exit(fail === 0 ? 0 : 1);
