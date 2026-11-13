// Level rules (levels.js). Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../levels.js");

const DIFFS = ["easy", "moderate", "tough"];

test("Easy levels 1-7 are gentle plain stacks (3..6, level 1 = 3, no wind/kettle)", () => {
  for (let n = 1; n <= 7; n++) {
    const d = L.level("easy", n);
    assert.equal(d.goal, "stack", `easy ${n} goal`);
    assert.ok(d.target >= 3 && d.target <= 6, `easy ${n} target ${d.target}`);
    assert.equal(d.wind, null, `easy ${n} wind`);
    assert.equal(d.kettleAt, null, `easy ${n} forced kettle`);
    assert.equal(d.kettleAfter, Infinity, `easy ${n} random kettle`);
    assert.equal(d.boss, false);
    assert.equal(d.assist, true, `easy ${n} landing assist`);
  }
  assert.equal(L.level("easy", 1).target, 3);
  assert.equal(L.level("easy", 8).assist, false);
  assert.equal(L.level("moderate", 1).assist, false);
});

test("Moderate and Tough use the goal cycle from level 1; Tough L1 target >= Moderate L1", () => {
  assert.equal(L.level("moderate", 1).goal, "stack");
  assert.equal(L.level("tough", 1).goal, "stack");
  const goals = new Set();
  for (let n = 1; n <= 9; n++) goals.add(L.level("moderate", n).goal);
  for (const g of ["stack", "perfect", "miss", "kettle"]) assert.ok(goals.has(g), `cycle has ${g}`);
  assert.ok(L.level("tough", 1).target >= L.level("moderate", 1).target);
});

test("Boss levels every 5th level (Easy from 10, others from 5)", () => {
  for (const diff of DIFFS) {
    const first = diff === "easy" ? 10 : 5;
    for (let n = 1; n <= L.COUNT; n++) {
      const d = L.level(diff, n);
      assert.equal(d.boss, n % 5 === 0 && n >= first, `${diff} ${n}`);
      if (d.boss) assert.ok(d.wind || d.kettleAt !== null, `${diff} ${n} boss has wind or early kettle`);
    }
  }
  assert.equal(L.level("easy", 5).boss, false);
});

test("Targets never decrease within a difficulty", () => {
  for (const diff of DIFFS) {
    let prev = 0;
    for (let n = 1; n <= L.COUNT; n++) {
      const t = L.level(diff, n).target;
      assert.ok(t >= prev, `${diff} ${n}: ${t} < ${prev}`);
      prev = t;
    }
  }
});

test("Same difficulty + level always gives the same definition (seed, wind schedule)", () => {
  for (const diff of DIFFS) for (const n of [1, 5, 10, 17, 30]) {
    assert.deepEqual(L.level(diff, n), L.level(diff, n));
  }
  assert.notEqual(L.level("easy", 3).seed, L.level("easy", 4).seed);
  assert.notEqual(L.level("easy", 3).seed, L.level("moderate", 3).seed);
});

test("Bad level numbers clamp instead of throwing", () => {
  assert.equal(L.level("easy", 0).n, 1);
  assert.equal(L.level("easy", 31).n, L.COUNT);
  assert.equal(L.level("easy", "abc").n, 1);
  assert.equal(L.level("easy", 4.6).n, 5);
  assert.equal(L.level("nonsense", 2).diff, "moderate");
});

test("Star thresholds are ordered and reachable; perfect goals need their perfects", () => {
  for (const diff of DIFFS) for (let n = 1; n <= L.COUNT; n++) {
    const d = L.level(diff, n);
    assert.ok(d.stars[0] <= d.stars[1] && d.stars[1] <= d.stars[2], `${diff} ${n} order`);
    assert.ok(d.stars[2] <= d.target, `${diff} ${n} reachable`);
    if (d.goal === "perfect") {
      assert.ok(d.perfects >= 1 && d.perfects <= d.target);
      assert.ok(d.stars[0] >= d.perfects, "1 star already implies the required perfects");
    }
    if (d.goal === "miss") assert.ok(d.maxMiss >= 0);
    if (d.goal === "kettle") assert.ok(d.kettleAt !== null && d.kettleAt < d.target);
  }
});

test("starsFor gives 1-3 stars from perfect drops", () => {
  const d = L.level("moderate", 1);
  assert.equal(L.starsFor(d, 0), 1);
  assert.equal(L.starsFor(d, d.stars[1]), 2);
  assert.equal(L.starsFor(d, d.target), 3);
});

test("goalText reads plainly for every goal type", () => {
  assert.equal(L.goalText(L.level("easy", 1)), "Stack 3");
  for (const diff of DIFFS) for (let n = 1; n <= L.COUNT; n++) {
    const t = L.goalText(L.level(diff, n));
    assert.match(t, /^Stack \d+/);
  }
  const boss = L.level("moderate", 5);
  assert.match(L.goalText(boss), boss.wind ? /wind/i : /kettle/i);
});
