/* ============================================================================
   PixelEngine (PE) — supersampled 16-bit scene renderer.
   The framebuffer is SS× the design resolution. Bitmap props are drawn in
   "design pixels" (px() writes an SS×SS block — keeps chunky pixel charm),
   while ORGANIC sprites (blobs, moon, hills, path, shadows, trees) render at
   native high resolution for smooth, fine detail. Readable text = HTML overlay.
   ============================================================================ */
(function () {
  function u32(hex) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return (255 << 24 | b << 16 | g << 8 | r) >>> 0;
  }
  var P = {
    sky1: '#10122a', sky2: '#16193a', sky3: '#202552', sky4: '#33407e', sky5: '#46568f',
    star: '#cdd6ff', star2: '#8893c8', spark: '#fff3bf',
    moon: '#f2ecca', moonS: '#cfc89c', moonShadow: '#bdb88f',
    hillB: '#191f4a', hillF: '#232c63', hillFh: '#2c3878',
    grnd: '#1d3b32', grndS: '#173129', grndH: '#2b5a45', grass: '#36694f', grassH: '#46895f',
    path: '#454a72', pathS: '#363b5f', pathE: '#565d8c', pathDot: '#7b84b4',
    tree: '#1f4a36', treeS: '#173a29', treeH: '#2f6749', trunk: '#3a2a1c',
    wood: '#7a5230', woodS: '#543821', woodH: '#9c6c3e', rope: '#4a4055',
    board: '#161a2c', boardS: '#10131f', boardF: '#3a3252', frame: '#5a4632',
    inset: '#0c0e1c', line: '#2c3350',
    ink: '#f2f5ff', ink2: '#c2cbe2', mut: '#8a92aa', dim: '#535b73',
    out: '#0a0b16', white: '#f6f9ff',
    grn: '#3fb950', grnD: '#2c8c3b', grnL: '#74e088', grnBg: '#16361f',
    red: '#f85149', redD: '#c23a33', redL: '#ff8a82', redBg: '#3a1820',
    yel: '#ecae2a', yelD: '#a87913', yelL: '#ffd166', yelBg: '#3a2c10',
    blu: '#58a6ff', blu2: '#388bfd', bluD: '#1f5fc0', bluL: '#9fd0ff', bluBg: '#0f2c52',
    pur: '#bc8cff', purD: '#8a5fd6', purL: '#ddc2ff', purBg: '#241a40',
    org: '#f0883e', orgD: '#bb5e1c', orgL: '#ffb878',
    gold: '#f2c84b', goldD: '#b9892a', goldL: '#ffe9a0', visor: '#cdeeff'
  };
  var C = {}; for (var k in P) C[k] = u32(P[k]); C.hex = P;

  // ---- buffer (SS× supersample) -------------------------------------------
  var SS = 4, VW = 0, VH = 0, AW = 0, AH = 0, buf = null;
  function setView(w, h) { VW = w; VH = h; AW = w * SS; AH = h * SS; buf = new Uint32Array(AW * AH); }
  function clear(c) { buf.fill(c); }

  // actual-resolution primitives
  function apx(x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= AW || y >= AH || c == null) return; buf[y * AW + x] = c; }
  function arect(ax, ay, w, h, c) { ax = Math.max(0, ax | 0); ay = Math.max(0, ay | 0); var x1 = Math.min(AW, ax + w), y1 = Math.min(AH, ay + h); for (var y = ay; y < y1; y++) { var row = y * AW; for (var x = ax; x < x1; x++) buf[row + x] = c; } }
  function adisc(cx, cy, r, c) { var r2 = r * r; for (var y = -r; y <= r; y++) { var yy = y * y; for (var x = -r; x <= r; x++) if (x * x + yy <= r2) apx(cx + x, cy + y, c); } }
  function aring(cx, cy, r, c) { var r2 = r * r, ri = (r - 1) * (r - 1); for (var y = -r; y <= r; y++) { var yy = y * y; for (var x = -r; x <= r; x++) { var d = x * x + yy; if (d <= r2 && d > ri) apx(cx + x, cy + y, c); } } }

  // design-pixel primitives (block of SS×SS) — for bitmap props
  function px(x, y, c) { if (c == null) return; x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= VW || y >= VH) return; var bx = x * SS, byy = y * SS; for (var j = 0; j < SS; j++) { var row = (byy + j) * AW + bx; for (var i = 0; i < SS; i++) buf[row + i] = c; } }
  function rect(x, y, w, h, c) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) px(x + i, y + j, c); }
  function hline(x, y, n, c) { for (var i = 0; i < n; i++) px(x + i, y, c); }
  function vline(x, y, n, c) { for (var j = 0; j < n; j++) px(x, y + j, c); }
  function dither(x, y, w, h, c1, c2) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) px(x + i, y + j, ((i + j) & 1) ? c2 : c1); }
  function blit(map, x, y, legend) { for (var j = 0; j < map.length; j++) { var row = map[j]; for (var i = 0; i < row.length; i++) { var ch = row[i]; if (ch === '.' || ch === ' ') continue; var c = legend[ch]; if (c != null) px(x + i, y + j, c); } } }
  function mkRng(seed) { seed = seed >>> 0; return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

  // ---- soft round shadow (actual res) -------------------------------------
  function shadowEllipse(cxD, cyD, rxD, ryD) {
    var cx = cxD * SS, cy = cyD * SS, rx = rxD * SS, ry = ryD * SS;
    for (var y = -ry; y <= ry; y++) for (var x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1 && ((x + y) & 1)) apx(cx + x, cy + y, C.grndS);
    }
  }

  // =========================================================================
  //  BLOB — the cast, rendered smooth at native resolution. Big cute eyes.
  // =========================================================================
  function blob(cxD, byD, rD, tint, tintD, o) {
    o = o || {};
    var look = o.look || 0, mood = o.mood || 'happy', blink = o.blink || 0;
    var ar = Math.round(rD * SS);
    var hh = ar - Math.round((o.squash || 0) * SS * 0.5);
    var acx = Math.round(cxD * SS), aby = Math.round(byD * SS);
    var acy = aby - hh;
    var hi = o.hi || tint;
    // 2px-block writers so the cast shares the chunky pixel grain of the scene
    function wp(x, y, c) { x |= 0; y |= 0; x -= x & 1; y -= y & 1; apx(x, y, c); apx(x + 1, y, c); apx(x, y + 1, c); apx(x + 1, y + 1, c); }
    function wdisc(cx, cy, r, c) { var r2 = r * r; for (var y = -r; y <= r; y++) { var yy = y * y; for (var x = -r; x <= r; x++) if (x * x + yy <= r2) wp(cx + x, cy + y, c); } }
    function wring(cx, cy, r, c) { var r2 = r * r, ri = (r - 1.7) * (r - 1.7); for (var y = -r; y <= r; y++) { var yy = y * y; for (var x = -r; x <= r; x++) { var d = x * x + yy; if (d <= r2 && d > ri) wp(cx + x, cy + y, c); } } }
    // feet
    var spread = Math.round(ar * 0.46), fr = Math.max(2, Math.round(ar * 0.2));
    var wob = o.walk != null ? Math.sin(o.walk * 6.283) : 0;
    wdisc(acx - spread, aby - fr + Math.round(Math.max(0, wob) * SS * 0.7), fr, C.out);
    wdisc(acx + spread, aby - fr + Math.round(Math.max(0, -wob) * SS * 0.7), fr, C.out);
    // body (coarse 2px grain + dithered shading; subtle sheen, no glossy spot)
    for (var y = -hh; y <= hh; y++) {
      var ny = y / hh, ny2 = ny * ny;
      for (var x = -ar; x <= ar; x++) {
        var nx = x / ar, d = nx * nx + ny2; if (d > 1) continue;
        var edge = (((x + 2) / ar) * ((x + 2) / ar) + ny2 > 1) || (((x - 2) / ar) * ((x - 2) / ar) + ny2 > 1) ||
                   (nx * nx + ((y + 2) / hh) * ((y + 2) / hh) > 1) || (nx * nx + ((y - 2) / hh) * ((y - 2) / hh) > 1);
        var c;
        if (edge) c = C.out;
        else {
          c = tint;
          var chk = (((x >> 1) + (y >> 1)) & 1);
          if (ny > 0.12 && chk) c = tintD;            // shaded lower belly
          else if (ny < -0.18 && !chk) c = hi;        // faint top sheen (dithered, not a solid hotspot)
        }
        wp(acx + x, acy + y, c);
      }
    }
    // face
    var eyeY = acy - Math.round(hh * 0.08);
    var ex = Math.round(ar * 0.40), eR = Math.max(2, Math.round(ar * 0.30));
    var lookpx = Math.round(look * ar * 0.18);
    if (mood === 'blind') {
      var bandTop = eyeY - Math.round(eR * 0.9), bandBot = eyeY + Math.round(eR * 0.7);
      for (var by2 = bandTop; by2 <= bandBot; by2++) for (var bx2 = -ar + 2; bx2 <= ar - 2; bx2++) {
        var nyb = (by2 - acy) / hh, nxb = bx2 / ar; if (nxb * nxb + nyb * nyb <= 1) wp(acx + bx2, by2, (by2 < eyeY - Math.round(eR * 0.15)) ? C.pur : C.purD);
      }
      wdisc(acx + ar - 2, eyeY + 1, Math.max(2, Math.round(eR * 0.4)), C.purD);
    } else {
      [-1, 1].forEach(function (s) {
        var ecx = acx + s * ex + lookpx;
        if (blink > 0.5) { for (var x = -eR; x <= eR; x++) { wp(ecx + x, eyeY, C.out); } }
        else {
          wdisc(ecx, eyeY, eR, C.white); wring(ecx, eyeY, eR, C.out);
          var pr = Math.max(2, Math.round(eR * 0.52));
          wdisc(ecx + lookpx, eyeY + Math.round(eR * 0.16), pr, C.out);
          wp(ecx - 2 + lookpx, eyeY - Math.round(eR * 0.42), C.white);
        }
      });
      if (mood === 'mad') { for (var i = 0; i < eR * 2; i += 2) { wp(acx - ex - eR + i, eyeY - eR - 2 + Math.round(i * 0.32), C.out); wp(acx + ex + eR - i, eyeY - eR - 2 + Math.round(i * 0.32), C.out); } }
    }
    // mouth
    var my = acy + Math.round(hh * 0.42), mw = Math.round(ar * 0.28);
    if (mood === 'happy') { for (var x3 = -mw; x3 <= mw; x3 += 2) { var yy3 = Math.round(Math.sqrt(Math.max(0, 1 - (x3 / mw) * (x3 / mw))) * (ar * 0.17)); wp(acx + x3, my + yy3, tintD); } }
    else if (mood === 'mad') { for (var x4 = -mw; x4 <= mw; x4 += 2) { var yy4 = Math.round(Math.sqrt(Math.max(0, 1 - (x4 / mw) * (x4 / mw))) * (ar * 0.14)); wp(acx + x4, my - yy4, tintD); } }
    else { wdisc(acx, my, Math.max(2, Math.round(ar * 0.13)), C.out); }
    return acy - hh;
  }

  // ---- judge regalia: barrister wig + robe (draw AFTER the blob) ----
  function robe(cxD, byD, rD) {
    var cx = cxD * SS, by = byD * SS, r = Math.round(rD * SS);
    function wp(x, y, c) { x |= 0; y |= 0; x -= x & 1; y -= y & 1; apx(x, y, c); apx(x + 1, y, c); apx(x, y + 1, c); apx(x + 1, y + 1, c); }
    var dark = u32('#1b1f33'), dk2 = u32('#13162a'), trim = C.goldD;
    // drape sits at the shoulders (collar just below the mouth) so the face stays clear
    var top = by - Math.round(r * 0.6);
    for (var y = top; y < by - 2; y++) {
      var f = (y - top) / (by - 2 - top); // 0..1 down
      var halfw = Math.round(r * (0.62 + 0.5 * f));
      for (var x = -halfw; x <= halfw; x++) {
        // leave a V open at the chest for the jabot
        if (f < 0.55 && Math.abs(x) < Math.round(r * 0.26 * (1 - f))) continue;
        wp(cx + x, y, (((x >> 1) + (y >> 1)) & 1) ? dk2 : dark);
      }
      // gold trim along the inner collar edges (upper part)
      if (f < 0.5) { var hw = Math.round(r * 0.26 * (1 - f)); wp(cx - hw, y, trim); wp(cx + hw, y, trim); }
    }
    // white jabot (frilled bib) down the chest
    var jb = C.white, js = u32('#d6def0');
    for (var jy = 0; jy < Math.round(r * 0.9); jy++) {
      var jw = Math.max(2, Math.round(r * 0.2 - jy * 0.12));
      for (var jx = -jw; jx <= jw; jx++) wp(cx + jx, top + 2 + jy, (jy % 4 === 3 && Math.abs(jx) > jw - 2) ? js : jb);
    }
  }
  function wig(cxD, headTopD, rD) {
    var cx = cxD * SS, top = headTopD * SS, r = Math.round(rD * SS);
    function wp(x, y, c) { x |= 0; y |= 0; x -= x & 1; y -= y & 1; apx(x, y, c); apx(x + 1, y, c); apx(x, y + 1, c); apx(x + 1, y + 1, c); }
    function wd(cx2, cy2, rr, c) { var r2 = rr * rr; for (var y = -rr; y <= rr; y++) { var yy = y * y; for (var x = -rr; x <= rr; x++) if (x * x + yy <= r2) wp(cx2 + x, cy2 + y, c); } }
    var cr = u32('#ece6d4'), sh = u32('#c9c3ad'), sh2 = u32('#b3ad95');
    // full powdered-wig silhouette framing the head, with an open face oval
    var wcx = cx, wcy = top + Math.round(r * 0.5), wrx = Math.round(r * 1.16), wry = Math.round(r * 1.28);
    var fcx = cx, fcy = top + Math.round(r * 1.02), frx = Math.round(r * 0.6), fry = Math.round(r * 0.82);
    var capY = top + Math.round(r * 1.5), rowH = Math.max(2, Math.round(r * 0.27));
    for (var y = wcy - wry; y <= wcy + wry && y <= capY; y++) {
      for (var x = wcx - wrx; x <= wcx + wrx; x++) {
        var nxw = (x - wcx) / wrx, nyw = (y - wcy) / wry, dw = nxw * nxw + nyw * nyw; if (dw > 1) continue;     // inside wig
        var nxf = (x - fcx) / frx, nyf = (y - fcy) / fry; if (nxf * nxf + nyf * nyf <= 1) continue;             // skip the face opening
        var row = Math.floor((y - (wcy - wry)) / rowH);
        var c = (row & 1) ? sh : cr;
        if (dw > 0.84) c = (((x >> 1) + (y >> 1)) & 1) ? sh2 : sh;   // shaded outer curls
        else if (((x >> 1) % 3 === 0) && (row & 1) === 0) c = cr;     // curl highlights
        wp(x, y, c);
      }
    }
    // two long side curls hanging beside the face
    var curlR = Math.max(2, Math.round(r * 0.21));
    for (var side = -1; side <= 1; side += 2) {
      for (var s = 0; s < 3; s++) wd(wcx + side * Math.round(wrx * 0.92), top + Math.round(r * 1.18) + s * Math.round(curlR * 1.7), curlR, (s & 1) ? sh : cr);
    }
  }

  function arm(cx, cy, dir, len, c) { for (var i = 0; i < len; i++) px(cx + dir * i, cy - i, c); }

  // ---- EMBLEMS (5x5 design) ----
  var EM = {
    check: ['....#', '...##', '#.##.', '###..', '.#...'], shield: ['.###.', '#####', '#####', '.###.', '..#..'],
    bolt: ['..##.', '.##..', '####.', '..##.', '.##..'], db: ['.###.', '#...#', '.###.', '#...#', '.###.'],
    grid: ['#####', '#.#.#', '#####', '#.#.#', '#####'], warn: ['..#..', '.#.#.', '.#.#.', '#####', '.....']
  };
  function emblem(name, x, y, c) { blit(EM[name], x, y, { '#': c }); }

  // ---- HERO: "your code" — a page-creature with legs ----
  function hero(cxD, byD, o) {
    o = o || {};
    var walk = o.walk, look = o.look == null ? 1 : o.look;
    var bob = walk != null ? Math.round(Math.abs(Math.sin(walk * 6.283)) * 1) : 0;
    var cx = cxD, by = byD, topY = by - 15 - bob;
    var k = C.bluD, W = C.white, b = C.blu2, m = C.mut, e = C.out, bl = C.bluL;
    var map = ['kkkkkkkkk.', 'kWWWWWWWkk', 'kWWWWWWWWk', 'kWblWWblWk', 'kWWWWWWWWk', 'kWWWmmWWWk', 'kWbbbbWWWk', 'kWbbWbbWWk', 'kWbbbbbWWk', 'kWWWWWWWWk', 'kkkkkkkkkk'];
    blit(map, cx - 5, topY, { k: k, W: W, b: b, m: m, e: e, l: bl });
    px(cx - 5 + 3 + (look > 0 ? 1 : 0), topY + 3, C.out); px(cx - 5 + 6 + (look > 0 ? 1 : 0), topY + 3, C.out);
    var ly = by - 4;
    if (walk != null) { var f = Math.sin(walk * 6.283) * 2; vline(cx - 2, ly, 4 - Math.max(0, Math.round(f)), k); px(cx - 2, by - 1 - Math.max(0, Math.round(f)), C.out); vline(cx + 2, ly, 4 - Math.max(0, Math.round(-f)), k); px(cx + 2, by - 1 - Math.max(0, Math.round(-f)), C.out); }
    else { vline(cx - 2, ly, 4, k); vline(cx + 2, ly, 4, k); }
    return topY;
  }

  // ---- PROPS (design px) ----
  function speech(x, y, color, fill, scale, grow) {
    grow = grow == null ? 1 : grow; if (grow <= 0.02) return;
    var w = Math.max(4, Math.round(13 * grow)), h = Math.max(3, Math.round(9 * grow));
    rect(x, y, w, h, fill || C.board);
    hline(x, y, w, color); hline(x, y + h - 1, w, color); vline(x, y, h, color); vline(x + w - 1, y, h, color);
    px(x, y, fill || C.board); px(x + w - 1, y, fill || C.board); px(x, y + h - 1, fill || C.board); px(x + w - 1, y + h - 1, fill || C.board);
    px(x + 3, y + h, color); px(x + 4, y + h + 1, color); return { w: w, h: h };
  }
  function codePage(x, y, scanCol) {
    rect(x, y, 14, 17, C.inset);
    hline(x, y, 14, C.bluD); vline(x, y, 17, C.bluD); hline(x, y + 16, 14, C.bluD); vline(x + 13, y, 17, C.bluD);
    for (var r = 0; r < 6; r++) { var ly = y + 3 + r * 2, len = 6 + ((r * 5) % 6); hline(x + 2, ly, len, r % 3 === 0 ? C.blu : C.mut); }
    if (scanCol != null) { var sc = x + 1 + Math.round(scanCol * 11); vline(sc, y + 1, 15, C.bluL); vline(sc + 1, y + 1, 15, C.visor); }
  }
  function magnifier(cx, cy, c) { c = c || C.ink2; blit(['.###.', '#...#', '#...#', '#...#', '.###.'], cx - 2, cy - 2, { '#': c }); px(cx + 3, cy + 3, c); px(cx + 4, cy + 4, c); px(cx + 5, cy + 5, c); px(cx, cy - 1, C.visor); }
  function shield(cx, by, glow) {
    var x = cx - 5, y = by - 13, g = C.grn, gl = glow ? C.grnL : C.grn;
    blit(['.ggggggg.', 'ggggggggg', 'ggggggggg', 'ggggggggg', '.ggggggg.', '.ggggggg.', '..ggggg..', '..ggggg..', '...ggg...', '....g....'], x, y, { g: g });
    hline(x + 1, y, 7, gl); vline(x, y + 1, 4, gl);
    var w = C.white; px(x + 2, y + 4, w); px(x + 3, y + 5, w); px(x + 4, y + 6, w); px(x + 5, y + 5, w); px(x + 6, y + 4, w); px(x + 7, y + 3, w);
  }
  function scales(x, y, tilt) {
    tilt = tilt || 0; var b = C.gold, d = C.goldD;
    px(x + 7, y, b); vline(x + 7, y + 1, 10, b);
    for (var i = 0; i < 13; i++) px(x + 1 + i, y + 2 + Math.round((i - 6) * tilt), b);
    hline(x + 4, y + 11, 7, b); hline(x + 5, y + 10, 5, d);
    var ly = y + 5 + Math.round(-6 * tilt), ry = y + 5 + Math.round(6 * tilt);
    blit(['b...b', '.b.b.', '.bbb.'], x - 1, ly, { b: b }); blit(['b...b', '.b.b.', '.bbb.'], x + 11, ry, { b: b });
  }
  function crown(cx, y) { blit(['#.#.#', '#####', '#g#g#'], cx - 2, y, { '#': C.gold, g: C.goldD }); px(cx, y - 1, C.goldL); }
  function gavel(cx, cy, ang) {
    var hx = Math.cos(ang), hy = Math.sin(ang);
    for (var i = 0; i < 7; i++) px(cx + Math.round(hx * i), cy - Math.round(hy * i) - i, C.woodS);
    var headx = cx + Math.round(hx * 7), heady = cy - Math.round(hy * 7) - 7;
    rect(headx - 2, heady - 2, 5, 4, C.wood); hline(headx - 2, heady - 2, 5, C.woodH);
  }
  function token(kind, x, y, t) {
    var bob = Math.round(Math.sin(t * 4 + x) * 1); y += bob;
    if (kind === 'spark') { blit(['.#.', '###', '.#.'], x - 1, y - 1, { '#': C.yelL }); px(x, y, C.white); }
    else if (kind === 'mask') { blit(['#####', '#.#.#', '.###.'], x - 2, y - 1, { '#': C.purL }); }
    else if (kind === 'book') { blit(['#####', '#bbb#', '#####'], x - 2, y - 1, { '#': C.bluL, b: C.blu }); }
    else if (kind === 'star') { blit(['.#.', '###', '.#.'], x - 1, y - 1, { '#': C.spark }); }
  }
  function stamp(kind, x, y, c) { if (kind === 'check') blit(['....#', '#..##', '####.', '.##..'], x, y, { '#': c }); else blit(['#...#', '.#.#.', '..#..', '.#.#.', '#...#'], x, y, { '#': c }); }
  // a persona "mask/card" that flies onto a reviewer to assign a role
  function persona(x, y, c, t) { var bob = Math.round(Math.sin((t || 0) * 4 + x) * 1); y += bob; blit(['.###.', '#...#', '#.#.#', '#...#', '.###.'], x - 2, y - 2, { '#': c }); }

  // =========================================================================
  //  ENVIRONMENT (native-res organic; design-px props)
  // =========================================================================
  var HORIZON = 0;
  function setHorizon(h) { HORIZON = h; }
  function sky() {
    var hA = HORIZON * SS;
    var edges = [0, Math.round(VH * 0.14), Math.round(VH * 0.34), Math.round(VH * 0.55), HORIZON];
    var cols = [C.sky1, C.sky2, C.sky3, C.sky4];
    for (var i = 0; i < 4; i++) arect(0, edges[i] * SS, AW, (edges[i + 1] - edges[i]) * SS + SS, cols[i]);
    arect(0, hA - 4 * SS, AW, 4 * SS, C.sky5);
  }
  function stars(t) {
    var rng = mkRng(7), hA = HORIZON * SS;
    for (var i = 0; i < 150; i++) {
      var x = (rng() * AW) | 0, y = (rng() * (hA - 16 * SS)) | 0, tw = rng();
      var on = (Math.sin(t * 2 + tw * 9) > -0.3); if (!on) continue;
      apx(x, y, tw > 0.7 ? C.star : C.star2);
      if (tw > 0.93) { apx(x + 1, y, C.star); apx(x - 1, y, C.star); apx(x, y + 1, C.star); apx(x, y - 1, C.star); }
    }
  }
  function moon(cxD, cyD, t) {
    var cx = cxD * SS, cy = cyD * SS, r = 10 * SS;
    function wp(x, y, c) { x |= 0; y |= 0; x -= x & 1; y -= y & 1; apx(x, y, c); apx(x + 1, y, c); apx(x, y + 1, c); apx(x + 1, y + 1, c); }
    function wd(cx2, cy2, rr, c) { var r2 = rr * rr; for (var y = -rr; y <= rr; y++) { var yy = y * y; for (var x = -rr; x <= rr; x++) if (x * x + yy <= r2) wp(cx2 + x, cy2 + y, c); } }
    var lit = C.moonS, mid = u32('#dcd6b6'), dim = C.moonShadow;
    for (var j = -r; j <= r; j++) for (var i = -r; i <= r; i++) {
      var d = i * i + j * j; if (d > r * r) continue;
      if (d > (r - 2 * SS) * (r - 2 * SS) && (((i >> 1) + (j >> 1)) & 1)) continue; // dithered soft rim → blends into sky
      var c = (i - j > 5 * SS) ? dim : ((((i >> 1) + (j >> 1)) & 1) ? mid : lit);
      wp(cx + i, cy + j, c);
    }
    wd(cx - 4 * SS, cy - 3 * SS, 1.6 * SS, dim); wd(cx + 3 * SS, cy + 4 * SS, 1.4 * SS, dim); wd(cx + 5 * SS, cy - 2 * SS, SS, dim); wd(cx - 2 * SS, cy + 5 * SS, 1.2 * SS, dim);
    function arc(ox, oy, w2, dpth, up) { for (var x = -w2; x <= w2; x++) { var yy = Math.round((1 - (x / w2) * (x / w2)) * dpth); wp(cx + ox + x, cy + oy + (up ? -yy : yy), dim); } }
    arc(-5 * SS, -1.5 * SS, 1.6 * SS, 1.2 * SS, true); arc(5 * SS, -1.5 * SS, 1.6 * SS, 1.2 * SS, true); arc(0, 4 * SS, 2.2 * SS, 1.4 * SS, false);
    var zb = Math.round(Math.sin(t * 1.5) * 1.5 * SS);
    blit(['###', '..#', '.#.', '###'], cxD + 9, cyD - 13 + Math.round(zb / SS), { '#': C.star2 });
  }
  function hills(camX) {
    var hA = HORIZON * SS, o1 = camX * 0.25, o2 = camX * 0.55;
    for (var ax = 0; ax < AW; ax++) {
      var dx = ax / SS, wxb = dx + o1;
      var hb = HORIZON - (12 + 7 * Math.sin(wxb * 0.03) + 4 * Math.sin(wxb * 0.11 + 2));
      arect(ax, Math.round(hb * SS), 1, hA - Math.round(hb * SS), C.hillB);
    }
    for (var ax2 = 0; ax2 < AW; ax2++) {
      var dx2 = ax2 / SS, wxf = dx2 + o2;
      var hf = HORIZON - (4 + 6 * Math.sin(wxf * 0.05 + 1) + 3 * Math.sin(wxf * 0.17));
      arect(ax2, Math.round(hf * SS), 1, hA - Math.round(hf * SS), C.hillF);
      apx(ax2, Math.round(hf * SS), C.hillFh); apx(ax2, Math.round(hf * SS) + 1, C.hillFh);
    }
  }
  function ground() { var hA = HORIZON * SS; arect(0, hA, AW, AH - hA, C.grnd); arect(0, hA, AW, 2 * SS, C.grndS); }

  function pathYf(wx) { return HORIZON + 14 + 5 * Math.sin((wx - 40) * 0.012); }
  function pathYatWorld(wx) { return Math.round(pathYf(wx)); }
  function pathBand(ox, worldW) {
    var half = 9;
    for (var ax = 0; ax < AW; ax++) {
      var wx = ax / SS + ox; if (wx < 8 || wx > worldW - 8) continue;
      var cy = pathYf(wx), cyA = Math.round(cy * SS);
      arect(ax, cyA - half * SS, 1, half * SS, C.path);
      arect(ax, cyA, 1, half * SS, C.pathS);
      apx(ax, cyA - half * SS, C.pathE); apx(ax, cyA + half * SS, C.pathE);
      if ((Math.floor(wx) % 9) < 3) { apx(ax, cyA, C.pathDot); apx(ax, cyA + 1, C.pathDot); }
    }
    var rng = mkRng(21);
    for (var i = 0; i < 500; i++) { var wx2 = 8 + (rng() * (worldW - 16) | 0); var ax2 = (wx2 - ox) * SS; if (ax2 < -SS || ax2 > AW) continue; var cy2 = Math.round(pathYf(wx2) * SS); apx(ax2 | 0, cy2 - 7 * SS + (rng() * 14 * SS | 0), rng() > 0.5 ? C.pathS : C.pathE); }
  }
  function grassTufts(ox, worldW) {
    var rng = mkRng(11);
    for (var i = 0; i < 320; i++) {
      var wx = (rng() * worldW) | 0, sx = (wx - ox); if (sx < -3 || sx > VW + 3) continue;
      var y = HORIZON + 1 + (rng() * (VH - HORIZON - 3) | 0);
      var cyp = pathYf(wx); if (Math.abs(y - cyp) < 11) continue;
      blit(['#.#', '###'], sx, y - 1, { '#': rng() > 0.5 ? C.grass : C.grassH });
    }
  }
  function tree(sxD, gyD) {
    if (sxD < -18 || sxD > VW + 18) return;
    var sx = sxD * SS, gy = gyD * SS;
    arect(sx - 1.5 * SS, gy - 6 * SS, 3 * SS, 7 * SS, C.trunk);
    for (var t = 0; t < 3; t++) {
      var ww = (17 - t * 4) * SS, yy = gy - (9 + t * 6) * SS, hgt = 8 * SS;
      for (var j = 0; j < hgt; j++) { var rowW = Math.round(ww * (j + 1) / hgt); for (var i = -(rowW >> 1); i <= (rowW >> 1); i++) apx(sx + i, yy + j, (((sx + i + yy + j) >> 1) & 1) ? C.treeS : C.tree); }
      arect(sx - (ww >> 1), yy + hgt - SS, ww, SS, C.treeH);
    }
  }
  function lantern(sxD, gyD, t) {
    if (sxD < -8 || sxD > VW + 8) return;
    var flick = (Math.sin(t * 9 + sxD) > -0.6) ? C.spark : C.yelL;
    vline(sxD, gyD - 17, 17, C.wood);
    blit(['.###.', '#YYY#', '#YgY#', '#YYY#', '.###.'], sxD - 2, gyD - 23, { '#': C.goldD, Y: C.yelL, g: flick });
    var cx = sxD * SS, cy = (gyD - 21) * SS, rng = mkRng((sxD * 13 + 1) >>> 0);
    for (var n = 0; n < 60; n++) { var a = rng() * 6.28, rr = (4 + rng() * 6) * SS; if (rng() > 0.45) apx((cx + Math.cos(a) * rr) | 0, (cy + Math.sin(a) * rr) | 0, C.yelBg); }
  }
  function throne(cx, by) {
    rect(cx - 9, by - 16, 18, 10, C.purD); rect(cx - 9, by - 6, 18, 8, C.purD);
    hline(cx - 9, by - 16, 18, C.gold); vline(cx - 9, by - 16, 22, C.goldD); vline(cx + 8, by - 16, 22, C.goldD);
    blit(['.#.', '###'], cx - 10, by - 19, { '#': C.gold }); blit(['.#.', '###'], cx + 7, by - 19, { '#': C.gold });
    rect(cx - 7, by - 6, 14, 3, C.red);
  }
  function monument(cx, gy) { rect(cx - 26, gy - 2, 4, 6, C.woodS); rect(cx + 22, gy - 2, 4, 6, C.woodS); }
  function banner(sx, gy, color) { vline(sx, gy - 22, 12, C.trunk); blit(['#####', '####.', '###..', '####.', '#####'], sx + 1, gy - 22, { '#': color }); }

  // ---- present (putImageData; canvas backing = AW×AH) ----
  var imgData = null, img32 = null;
  function present(displayCtx) {
    if (!imgData) { imgData = displayCtx.createImageData(AW, AH); img32 = new Uint32Array(imgData.data.buffer); }
    img32.set(buf);
    displayCtx.putImageData(imgData, 0, 0);
  }

  window.PE = {
    C: C, SS: SS, setView: setView, get VW() { return VW; }, get VH() { return VH; }, get AW() { return AW; }, get AH() { return AH; }, get HORIZON() { return HORIZON; },
    setHorizon: setHorizon, clear: clear, px: px, apx: apx, rect: rect, hline: hline, vline: vline, dither: dither, blit: blit, mkRng: mkRng,
    shadowEllipse: shadowEllipse, blob: blob, arm: arm, emblem: emblem, hero: hero, wig: wig, robe: robe,
    speech: speech, codePage: codePage, magnifier: magnifier, shield: shield, scales: scales, crown: crown, gavel: gavel, token: token, stamp: stamp, persona: persona,
    sky: sky, stars: stars, moon: moon, hills: hills, ground: ground, pathBand: pathBand, pathYatWorld: pathYatWorld, grassTufts: grassTufts, tree: tree, lantern: lantern, throne: throne, monument: monument, banner: banner,
    present: present
  };
})();
