/* ============================================================
   Hasta Rekha engine — palm image analysis.

   The image never leaves the device: every pixel is processed
   on a local <canvas>.

   Pipeline:
     1. skin segmentation (YCbCr) -> palm mask + bounding box
     2. normalisation into palm-space (thumb at u=0, fingers v=0)
     3. crease response = localMean(r) - pixel  (black-hat style)
     4. per-image normalisation by the 97th percentile response
     5. band-search along the classical rekha paths
     6. mount relief from local luminance vs palm mean
     7. metrics -> Samudrik Shastra interpretation
   ============================================================ */
(function (g) {
  'use strict';

  var W = 320; // working width

  /* ---------- generic helpers ---------- */

  function integral(data, w, h) {
    var I = new Float64Array((w + 1) * (h + 1));
    for (var y = 0; y < h; y++) {
      var rowsum = 0;
      for (var x = 0; x < w; x++) {
        rowsum += data[y * w + x];
        I[(y + 1) * (w + 1) + (x + 1)] = I[y * (w + 1) + (x + 1)] + rowsum;
      }
    }
    return I;
  }

  function boxMean(I, w, h, x, y, r) {
    var x0 = Math.max(0, x - r), y0 = Math.max(0, y - r),
        x1 = Math.min(w - 1, x + r), y1 = Math.min(h - 1, y + r);
    var area = (x1 - x0 + 1) * (y1 - y0 + 1);
    var s = I[(y1 + 1) * (w + 1) + (x1 + 1)] - I[y0 * (w + 1) + (x1 + 1)]
          - I[(y1 + 1) * (w + 1) + x0] + I[y0 * (w + 1) + x0];
    return s / area;
  }

  function percentile(arr, p) {
    if (!arr.length) return 0;
    var c = Float32Array.from(arr);
    c.sort();
    return c[Math.min(c.length - 1, Math.floor(p * c.length))];
  }

  /* ---------- 1. skin mask ---------- */
  function skinMask(rgba, w, h) {
    var mask = new Uint8Array(w * h), count = 0;
    for (var i = 0, p = 0; i < mask.length; i++, p += 4) {
      var R = rgba[p], G = rgba[p + 1], B = rgba[p + 2];
      var Y = 0.299 * R + 0.587 * G + 0.114 * B;
      var Cb = 128 - 0.168736 * R - 0.331264 * G + 0.5 * B;
      var Cr = 128 + 0.5 * R - 0.418688 * G - 0.081312 * B;
      var ok = (Y > 45 && Cb > 77 && Cb < 130 && Cr > 133 && Cr < 180 && R > G && R > B * 0.9);
      if (ok) { mask[i] = 1; count++; }
    }
    // 3x3 morphological close-then-open to kill speckle
    mask = morph(mask, w, h, 1, 1);   // dilate
    mask = morph(mask, w, h, 0, 1);   // erode
    mask = morph(mask, w, h, 0, 1);
    mask = morph(mask, w, h, 1, 1);
    count = 0;
    for (var k = 0; k < mask.length; k++) if (mask[k]) count++;
    return { mask: mask, count: count, ratio: count / (w * h) };
  }

  function morph(mask, w, h, dilate, r) {
    var out = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var hit = dilate ? 0 : 1;
        for (var dy = -r; dy <= r && (dilate ? !hit : hit); dy++) {
          for (var dx = -r; dx <= r; dx++) {
            var yy = y + dy, xx = x + dx;
            var v = (yy < 0 || xx < 0 || yy >= h || xx >= w) ? 0 : mask[yy * w + xx];
            if (dilate && v) { hit = 1; break; }
            if (!dilate && !v) { hit = 0; break; }
          }
        }
        out[y * w + x] = hit;
      }
    }
    return out;
  }

  // largest connected component (4-way), returns bbox
  function largestBlob(mask, w, h) {
    var label = new Int32Array(w * h).fill(-1), stack = [], best = null, cur = 0;
    for (var i = 0; i < mask.length; i++) {
      if (!mask[i] || label[i] >= 0) continue;
      var size = 0, minx = w, maxx = 0, miny = h, maxy = 0;
      stack.push(i); label[i] = cur;
      while (stack.length) {
        var idx = stack.pop(), x = idx % w, y = (idx - x) / w;
        size++;
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
        var nb = [x > 0 ? idx - 1 : -1, x < w - 1 ? idx + 1 : -1,
                  y > 0 ? idx - w : -1, y < h - 1 ? idx + w : -1];
        for (var n = 0; n < 4; n++) {
          var j = nb[n];
          if (j >= 0 && mask[j] && label[j] < 0) { label[j] = cur; stack.push(j); }
        }
      }
      if (!best || size > best.size) best = { size: size, minx: minx, maxx: maxx, miny: miny, maxy: maxy, label: cur };
      cur++;
    }
    return best ? { bbox: best, label: label } : null;
  }

  /* ---------- classical rekha paths in palm-space ----------
     u: 0 = thumb side, 1 = percussion (pinky) side
     v: 0 = base of fingers, 1 = wrist                        */
  var PATHS = {
    heart:   [[0.94,0.30],[0.82,0.24],[0.68,0.20],[0.54,0.18],[0.41,0.18],[0.30,0.20],[0.23,0.24]],
    head:    [[0.16,0.35],[0.28,0.37],[0.41,0.40],[0.54,0.43],[0.67,0.47],[0.79,0.51],[0.88,0.55]],
    life:    [[0.19,0.31],[0.14,0.42],[0.11,0.54],[0.13,0.66],[0.18,0.78],[0.25,0.88],[0.33,0.95]],
    fate:    [[0.50,0.95],[0.50,0.83],[0.50,0.70],[0.49,0.57],[0.49,0.44],[0.48,0.33],[0.48,0.24]],
    sun:     [[0.68,0.88],[0.68,0.76],[0.69,0.64],[0.69,0.52],[0.70,0.40],[0.70,0.30]],
    mercury: [[0.60,0.90],[0.66,0.78],[0.73,0.65],[0.80,0.52],[0.85,0.40],[0.88,0.31]],
    marriage:[[0.99,0.205],[0.955,0.205],[0.92,0.205],[0.885,0.205]],
    girdle:  [[0.30,0.13],[0.42,0.10],[0.56,0.10],[0.68,0.13]]
  };

  var MOUNTS = {
    Jupiter: [0.20, 0.06, 0.36, 0.20],
    Saturn:  [0.40, 0.03, 0.58, 0.17],
    Sun:     [0.60, 0.05, 0.76, 0.19],
    Mercury: [0.79, 0.09, 0.95, 0.24],
    Venus:   [0.04, 0.55, 0.28, 0.90],
    Luna:    [0.70, 0.60, 0.94, 0.92],
    UpperMars:[0.08, 0.33, 0.24, 0.48],
    LowerMars:[0.78, 0.38, 0.93, 0.56]
  };

  /* ---------- main analysis ---------- */
  function analyse(imgSource, opts) {
    opts = opts || {};
    var hand = opts.hand || 'right';

    var sw = imgSource.videoWidth || imgSource.naturalWidth || imgSource.width;
    var sh = imgSource.videoHeight || imgSource.naturalHeight || imgSource.height;
    if (!sw || !sh) throw new Error('empty image');

    var h = Math.round(W * sh / sw);
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = h;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    // left hand: mirror so the thumb always sits on the left in palm-space
    if (hand === 'left') { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.drawImage(imgSource, 0, 0, W, h);
    var img = ctx.getImageData(0, 0, W, h);
    var rgba = img.data;

    // grayscale + luminance stats
    var gray = new Float32Array(W * h);
    var lumSum = 0, lumSq = 0;
    for (var i = 0, p = 0; i < gray.length; i++, p += 4) {
      var v = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
      gray[i] = v; lumSum += v; lumSq += v * v;
    }
    var meanLum = lumSum / gray.length;
    var varLum = lumSq / gray.length - meanLum * meanLum;

    // --- quality: focus via Laplacian variance ---
    var lapSum = 0, lapSq = 0, lapN = 0;
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < W - 1; x++) {
        var k = y * W + x;
        var L = 4 * gray[k] - gray[k - 1] - gray[k + 1] - gray[k - W] - gray[k + W];
        lapSum += L; lapSq += L * L; lapN++;
      }
    }
    var focus = lapSq / lapN - Math.pow(lapSum / lapN, 2);

    // --- skin & palm box ---
    var sk = skinMask(rgba, W, h);
    var blob = largestBlob(sk.mask, W, h);
    var quality = {
      focus: focus,
      exposure: meanLum,
      contrast: Math.sqrt(varLum),
      skinRatio: sk.ratio,
      issues: []
    };
    if (focus < 40) quality.issues.push('Image is soft — hold the phone still and tap to focus.');
    if (meanLum < 55) quality.issues.push('Too dark — move towards a window or a lamp.');
    if (meanLum > 215) quality.issues.push('Over-exposed — avoid direct flash on the palm.');
    if (sk.ratio < 0.12) quality.issues.push('Palm is too small in frame — fill the guide outline.');

    if (!blob || blob.bbox.size < 0.05 * W * h) {
      return { ok: false, quality: quality,
        error: 'No clear palm detected. Fill the outline with an open, flat palm on a plain background.' };
    }

    var bb = blob.bbox;
    var bx = bb.minx, by = bb.miny, bw = bb.maxx - bb.minx + 1, bh = bb.maxy - bb.miny + 1;
    // the palm proper (crop the fingers, which are the upper ~38% of the hand blob)
    var palm = { x: bx, y: by + bh * 0.34, w: bw, h: bh * 0.66 };
    quality.aspect = bw / bh;
    if (bw / bh > 1.6 || bw / bh < 0.35) quality.issues.push('Hand looks tilted — keep fingers pointing up.');

    // --- crease response map ---
    var I = integral(gray, W, h);
    var r1 = Math.max(3, Math.round(bw * 0.035));
    var resp = new Float32Array(W * h);
    var sample = [];
    for (var y2 = 0; y2 < h; y2++) {
      for (var x2 = 0; x2 < W; x2++) {
        var k2 = y2 * W + x2;
        if (!sk.mask[k2]) continue;
        var m = boxMean(I, W, h, x2, y2, r1);
        var d = m - gray[k2];
        resp[k2] = d > 0 ? d : 0;
        if (x2 % 3 === 0 && y2 % 3 === 0) sample.push(resp[k2]);
      }
    }
    var ref = Math.max(4, percentile(sample, 0.97));

    function toPix(u, v) {
      return { x: palm.x + u * palm.w, y: palm.y + v * palm.h };
    }
    function respAt(x, y) {
      var xi = Math.round(x), yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= W || yi >= h) return 0;
      return resp[yi * W + xi];
    }

    /* --- band search along a classical path --- */
    function traceLine(path, band) {
      band = band || 0.055;
      var pts = densify(path, 60);
      var tol = band * palm.h;
      var hits = 0, depths = [], offsets = [], run = 0, bestRun = 0, breaks = 0,
          wasHit = false, trace = [];
      for (var i2 = 0; i2 < pts.length; i2++) {
        var pt = pts[i2];
        var tan = tangent(pts, i2);
        var nx = -tan.y, ny = tan.x;   // normal
        var best = 0, bestOff = 0;
        for (var o = -tol; o <= tol; o += 1) {
          var px = toPix(pt[0], pt[1]).x + nx * o;
          var py = toPix(pt[0], pt[1]).y + ny * o;
          var rr = respAt(px, py);
          if (rr > best) { best = rr; bestOff = o; }
        }
        var norm = Math.min(1.6, best / ref);
        var hit = norm > 0.42;
        var base = toPix(pt[0], pt[1]);
        trace.push({ u: pt[0], v: pt[1], off: bestOff / palm.h, strength: norm, hit: hit,
                     px: base.x + nx * bestOff, py: base.y + ny * bestOff });
        if (hit) {
          hits++; depths.push(norm); offsets.push(bestOff / tol);
          run++; if (run > bestRun) bestRun = run;
          wasHit = true;
        } else {
          if (wasHit && run > 2) breaks++;
          run = 0; wasHit = false;
        }
      }
      var n = pts.length;
      var coverage = hits / n;
      // average the response over the WHOLE path, so a line that only shows up
      // where it crosses another line cannot inherit that line's depth
      var pathDepth = trace.reduce(function (a, t) { return a + Math.min(1.2, t.strength); }, 0) / n;
      var meanDepth = depths.length ? depths.reduce(function (a, b) { return a + b; }, 0) / depths.length : 0;
      var wobble = offsets.length > 2 ? std(offsets) : 0;
      return {
        coverage: coverage,
        continuity: bestRun / n,
        breaks: Math.max(0, breaks - 1),
        depth: pathDepth,
        peakDepth: meanDepth,
        clarity: clamp01(pathDepth * 0.75 + coverage * 0.25),
        straightness: clamp01(1 - wobble * 1.4),
        score: Math.round(clamp01(coverage * 0.42 + pathDepth * 0.38 + (bestRun / n) * 0.20) * 100),
        trace: trace
      };
    }

    function densify(path, n) {
      var out = [];
      for (var t = 0; t < n; t++) {
        var f = t / (n - 1) * (path.length - 1);
        var i0 = Math.min(path.length - 2, Math.floor(f)), fr = f - i0;
        out.push([path[i0][0] + (path[i0 + 1][0] - path[i0][0]) * fr,
                  path[i0][1] + (path[i0 + 1][1] - path[i0][1]) * fr]);
      }
      return out;
    }
    function tangent(pts, i2) {
      var a = pts[Math.max(0, i2 - 1)], b = pts[Math.min(pts.length - 1, i2 + 1)];
      var dx = (b[0] - a[0]) * palm.w, dy = (b[1] - a[1]) * palm.h;
      var L = Math.hypot(dx, dy) || 1;
      return { x: dx / L, y: dy / L };
    }
    function std(a) {
      var m = a.reduce(function (x, y) { return x + y; }, 0) / a.length;
      return Math.sqrt(a.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / a.length);
    }
    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    var lines = {};
    Object.keys(PATHS).forEach(function (key) {
      lines[key] = traceLine(PATHS[key], key === 'marriage' ? 0.09 : 0.055);
    });

    // marriage lines: count distinct short horizontal creases on the percussion edge
    lines.marriage.count = countMarriageLines(resp, ref, palm, W, h);

    /* --- mounts: local luminance relief --- */
    var mounts = {};
    var palmMean = 0, palmN = 0;
    for (var y3 = Math.round(palm.y); y3 < palm.y + palm.h; y3++) {
      for (var x3 = Math.round(palm.x); x3 < palm.x + palm.w; x3++) {
        var k3 = y3 * W + x3;
        if (k3 >= 0 && k3 < gray.length && sk.mask[k3]) { palmMean += gray[k3]; palmN++; }
      }
    }
    palmMean = palmN ? palmMean / palmN : 128;
    Object.keys(MOUNTS).forEach(function (name) {
      var m2 = MOUNTS[name], s = 0, n2 = 0;
      for (var v2 = m2[1]; v2 < m2[3]; v2 += 0.01) {
        for (var u2 = m2[0]; u2 < m2[2]; u2 += 0.01) {
          var pp = toPix(u2, v2);
          var xi2 = Math.round(pp.x), yi2 = Math.round(pp.y);
          if (xi2 < 0 || yi2 < 0 || xi2 >= W || yi2 >= h) continue;
          var kk = yi2 * W + xi2;
          if (!sk.mask[kk]) continue;
          s += gray[kk]; n2++;
        }
      }
      var rel = n2 ? (s / n2 - palmMean) / (Math.sqrt(varLum) || 1) : 0;
      mounts[name] = {
        relief: rel,
        level: Math.round(clamp01(0.5 + rel * 0.55) * 100)
      };
    });

    return {
      ok: true, hand: hand, quality: quality,
      palmBox: palm, imageW: W, imageH: h, ref: ref,
      lines: lines, mounts: mounts,
      preview: cv.toDataURL('image/jpeg', 0.72)
    };
  }

  function countMarriageLines(resp, ref, palm, W, h) {
    // Marriage lines sit ABOVE the heart line on the percussion edge and are short.
    // A row is only counted when the response fades before it reaches the palm interior,
    // otherwise it is the heart line running out to the edge.
    function rowMean(y, u0, u1) {
      var x0 = Math.round(palm.x + palm.w * u0), x1 = Math.round(palm.x + palm.w * u1);
      var s = 0, n = 0;
      for (var x = x0; x <= x1; x++) {
        var k = y * W + x;
        if (k < 0 || k >= resp.length) continue;
        s += resp[k]; n++;
      }
      return n ? s / n / ref : 0;
    }
    var rows = [];
    for (var v = 0.13; v < 0.27; v += 0.005) {
      var y = Math.round(palm.y + v * palm.h);
      var edge = rowMean(y, 0.895, 0.995);     // the short mark itself
      var inner = rowMean(y, 0.76, 0.86);      // interior — a long line lights this up too
      rows.push(edge > 0.55 && inner < edge * 0.6 ? edge : 0);
    }
    var count = 0, above = false;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i] > 0 && !above) { count++; above = true; }
      else if (rows[i] === 0) above = false;
    }
    return Math.min(4, count);
  }

  g.Palm = { analyse: analyse, PATHS: PATHS, MOUNTS: MOUNTS, WORK_WIDTH: W };
})(window);
