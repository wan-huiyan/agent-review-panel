/* ============================================================================
   QUEST — timeline + side-scroll camera + per-stage action choreography.
   Drives PE (engine.js). Hero "your code" walks the path; each station plays
   out its action. Readable UI is synced into the HTML overlay (no pixel text).
   ============================================================================ */
(function () {
  var PE = window.PE;
  var C = PE.C;

  // ---- world layout --------------------------------------------------------
  var VW = 256, VH = 144, HORIZON = 80, SCALE = 4;
  PE.setView(VW, VH); PE.setHorizon(HORIZON);

  var ST = { start: 40, gather: 156, review: 306, debate: 452, verify: 588, adjudicate: 712, report: 826 };
  var WORLD_W = 872;
  function byAt(wx) { return PE.pathYatWorld(wx) - 2; } // feet sit just above path center

  // ---- timeline ------------------------------------------------------------
  var W = 2.3; // walk dur
  var phases = [
    { kind: 'hold', stage: 'start', dur: 1.8 },
    { kind: 'walk', from: ST.start, to: ST.gather, stage: 'gather', dur: W + 0.4 },
    { kind: 'action', stage: 'gather', dur: 5.6 },
    { kind: 'walk', from: ST.gather, to: ST.review, stage: 'review', dur: W + 0.5 },
    { kind: 'action', stage: 'review', dur: 4.8 },
    { kind: 'walk', from: ST.review, to: ST.debate, stage: 'debate', dur: W + 0.3 },
    { kind: 'action', stage: 'debate', dur: 6.2 },
    { kind: 'walk', from: ST.debate, to: ST.verify, stage: 'verify', dur: W + 0.2 },
    { kind: 'action', stage: 'verify', dur: 4.4 },
    { kind: 'walk', from: ST.verify, to: ST.adjudicate, stage: 'adjudicate', dur: W + 0.2 },
    { kind: 'action', stage: 'adjudicate', dur: 4.2 },
    { kind: 'walk', from: ST.adjudicate, to: ST.report, stage: 'report', dur: W - 0.4 },
    { kind: 'action', stage: 'report', dur: 4.6 },
    { kind: 'hold', stage: 'report', dur: 3.0 }
  ];
  var tStart = 0, TOTAL = 0;
  for (var i = 0; i < phases.length; i++) { phases[i].start = TOTAL; TOTAL += phases[i].dur; }

  function easeInOut(u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function stateAt(tt) {
    tt = ((tt % TOTAL) + TOTAL) % TOTAL;
    var p = phases[phases.length - 1], local = 0;
    for (var i = 0; i < phases.length; i++) { if (tt < phases[i].start + phases[i].dur) { p = phases[i]; local = tt - p.start; break; } }
    var u = clamp(local / p.dur, 0, 1);
    var heroX, traveling = false, walkPhase = null, stageKey = p.stage, activeLocal = -1;
    if (p.kind === 'walk') { heroX = p.from + (p.to - p.from) * easeInOut(u); traveling = true; walkPhase = (local * 2.4) % 1; }
    else { heroX = ST[p.stage]; if (p.kind === 'action') activeLocal = local; }
    return { phase: p, local: local, u: u, heroX: heroX, traveling: traveling, walkPhase: walkPhase, stage: stageKey, activeLocal: activeLocal };
  }

  // =========================================================================
  //  STATION CHOREOGRAPHY  (sx = screen x of station center, by = ground y)
  //  lt = local action time in seconds (>=0 when active), t = global time.
  // =========================================================================
  function pip(x, y, n, c) { for (var i = 0; i < n; i++) PE.blit(['.#.', '###', '.#.'], x + i * 4, y, { '#': c }); }

  function drawGather(sx, by, t, lt) {
    PE.shadowEllipse(sx + 12, by, 8, 2);
    var beat2 = lt >= 2.4;
    var bounce = (lt >= 0 && lt > 5.0) ? Math.round(Math.abs(Math.sin((lt - 5) * 9)) * 2) : 0;
    PE.blob(sx + 12, by - bounce, 8, C.blu, C.bluD, { look: beat2 ? 1 : -1, mood: (lt >= 0 && lt > 5.0) ? 'happy' : 'o', blink: blinkAt(t, 1), hi: C.bluL });
    PE.rect(sx + 18, by - 6, 6, 5, C.woodS); PE.hline(sx + 18, by - 6, 6, C.wood);

    // BEAT 1: collect context tokens (signals / persona clues / knowledge)
    var kinds = ['spark', 'mask', 'book'], tgtX = sx + 12, tgtY = by - 15;
    for (var i = 0; i < 3; i++) {
      var t0 = 0.3 + i * 0.55, t1 = t0 + 0.7;
      if (lt < 0) { var a = t * 1.2 + i * 2.1; PE.token(kinds[i], sx - 2 + i * 12, by - 26 + Math.round(Math.sin(a) * 2), t); }
      else if (lt < 2.4) {
        if (lt < t0) PE.token(kinds[i], sx - 8 + i * 16, by - 30, t);
        else if (lt < t1) { var k = easeInOut((lt - t0) / (t1 - t0)); PE.token(kinds[i], Math.round((sx - 8 + i * 16) + (tgtX - (sx - 8 + i * 16)) * k), Math.round((by - 30) + (tgtY - (by - 30)) * k), t); }
        else if (lt < t1 + 0.2) PE.token('star', tgtX, tgtY, t);
      }
    }
    if (lt < 0) return;

    // BEAT 2: assign personas — masks fly to a lineup of reviewers, each lights up
    var roleC = [C.grn, C.red, C.blu, C.yel], roleD = [C.grnD, C.redD, C.bluD, C.yelD], roleL = [C.grnL, C.redL, C.bluL, C.yelL];
    var baseX = sx + 30, baseY = by - 1;
    for (var r = 0; r < 4; r++) {
      var rx = baseX + r * 13, assignT = 2.7 + r * 0.55, assigned = lt >= assignT + 0.45;
      PE.shadowEllipse(rx, baseY, 5, 1);
      PE.blob(rx, baseY, 5, assigned ? roleC[r] : C.dim, assigned ? roleD[r] : C.line, { look: -1, mood: 'o', blink: blinkAt(t, r + 7), hi: assigned ? roleL[r] : C.mut });
      if (lt >= assignT - 0.6 && lt < assignT + 0.45) {
        var kk = easeInOut(clamp((lt - (assignT - 0.6)) / 1.05, 0, 1));
        PE.persona(Math.round(tgtX + (rx - tgtX) * kk), Math.round((by - 16) + ((baseY - 11) - (by - 16)) * kk), roleC[r], t);
      } else if (assigned) {
        PE.persona(rx, baseY - 12, roleC[r], t);
      }
    }
  }

  var REV = [
    { c: 'grn', em: 'check' }, { c: 'red', em: 'shield' }, { c: 'blu', em: 'bolt' },
    { c: 'yel', em: 'db' }, { c: 'pur', em: 'grid' }, { c: 'org', em: 'warn' }
  ];
  function tinyPage(x, y, scan) {
    PE.rect(x, y, 9, 11, C.inset); PE.hline(x, y, 9, C.bluD); PE.vline(x, y, 11, C.bluD); PE.hline(x, y + 10, 9, C.bluD); PE.vline(x + 8, y, 11, C.bluD);
    for (var r = 0; r < 4; r++) PE.hline(x + 2, y + 2 + r * 2, 3 + (r % 3), r === 0 ? C.blu : C.mut);
    if (scan != null) { var s = x + 1 + Math.round(scan * 6); PE.vline(s, y + 1, 9, C.visor); }
  }
  function drawReview(sx, by, t, lt) {
    var cx = sx + 12;
    var cols = [cx - 30, cx - 4, cx + 22], rows = [by - 26, by];
    for (var i = 0; i < 6; i++) {
      var col = i % 3, row = (i / 3) | 0;
      var x = cols[col], y = rows[row], r = REV[i], tint = C[r.c], tintD = C[r.c + 'D'];
      PE.shadowEllipse(x, y, 6, 1);
      // independent scan phase per reviewer (parallel, no cross-talk)
      var ph = (i * 0.137);
      var scan = lt >= 0 ? ((lt * 0.5 + ph) % 1) : null;
      tinyPage(x - 11, y - 12, lt >= 0 ? scan : null);
      PE.blob(x, y, 6, tint, tintD, { look: -1, mood: 'o', blink: blinkAt(t, i + 2), hi: C[r.c + 'L'] });
      PE.emblem(r.em, x - 2, y - 22, tint); // floating badge = personality
      // magnifier sweeping over its own page
      if (lt >= 0) { var mxx = x - 10 + Math.round((scan) * 7); PE.magnifier(mxx, y - 7, C.ink2); }
      // finding bubble pops (staggered) — its semantic color
      var pop = 0.8 + i * 0.5;
      if (lt >= pop) { var g = clamp((lt - pop) * 6, 0, 1); var b = PE.speech(x + 4, y - 22, tint, C.board, 1, g); if (g > 0.6) PE.rect(x + 8, y - 19, 2, 2, tint); }
    }
  }

  function sealedCard(x, y, score, color, st) {
    PE.rect(x, y, 13, 9, C.board); PE.hline(x, y, 13, color); PE.hline(x, y + 8, 13, C.boardS); PE.vline(x, y, 9, color); PE.vline(x + 12, y, 9, color);
    if (st < 0.7) { PE.blit(['.#.', '###', '###'], x + 5, y + 3, { '#': color }); } // sealed
    else { for (var i = 0; i < score; i++) PE.blit(['.#.', '###', '.#.'], x + 1 + i * 3, y + 3, { '#': color }); } // revealed pips
  }
  function drawDebate(sx, by, t, lt) {
    var ax = sx + 2, bx = sx + 22;
    PE.shadowEllipse(ax, by, 7, 2); PE.shadowEllipse(bx, by, 7, 2);
    var reflectT = 2.4, blindT = 3.8;
    var phase = lt < 0 ? 'idle' : lt < reflectT ? 'argue' : lt < blindT ? 'reflect' : 'blind';
    var sh = phase === 'argue' ? Math.round(Math.sin(lt * 22) * 1) : 0;
    var mood = phase === 'blind' ? 'blind' : phase === 'reflect' ? 'o' : 'mad';
    var yLook = phase === 'reflect' ? -1 : 1, pLook = phase === 'reflect' ? 1 : -1; // turn away to reflect
    PE.blob(ax + sh, by, 7, C.yel, C.yelD, { look: yLook, mood: mood, blink: phase === 'blind' ? 0 : blinkAt(t, 3), hi: C.yelL });
    PE.blob(bx - sh, by, 7, C.pur, C.purD, { look: pLook, mood: mood, blink: phase === 'blind' ? 0 : blinkAt(t, 5), hi: C.purL });
    if (lt < 0) return;
    if (phase === 'argue') {
      var beat = Math.floor(lt / 0.6);
      if (beat % 2 === 0) { PE.speech(ax - 13, by - 24, C.yel, C.board, 1, 1); PE.blit(['.#.', '.#.', '...', '.#.'], ax - 8, by - 22, { '#': C.yelL }); }
      else { PE.speech(bx + 3, by - 24, C.red, C.board, 1, 1); PE.blit(['##.', '..#', '.#.', '...', '.#.'], bx + 6, by - 23, { '#': C.redL }); }
      if (beat % 2 === 1) PE.blit(['#.#', '.#.', '#.#'], sx + 11, by - 12, { '#': C.spark });
    } else if (phase === 'reflect') {
      // private reflection — thought bubbles, turned away from each other
      PE.speech(ax - 12, by - 25, C.yelD, C.board, 1, 1); PE.blit(['#.#'], ax - 8, by - 22, { '#': C.mut });
      PE.speech(bx + 4, by - 25, C.purD, C.board, 1, 1); PE.blit(['#.#'], bx + 8, by - 22, { '#': C.mut });
      var dn = Math.floor((lt - reflectT) * 4) % 3;
      for (var d = 0; d <= dn; d++) { PE.px(ax - 5, by - 28 - d * 2, C.mut); PE.px(bx + 11, by - 28 - d * 2, C.mut); }
    } else {
      // blind scoring — sealed cards rise, then flip to private scores
      var rise = clamp((lt - blindT) * 4, 0, 1), yy = by - 27 - Math.round(rise * 6);
      sealedCard(ax - 8, yy, 3, C.yel, lt - blindT);
      sealedCard(bx - 4, yy, 4, C.pur, lt - blindT);
    }
  }

  function drawVerify(sx, by, t, lt) {
    var kx = sx + 4;
    PE.shadowEllipse(kx, by, 7, 2);
    var glow = lt >= 3.4 && (Math.sin(lt * 10) > 0);
    PE.blob(kx, by, 7, C.grn, C.grnD, { look: 1, mood: 'happy', blink: blinkAt(t, 4), hi: C.grnL });
    PE.shield(kx - 8, by - 4, glow);
    // claims panel to the right
    var px = sx + 16, py = by - 22;
    PE.rect(px, py, 26, 22, C.board); PE.hline(px, py, 26, C.boardF); PE.rect(px + 1, py + 1, 24, 20, C.inset);
    var verdicts = [['check', C.grn], ['cross', C.red], ['check', C.grn]];
    for (var r = 0; r < 3; r++) {
      var ry = py + 3 + r * 6;
      PE.hline(px + 3, ry + 1, 12, C.mut); // claim bar
      var revealT = 0.7 + r * 1.0;
      if (lt >= revealT) { PE.stamp(verdicts[r][0], px + 18, ry, verdicts[r][1]); }
      // moving magnifier checking current row
      if (lt >= revealT - 0.5 && lt < revealT + 0.2) PE.magnifier(px + 9, ry + 1, C.visor);
    }
  }

  function drawAdjudicate(sx, by, t, lt, shakeRef) {
    var jx = sx + 12;
    PE.throne(jx, by);
    PE.shadowEllipse(jx, by, 8, 2);
    PE.blob(jx, by - 4, 7, C.blu, C.bluD, { look: 0, mood: 'happy', blink: blinkAt(t, 6), hi: C.bluL });
    PE.robe(jx, by - 4, 7);
    PE.wig(jx, by - 18, 7);
    // scales weigh then settle
    var slamT = 2.2, tilt;
    if (lt < 0) tilt = Math.sin(t * 1.5) * 0.18;
    else if (lt < slamT) tilt = Math.sin(lt * 4) * 0.22 * (1 - lt / slamT);
    else tilt = 0;
    PE.scales(jx + 10, by - 18, tilt);
    if (lt < 0) { PE.gavel(jx - 14, by - 6, 0.5); return; }
    // gavel raise then SLAM at slamT
    var ang;
    if (lt < slamT - 0.3) ang = 0.4 + (lt / (slamT - 0.3)) * 0.7; // raising
    else if (lt < slamT) ang = 1.1 - ((lt - (slamT - 0.3)) / 0.3) * 1.0; // swing down
    else ang = 0.1;
    PE.gavel(jx - 14, by - 6, ang);
    // impact
    if (lt >= slamT && lt < slamT + 0.4) {
      var d = (lt - slamT) / 0.4;
      shakeRef.s = Math.round((1 - d) * 3 * Math.sin(lt * 70));
      // dust + sparks
      for (var s = 0; s < 6; s++) { var a = Math.PI + (s / 5) * Math.PI; var rr = 4 + d * 10; PE.px(jx - 20 + Math.round(Math.cos(a) * rr), by - 5 - Math.round(Math.abs(Math.sin(a)) * rr), C.goldL); }
    }
    // ruling labels pop (epistemic): drawn as colored gem chips above
    if (lt >= slamT + 0.2) {
      var g = clamp((lt - slamT - 0.2) * 5, 0, 1);
      PE.speech(jx - 4, by - 34 - Math.round(g * 4), C.gold, C.board, 1, g);
    }
  }

  function drawReport(sx, by, t, lt) {
    // flag raises on the monument; confetti celebrates
    var raise = clamp(lt / 1.2, 0, 1);
    PE.banner(sx + 18, by - Math.round(raise * 8), C.blu2);
    PE.monument(sx + 18, by);
    // hero + a little blob cheer
    if (lt >= 0) {
      // confetti
      var rng = PE.mkRng(99);
      var cols = [C.grn, C.red, C.yel, C.blu, C.pur, C.gold];
      for (var i = 0; i < 40; i++) {
        var cx = (rng() * VW) | 0, life = (lt + rng() * 2) % 2.2; if (life > 1.8) continue;
        var cy = 20 + (rng() * 30) + life * 40; PE.px(cx, cy | 0, cols[i % 6]);
      }
    }
  }

  function blinkAt(t, seed) { var p = (t * 0.7 + seed * 1.3) % 4; return (p > 3.82) ? 1 : 0; }

  // which sub-beat of a stage's action are we in (for the narration overlay)
  function beatFor(stage, lt) {
    if (lt < 0) return null;
    if (stage === 'gather') return lt < 2.4 ? 'collect' : 'persona';
    if (stage === 'debate') return lt < 2.4 ? 'argue' : lt < 3.8 ? 'reflect' : 'blind';
    if (stage === 'review') return 'scan';
    if (stage === 'verify') return 'check';
    if (stage === 'adjudicate') return lt < 2.2 ? 'weigh' : 'rule';
    if (stage === 'report') return 'post';
    return null;
  }

  // ambient (off-screen-of-action) station idle so the world feels alive when walking past
  function drawStationAmbient(stage, sx, by, t) {
    if (stage === 'gather') drawGather(sx, by, t, -1);
    else if (stage === 'review') drawReview(sx, by, t, -1);
    else if (stage === 'debate') drawDebate(sx, by, t, -1);
    else if (stage === 'verify') drawVerify(sx, by, t, -1);
    else if (stage === 'adjudicate') drawAdjudicate(sx, by, t, -1, { s: 0 });
    else if (stage === 'report') drawReport(sx, by, t, -1);
  }

  // =========================================================================
  //  FRAME
  // =========================================================================
  function renderFrame(tt, t) {
    var st = stateAt(tt);
    var camRaw = clamp(st.heroX, VW / 2, WORLD_W - VW / 2);
    var shake = { s: 0 };
    // pre-evaluate adjudicate shake by drawing later; we need ox first, so compute shake within draw and re-apply — simpler: draw, capturing shake, then it affects same frame's later layers. We'll compute shake before world draw:
    if (st.stage === 'adjudicate' && st.activeLocal >= 0) {
      var slamT = 2.2, lt = st.activeLocal;
      if (lt >= slamT && lt < slamT + 0.4) { var d = (lt - slamT) / 0.4; shake.s = Math.round((1 - d) * 3 * Math.sin(lt * 70)); }
    }
    var ox = Math.round(camRaw - VW / 2) + shake.s;

    // --- layers ---
    PE.clear(C.sky1);
    PE.sky();
    PE.stars(t);
    PE.moon(VW - 40, 30, t);
    PE.hills(ox);
    PE.ground();
    PE.pathBand(ox, WORLD_W);
    PE.grassTufts(ox, WORLD_W);

    // background trees + lanterns (world props)
    [90, 230, 360, 520, 650, 770].forEach(function (wx, i) { PE.tree(wx - ox, byAt(wx) + 3); });
    [110, 270, 400, 540, 690, 800].forEach(function (wx) { PE.lantern(wx - ox, byAt(wx) + 2, t); });

    // stations (draw all that are near the viewport)
    var stages = ['gather', 'review', 'debate', 'verify', 'adjudicate', 'report'];
    for (var i = 0; i < stages.length; i++) {
      var sName = stages[i], wx = ST[sName], sx = wx - ox; if (sx < -70 || sx > VW + 70) continue;
      var by = byAt(wx);
      var active = (st.stage === sName && st.activeLocal >= 0);
      if (sName === 'adjudicate') drawAdjudicate(sx, by, t, active ? st.activeLocal : -1, shake);
      else if (sName === 'gather') drawGather(sx, by, t, active ? st.activeLocal : -1);
      else if (sName === 'review') drawReview(sx, by, t, active ? st.activeLocal : -1);
      else if (sName === 'debate') drawDebate(sx, by, t, active ? st.activeLocal : -1);
      else if (sName === 'verify') drawVerify(sx, by, t, active ? st.activeLocal : -1);
      else if (sName === 'report') drawReport(sx, by, t, active ? st.activeLocal : -1);
    }

    // hero
    var hx = Math.round(st.heroX) - ox, hby = byAt(st.heroX);
    PE.shadowEllipse(hx, hby, 6, 2);
    PE.hero(hx, hby, { walk: st.walkPhase, look: 1 });
    // hero "GO!" wave at start
    if (st.stage === 'start' && st.phase.kind === 'hold') {
      PE.speech(hx + 7, hby - 22, C.blu, C.board, 1, 1);
      PE.blit(['.#.', '###', '.#.'], hx + 11, hby - 20, { '#': C.bluL });
    }

    st.beat = beatFor(st.stage, st.activeLocal);
    return st;
  }

  // =========================================================================
  //  LOOP + DOM SYNC
  // =========================================================================
  var canvas, ctx, dispW, dispH, playing = true, t0 = performance.now() / 1000, pausedAt = 0, baseT = 0;
  var onStage = null, lastStageSig = '';

  function now() { return playing ? (performance.now() / 1000 - t0) : pausedAt; }

  function loop() {
    var t = performance.now() / 1000 - t0base;
    var tt = playing ? (t - baseOffset) : frozenTT;
    try {
      var st = renderFrame(tt, t);
      PE.present(ctx, dispW, dispH);
      var sig = st.stage + '|' + st.phase.kind;
      if (sig !== lastStageSig) { lastStageSig = sig; if (onStage) onStage(st.stage, st.phase.kind, st); }
      if (onStage && onStage.progress) onStage.progress(tt / TOTAL, st);
    } catch (e) { window.__loopErr = (e && e.stack) || String(e); }
    raf = requestAnimationFrame(loop);
  }

  // simpler clock management
  var t0base = performance.now() / 1000, baseOffset = 0, frozenTT = 0, raf = null;

  function start(cnv, opts) {
    canvas = cnv; ctx = canvas.getContext('2d');
    dispW = PE.AW; dispH = PE.AH;
    canvas.width = dispW; canvas.height = dispH;
    onStage = opts && opts.onStage;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function pause() { if (playing) { frozenTT = (performance.now() / 1000 - t0base) - baseOffset; playing = false; } }
  function play() { if (!playing) { baseOffset = (performance.now() / 1000 - t0base) - frozenTT; playing = true; } }
  function toggle() { playing ? pause() : play(); return playing; }
  function seek(tt) { // set timeline to tt seconds
    tt = ((tt % TOTAL) + TOTAL) % TOTAL;
    if (playing) baseOffset = (performance.now() / 1000 - t0base) - tt; else frozenTT = tt;
  }
  function restart() { seek(0); play(); }
  function stageStart(stage) { for (var i = 0; i < phases.length; i++) if (phases[i].stage === stage && (phases[i].kind === 'action' || phases[i].kind === 'hold')) return phases[i].start; return 0; }
  function isPlaying() { return playing; }

  // deterministic single-frame render (for screenshots / when rAF is paused)
  function renderAt(tt) {
    if (!ctx) return null;
    var st = renderFrame(tt, performance.now() / 1000);
    PE.present(ctx, dispW, dispH);
    var sig = st.stage + '|' + st.phase.kind;
    lastStageSig = sig; if (onStage) onStage(st.stage, st.phase.kind, st);
    if (onStage && onStage.progress) onStage.progress(tt / TOTAL, st);
    return st;
  }

  window.QUEST = { start: start, pause: pause, play: play, toggle: toggle, seek: seek, restart: restart, stageStart: stageStart, isPlaying: isPlaying, renderAt: renderAt, TOTAL: TOTAL, ST: ST, phases: phases };
})();
