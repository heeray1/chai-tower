#!/usr/bin/env node
// Headless-Chrome test harness for Chai Tower (Node 22+, no packages: uses the built-in WebSocket + fetch).
//
//   CHROME=/path/to/chrome-headless-shell  BASE=http://127.0.0.1:8765/index.html  node tests/harness.js <cmd> ...
//
//   shot  "<query>" <out-prefix> <ms,ms,...>   screenshots at those times (W/H env set the viewport, default 390x844)
//   run   "<query>" [timeoutSec]              plays until the bot stops (level mode) or the timeout; prints state + bot log
//   easy-curve [runs]                         human-like bot, fresh profile per run, Easy 1-7, max 3 attempts per level
//   calibrate [seeds]                         human-like bot on the Moderate Daily: prints collapse heights
//
// Serve the folder first, e.g.  python3 -m http.server 8765
"use strict";
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CHROME = process.env.CHROME;
const BASE = process.env.BASE || "http://127.0.0.1:8765/index.html";
const W = +(process.env.W || 390), H = +(process.env.H || 844);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let nextPort = +(process.env.PORT || 9340);

async function openPage(query) {
  if (!CHROME) throw new Error("Set CHROME to a Chrome / chrome-headless-shell binary");
  const port = nextPort++;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ct-profile-"));   // fresh profile = fresh saved progress
  const chrome = spawn(CHROME, ["--headless", `--remote-debugging-port=${port}`, `--window-size=${W},${H}`, "--mute-audio",
    `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  let targets;
  for (let i = 0; i < 60 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(200); } }
  if (!targets) { chrome.kill(); throw new Error("Chrome did not start"); }
  const ws = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = ev => {
    const d = JSON.parse(ev.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result || {}); pending.delete(d.id); }
    if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 });
  await send("Page.navigate", { url: `${BASE}?${query}` });
  const evaluate = async expr => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result?.value;
  const close = () => {                                          // let Chrome exit before deleting its profile
    try { ws.close(); } catch {}
    chrome.once("exit", () => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} });
    chrome.kill();
  };
  return { send, evaluate, close, errors };
}

const STATE = "JSON.stringify({ mode, level, levelN, state, count, perfects, misses, botLog })";

async function shot(query, out, times) {
  const pg = await openPage(query), t0 = Date.now();
  try {
    for (const t of times) {
      await sleep(Math.max(0, t - (Date.now() - t0)));
      const r = await pg.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(`${out}_${t}.png`, Buffer.from(r.data, "base64"));
      console.log(t, await pg.evaluate(STATE));
    }
  } finally { pg.close(); }
  if (pg.errors.length) console.log("JS ERRORS:", pg.errors);
}

async function run(query, timeoutSec = 300) {
  const pg = await openPage(query), t0 = Date.now();
  let st;
  try {
    while (Date.now() - t0 < timeoutSec * 1000) {
      await sleep(1000);
      st = JSON.parse(await pg.evaluate(STATE) || "null");
      if (st && st.botLog && st.botLog.stopped) break;
    }
  } finally { pg.close(); }
  return { ...st, errors: pg.errors };
}

async function easyCurve(runs = 10) {
  // each run: fresh profile, Easy 1 -> 7 with auto-advance, at most 3 attempts per level
  const queries = Array.from({ length: runs }, (_, i) => `mode=levels&level=easy&n=1&bot=human&seed=${i + 1}&auto=1&upto=7&cap=3`);
  const out = [];
  for (let i = 0; i < queries.length; i += 3) out.push(...await Promise.all(queries.slice(i, i + 3).map(q => run(q, 400))));   // 3 browsers at a time
  const clears = Array(8).fill(0), attempts = Array(8).fill(0);
  out.forEach((r, i) => {
    const log = r.botLog || { results: [], attempts: {} };
    for (let n = 1; n <= 7; n++) {
      if (log.results.some(x => x.n === n && x.kind === "clear")) clears[n]++;
      attempts[n] += log.attempts[`easy-${n}`] || 0;
    }
    console.log(`run ${i + 1}: ${log.stopReason || "timeout"}  attempts ${JSON.stringify(log.attempts)}${r.errors.length ? "  ERRORS " + r.errors : ""}`);
  });
  let pass = true;
  for (let n = 1; n <= 7; n++) {
    const ok = clears[n] >= Math.ceil(runs * .8);
    pass = pass && ok;
    console.log(`Easy ${n}: cleared in ${clears[n]}/${runs} runs, ${attempts[n]} attempts ${ok ? "OK" : "FAIL"}`);
  }
  console.log(pass ? "EASY CURVE PASS" : "EASY CURVE FAIL");
  return pass;
}

async function calibrate(seeds = 3, err = "") {
  const one = async s => {
    const pg = await openPage(`level=moderate&bot=human&seed=${s}${err ? "&err=" + err : ""}`);
    await sleep(60000);
    const r = JSON.parse(await pg.evaluate("JSON.stringify(botLog.results.map(r => r.count))") || "[]");
    pg.close(); return r;
  };
  const all = [];
  for (let s = 1; s <= seeds; s += 3)                              // at most 3 browsers at a time
    for (const r of await Promise.all([s, s + 1, s + 2].filter(x => x <= seeds).map(one))) all.push(...r);
  all.sort((a, b) => a - b);
  console.log(`err=${err || "default"} collapse heights:`, all.join(" "), " median:", all[Math.floor(all.length / 2)]);
}

(async () => {
  const [cmd, ...a] = process.argv.slice(2);
  if (cmd === "shot") await shot(a[0], a[1], a[2].split(",").map(Number));
  else if (cmd === "run") console.log(JSON.stringify(await run(a[0], +(a[1] || 300))));
  else if (cmd === "easy-curve") process.exitCode = (await easyCurve(+(a[0] || 10))) ? 0 : 1;
  else if (cmd === "calibrate") await calibrate(+(a[0] || 3), a[1] || "");
  else { console.log("usage: node tests/harness.js shot|run|easy-curve|calibrate ..."); process.exitCode = 2; }
})().catch(e => { console.error(e); process.exitCode = 1; });
