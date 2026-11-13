// Chai Tower level rules: 30 levels per difficulty, generated from rules (no hand-made levels).
// Pure data + functions so they run in the browser (global `ChaiLevels`) and in Node tests (require).
(function (root) {
  "use strict";
  const COUNT = 30;
  const GOALS = ["stack", "perfect", "miss", "kettle"];          // the goal cycle outside the Easy opening

  // per difficulty: target ramp, when bosses start, defaults for random kettles and miss limits
  const DIFF = {
    easy:     { idx: 0, opening: [3, 3, 4, 4, 4, 5, 5], base: 6, from: 8, slope: .28, cap: 14, firstBoss: 10,
                kettleAfter: 15, maxMiss: 2, perfectShare: .25 },
    moderate: { idx: 1, opening: [],                    base: 4, from: 1, slope: .3,  cap: 14, firstBoss: 5,
                kettleAfter: 8,  maxMiss: 2, perfectShare: .25 },
    tough:    { idx: 2, opening: [],                    base: 4, from: 1, slope: .34, cap: 15, firstBoss: 5,
                kettleAfter: 5,  maxMiss: 1, perfectShare: .2 },
  };

  function clampN(n) {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(COUNT, Math.max(1, v)) : 1;
  }

  // wind for boss levels is scheduled in physics steps (60 per second) from a fixed seed, so every attempt is identical
  function windFor(seed) {
    return { startDrop: 2, firstStep: 150, everySteps: 420, durSteps: 96, dirSeed: seed ^ 0x5bd1e995 };
  }

  function level(diff, n) {
    const key = DIFF[diff] ? diff : "moderate";
    const D = DIFF[key];
    n = clampN(n);
    const seed = (D.idx + 1) * 100003 + n * 7919;
    const opening = n <= D.opening.length;
    const target = opening ? D.opening[n - 1]
      : Math.min(D.cap, D.base + Math.floor((n - D.from) * D.slope));
    const def = { diff: key, n, seed, target, goal: "stack", boss: false, wind: null, kettleAt: null,
                  kettleAfter: opening ? Infinity : D.kettleAfter, perfects: 0, maxMiss: null,
                  assist: opening };   // gentle opening: slightly-off landings settle toward the centre

    if (!opening) {
      def.boss = n % 5 === 0 && n >= D.firstBoss;
      if (def.boss) {
        // bosses alternate: wind on levels 5, 15, 25…; an early heavy kettle on 10, 20, 30
        if (n % 10 === 5) def.wind = windFor(seed);
        else { def.goal = "kettle"; def.kettleAt = 2; }
      } else {
        def.goal = GOALS[(n - D.from) % GOALS.length];
      }
      if (def.goal === "perfect") def.perfects = Math.max(1, Math.round(target * D.perfectShare));
      if (def.goal === "miss") def.maxMiss = D.maxMiss;
      if (def.goal === "kettle" && def.kettleAt === null) def.kettleAt = Math.min(3, target - 1);
    }

    // stars by perfect drops: 1 = cleared (and any required perfects), 2 ≈ a third perfect, 3 ≈ two thirds perfect
    const s1 = def.perfects;
    const s2 = Math.min(target, Math.max(s1, Math.ceil(target * .34)));
    const s3 = Math.min(target, Math.max(s2, Math.ceil(target * .67)));
    def.stars = [s1, s2, s3];
    return def;
  }

  function starsFor(def, perfects) {
    return perfects >= def.stars[2] ? 3 : perfects >= def.stars[1] ? 2 : 1;
  }

  // the plain-words goal shown at round start and in the HUD
  function goalText(def) {
    let t = `Stack ${def.target}`;
    if (def.goal === "perfect") t += ` · ${def.perfects} perfect`;
    if (def.goal === "miss") t += def.maxMiss === 0 ? " · no misses" : ` · max ${def.maxMiss} miss${def.maxMiss > 1 ? "es" : ""}`;
    if (def.goal === "kettle") t += " · survive the kettle";
    if (def.wind) t += " · 💨 wind!";
    return t;
  }

  const api = { COUNT, DIFFS: Object.keys(DIFF), level, starsFor, goalText, clampN };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ChaiLevels = api;
})(typeof window !== "undefined" ? window : this);
