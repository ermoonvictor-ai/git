/* ============================================================
   Jyotish Engine — sidereal (Lahiri) planetary positions,
   lagna, bhava, nakshatra, panchang and Vimshottari dasha.

   Everything runs in the browser. No network, no server.
   Accuracy: Sun/Moon ~1-2 arcmin, planets ~2-5 arcmin over
   1900-2100 — far finer than the 3°20' nakshatra padas and
   30° rashis that the interpretation actually depends on.
   ============================================================ */
(function (global) {
  'use strict';

  var RAD = Math.PI / 180, DEG = 180 / Math.PI;
  var sin = function (d) { return Math.sin(d * RAD); };
  var cos = function (d) { return Math.cos(d * RAD); };
  var tan = function (d) { return Math.tan(d * RAD); };

  function norm360(x) { x = x % 360; return x < 0 ? x + 360 : x; }
  function norm180(x) { x = norm360(x); return x > 180 ? x - 360 : x; }

  /* ---------- time ---------- */

  // Local civil date/time + timezone offset (hours, east positive) -> Julian Day (UT)
  function toJD(y, m, d, hour, min, sec, tzHours) {
    var ut = (hour + min / 60 + (sec || 0) / 3600) - tzHours;
    var dd = d + ut / 24;
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + dd + B - 1524.5;
  }

  function jdToDate(jd) {
    var z = Math.floor(jd + 0.5), f = jd + 0.5 - z, A = z;
    if (z >= 2299161) {
      var al = Math.floor((z - 1867216.25) / 36524.25);
      A = z + 1 + al - Math.floor(al / 4);
    }
    var B = A + 1524, C = Math.floor((B - 122.1) / 365.25),
        D = Math.floor(365.25 * C), E = Math.floor((B - D) / 30.6001);
    var day = B - D - Math.floor(30.6001 * E) + f;
    var month = E < 14 ? E - 1 : E - 13;
    var year = month > 2 ? C - 4716 : C - 4715;
    var di = Math.floor(day), frac = day - di, h = frac * 24;
    return { y: year, m: month, d: di, hour: Math.floor(h),
             min: Math.floor((h - Math.floor(h)) * 60) };
  }

  // Schlyter's day number: days since 2000 Jan 0.0 TDT
  function dayNumber(jd) { return jd - 2451543.5; }

  // Mean obliquity of the ecliptic
  function obliquity(jd) {
    var T = (jd - 2451545.0) / 36525;
    return 23.4392911 - (46.8150 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
  }

  /* ---------- Lahiri ayanamsa ----------
     Chitrapaksha (Lahiri) = 23°51'10" at J2000, drifting with the
     general precession in longitude (~50.29"/yr). */
  function ayanamsa(jd) {
    var t = (jd - 2451545.0) / 365.25;
    return 23.85278 + t * (50.2884 / 3600) - t * t * (1.1e-8);
  }

  /* ---------- Kepler ---------- */
  function eccAnomaly(M, e) {
    M = norm360(M);
    var E = M + (e * DEG) * sin(M) * (1 + e * cos(M));
    for (var i = 0; i < 12; i++) {
      var dE = (E - (e * DEG) * sin(E) - M) / (1 - e * cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-9) break;
    }
    return E;
  }

  // orbital elements -> heliocentric ecliptic rectangular coords
  function orbit(el, d) {
    var N = el.N(d), i = el.i(d), w = el.w(d),
        a = el.a(d), e = el.e(d), M = norm360(el.M(d));
    var E = eccAnomaly(M, e);
    var xv = a * (cos(E) - e),
        yv = a * (Math.sqrt(1 - e * e) * sin(E));
    var v = norm360(Math.atan2(yv, xv) * DEG);
    var r = Math.sqrt(xv * xv + yv * yv);
    var vw = v + w;
    return {
      x: r * (cos(N) * cos(vw) - sin(N) * sin(vw) * cos(i)),
      y: r * (sin(N) * cos(vw) + cos(N) * sin(vw) * cos(i)),
      z: r * sin(vw) * sin(i),
      r: r, v: v, N: N, w: w, i: i, M: M
    };
  }

  var EL = {
    sun: { N: function () { return 0; }, i: function () { return 0; },
           w: function (d) { return 282.9404 + 4.70935e-5 * d; },
           a: function () { return 1.000000; },
           e: function (d) { return 0.016709 - 1.151e-9 * d; },
           M: function (d) { return 356.0470 + 0.9856002585 * d; } },
    moon: { N: function (d) { return 125.1228 - 0.0529538083 * d; },
            i: function () { return 5.1454; },
            w: function (d) { return 318.0634 + 0.1643573223 * d; },
            a: function () { return 60.2666; },
            e: function () { return 0.054900; },
            M: function (d) { return 115.3654 + 13.0649929509 * d; } },
    mercury: { N: function (d) { return 48.3313 + 3.24587e-5 * d; },
               i: function (d) { return 7.0047 + 5.00e-8 * d; },
               w: function (d) { return 29.1241 + 1.01444e-5 * d; },
               a: function () { return 0.387098; },
               e: function (d) { return 0.205635 + 5.59e-10 * d; },
               M: function (d) { return 168.6562 + 4.0923344368 * d; } },
    venus: { N: function (d) { return 76.6799 + 2.46590e-5 * d; },
             i: function (d) { return 3.3946 + 2.75e-8 * d; },
             w: function (d) { return 54.8910 + 1.38374e-5 * d; },
             a: function () { return 0.723330; },
             e: function (d) { return 0.006773 - 1.302e-9 * d; },
             M: function (d) { return 48.0052 + 1.6021302244 * d; } },
    mars: { N: function (d) { return 49.5574 + 2.11081e-5 * d; },
            i: function (d) { return 1.8497 - 1.78e-8 * d; },
            w: function (d) { return 286.5016 + 2.92961e-5 * d; },
            a: function () { return 1.523688; },
            e: function (d) { return 0.093405 + 2.516e-9 * d; },
            M: function (d) { return 18.6021 + 0.5240207766 * d; } },
    jupiter: { N: function (d) { return 100.4542 + 2.76854e-5 * d; },
               i: function (d) { return 1.3030 - 1.557e-7 * d; },
               w: function (d) { return 273.8777 + 1.64505e-5 * d; },
               a: function () { return 5.20256; },
               e: function (d) { return 0.048498 + 4.469e-9 * d; },
               M: function (d) { return 19.8950 + 0.0830853001 * d; } },
    saturn: { N: function (d) { return 113.6634 + 2.38980e-5 * d; },
              i: function (d) { return 2.4886 - 1.081e-7 * d; },
              w: function (d) { return 339.3939 + 2.97661e-5 * d; },
              a: function () { return 9.55475; },
              e: function (d) { return 0.055546 - 9.499e-9 * d; },
              M: function (d) { return 316.9670 + 0.0334442282 * d; } }
  };

  /* ---------- tropical geocentric longitudes ---------- */
  function tropicalPositions(jd) {
    var d = dayNumber(jd);

    var s = orbit(EL.sun, d);
    var sunLon = norm360(s.v + EL.sun.w(d));
    var xs = s.r * cos(sunLon), ys = s.r * sin(sunLon);
    var Ms = norm360(EL.sun.M(d)), ws = EL.sun.w(d);

    // --- Moon with the principal perturbations ---
    var mo = orbit(EL.moon, d);
    var Mm = norm360(EL.moon.M(d)), Nm = EL.moon.N(d), wm = EL.moon.w(d);
    var moonLon = norm360(Math.atan2(mo.y, mo.x) * DEG);
    var moonLat = Math.atan2(mo.z, Math.sqrt(mo.x * mo.x + mo.y * mo.y)) * DEG;
    var Ls = norm360(Ms + ws), Lm = norm360(Mm + wm + Nm);
    var D = norm360(Lm - Ls), F = norm360(Lm - Nm);

    moonLon += -1.274 * sin(Mm - 2 * D) + 0.658 * sin(2 * D) - 0.186 * sin(Ms)
             - 0.059 * sin(2 * Mm - 2 * D) - 0.057 * sin(Mm - 2 * D + Ms)
             + 0.053 * sin(Mm + 2 * D) + 0.046 * sin(2 * D - Ms)
             + 0.041 * sin(Mm - Ms) - 0.035 * sin(D) - 0.031 * sin(Mm + Ms)
             - 0.015 * sin(2 * F - 2 * D) + 0.011 * sin(Mm - 4 * D);
    moonLat += -0.173 * sin(F - 2 * D) - 0.055 * sin(Mm - F - 2 * D)
             - 0.046 * sin(Mm + F - 2 * D) + 0.033 * sin(F + 2 * D)
             + 0.017 * sin(2 * Mm + F);

    function geo(name) {
      var o = orbit(EL[name], d);
      var xg = o.x + xs, yg = o.y + ys, zg = o.z;
      return {
        lon: norm360(Math.atan2(yg, xg) * DEG),
        lat: Math.atan2(zg, Math.sqrt(xg * xg + yg * yg)) * DEG,
        dist: Math.sqrt(xg * xg + yg * yg + zg * zg),
        helio: o
      };
    }

    var me = geo('mercury'), ve = geo('venus'), ma = geo('mars'),
        ju = geo('jupiter'), sa = geo('saturn');

    // great inequality of Jupiter & Saturn
    var Mj = norm360(EL.jupiter.M(d)), Msa = norm360(EL.saturn.M(d));
    ju.lon += -0.332 * sin(2 * Mj - 5 * Msa - 67.6) - 0.056 * sin(2 * Mj - 2 * Msa + 21)
            + 0.042 * sin(3 * Mj - 5 * Msa + 21) - 0.036 * sin(Mj - 2 * Msa)
            + 0.022 * cos(Mj - Msa) + 0.023 * sin(2 * Mj - 3 * Msa + 52)
            - 0.016 * sin(Mj - 5 * Msa - 69);
    sa.lon += 0.812 * sin(2 * Mj - 5 * Msa - 67.6) - 0.229 * cos(2 * Mj - 4 * Msa - 2)
            + 0.119 * sin(Mj - 2 * Msa - 3) + 0.046 * sin(2 * Mj - 6 * Msa - 69)
            + 0.014 * sin(Mj - 3 * Msa + 32);

    // Mean lunar node — Rahu is always retrograde
    var rahu = norm360(125.0445479 - 0.0529539 * (jd - 2451545.0));

    return {
      Sun: { lon: sunLon, lat: 0, speed: 0.9856 },
      Moon: { lon: norm360(moonLon), lat: moonLat, speed: 13.176 },
      Mercury: { lon: norm360(me.lon), lat: me.lat },
      Venus: { lon: norm360(ve.lon), lat: ve.lat },
      Mars: { lon: norm360(ma.lon), lat: ma.lat },
      Jupiter: { lon: norm360(ju.lon), lat: ju.lat },
      Saturn: { lon: norm360(sa.lon), lat: sa.lat },
      Rahu: { lon: rahu, lat: 0, retro: true },
      Ketu: { lon: norm360(rahu + 180), lat: 0, retro: true },
      _sidereal: { Ls: Ls }
    };
  }

  // Retrograde detection: compare longitude a day either side
  function isRetrograde(name, jd) {
    if (name === 'Sun' || name === 'Moon') return false;
    if (name === 'Rahu' || name === 'Ketu') return true;
    var a = tropicalPositions(jd - 0.5)[name].lon;
    var b = tropicalPositions(jd + 0.5)[name].lon;
    return norm180(b - a) < 0;
  }

  /* ---------- sidereal positions ---------- */
  var PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

  function siderealPositions(jd) {
    var trop = tropicalPositions(jd), ay = ayanamsa(jd), out = {};
    PLANETS.forEach(function (p) {
      out[p] = {
        lon: norm360(trop[p].lon - ay),
        lat: trop[p].lat || 0,
        retro: isRetrograde(p, jd)
      };
    });
    out._ayanamsa = ay;
    out._tropical = trop;
    return out;
  }

  /* ---------- ascendant & houses ---------- */

  // Greenwich Mean Sidereal Time in degrees
  function gmstDeg(jd) {
    var T = (jd - 2451545.0) / 36525;
    var g = 280.46061837 + 360.98564736629 * (jd - 2451545.0)
          + 0.000387933 * T * T - T * T * T / 38710000;
    return norm360(g);
  }

  // Sidereal ascendant + midheaven for a place
  function ascendant(jd, lat, lon) {
    var eps = obliquity(jd);
    var lst = norm360(gmstDeg(jd) + lon);          // local sidereal time (deg) = RAMC
    var ramc = lst;
    var ascT = norm360(Math.atan2(
      cos(ramc),
      -(sin(ramc) * cos(eps) + tan(lat) * sin(eps))
    ) * DEG);
    var mcT = norm360(Math.atan2(sin(ramc), cos(ramc) * cos(eps)) * DEG);
    var ay = ayanamsa(jd);
    return {
      asc: norm360(ascT - ay),
      mc: norm360(mcT - ay),
      ascTropical: ascT,
      lst: lst / 15
    };
  }

  /* ---------- rashi / nakshatra ---------- */

  var RASHI = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
               'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'];
  var RASHI_EN = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
                  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  var RASHI_HI = ['मेष', 'वृषभ', 'मिथुन', 'कर्क', 'सिंह', 'कन्या',
                  'तुला', 'वृश्चिक', 'धनु', 'मकर', 'कुम्भ', 'मीन'];
  var RASHI_LORD = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
                    'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];

  var NAKSHATRA = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
    'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
    'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula',
    'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
    'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
  var NAKSHATRA_HI = ['अश्विनी', 'भरणी', 'कृत्तिका', 'रोहिणी', 'मृगशिरा', 'आर्द्रा',
    'पुनर्वसु', 'पुष्य', 'आश्लेषा', 'मघा', 'पूर्वा फाल्गुनी', 'उत्तरा फाल्गुनी',
    'हस्त', 'चित्रा', 'स्वाति', 'विशाखा', 'अनुराधा', 'ज्येष्ठा', 'मूल',
    'पूर्वाषाढ़ा', 'उत्तराषाढ़ा', 'श्रवण', 'धनिष्ठा', 'शतभिषा',
    'पूर्व भाद्रपद', 'उत्तर भाद्रपद', 'रेवती'];

  var DASHA_ORDER = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
  var DASHA_YEARS = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };

  function rashiOf(lon) { return Math.floor(norm360(lon) / 30); }
  function degInRashi(lon) { return norm360(lon) % 30; }

  function nakshatraOf(lon) {
    var span = 360 / 27;
    var idx = Math.floor(norm360(lon) / span);
    var within = norm360(lon) - idx * span;
    return {
      index: idx,
      name: NAKSHATRA[idx],
      hindi: NAKSHATRA_HI[idx],
      pada: Math.floor(within / (span / 4)) + 1,
      lord: DASHA_ORDER[idx % 9],
      fraction: within / span
    };
  }

  // Navamsa (D9) longitude
  function navamsaLon(lon) {
    var l = norm360(lon);
    var sign = Math.floor(l / 30), within = l % 30;
    var part = Math.floor(within / (30 / 9));
    var start;                       // movable/fixed/dual starting rule
    var mod = sign % 3;
    if (mod === 0) start = sign;            // chara: from itself
    else if (mod === 1) start = (sign + 8) % 12;  // sthira: from 9th
    else start = (sign + 4) % 12;                 // dwiswabhava: from 5th
    return ((start + part) % 12) * 30 + (within % (30 / 9)) * 9;
  }

  /* ---------- Vimshottari dasha ---------- */
  var YEAR_DAYS = 365.2425;

  function vimshottari(moonLon, jd, levels) {
    levels = levels || 3;
    var nk = nakshatraOf(moonLon);
    var startIdx = DASHA_ORDER.indexOf(nk.lord);
    var elapsed = nk.fraction * DASHA_YEARS[nk.lord];
    var cursor = jd - elapsed * YEAR_DAYS;
    var list = [];
    for (var i = 0; i < 9; i++) {
      var lord = DASHA_ORDER[(startIdx + i) % 9];
      var yrs = DASHA_YEARS[lord];
      var start = cursor, end = cursor + yrs * YEAR_DAYS;
      var node = { lord: lord, years: yrs, startJD: start, endJD: end, level: 1 };
      if (levels > 1) node.children = subPeriods(lord, start, yrs, 2, levels);
      list.push(node);
      cursor = end;
    }
    return list;
  }

  function subPeriods(mahaLord, startJD, mahaYears, level, maxLevel) {
    var idx = DASHA_ORDER.indexOf(mahaLord), out = [], cursor = startJD;
    for (var i = 0; i < 9; i++) {
      var lord = DASHA_ORDER[(idx + i) % 9];
      var yrs = mahaYears * DASHA_YEARS[lord] / 120;
      var node = { lord: lord, years: yrs, startJD: cursor, endJD: cursor + yrs * YEAR_DAYS, level: level };
      if (level < maxLevel) node.children = subPeriods(lord, cursor, yrs, level + 1, maxLevel);
      out.push(node);
      cursor = node.endJD;
    }
    return out;
  }

  function currentDasha(tree, jd) {
    var chain = [], list = tree;
    while (list && list.length) {
      var found = null;
      for (var i = 0; i < list.length; i++) {
        if (jd >= list[i].startJD && jd < list[i].endJD) { found = list[i]; break; }
      }
      if (!found) break;
      chain.push(found);
      list = found.children;
    }
    return chain;
  }

  /* ---------- panchang ---------- */
  var TITHI = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi',
    'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi',
    'Trayodashi', 'Chaturdashi', 'Purnima/Amavasya'];
  var YOGA = ['Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda',
    'Sukarma', 'Dhriti', 'Shula', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana',
    'Vajra', 'Siddhi', 'Vyatipata', 'Variyana', 'Parigha', 'Shiva', 'Siddha', 'Sadhya',
    'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti'];
  var KARANA = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti'];
  var VARA = ['Ravivar', 'Somvar', 'Mangalvar', 'Budhvar', 'Guruvar', 'Shukravar', 'Shanivar'];
  var VARA_HI = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
  var VARA_LORD = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

  function panchang(jd, tz) {
    var p = siderealPositions(jd);
    var diff = norm360(p.Moon.lon - p.Sun.lon);
    var tIdx = Math.floor(diff / 12);
    var paksha = tIdx < 15 ? 'Shukla' : 'Krishna';
    var tName = TITHI[tIdx % 15];
    if (tIdx === 14) tName = 'Purnima';
    if (tIdx === 29) tName = 'Amavasya';

    var yogaIdx = Math.floor(norm360(p.Sun.lon + p.Moon.lon) / (360 / 27));
    var kIdx = Math.floor(diff / 6);
    var karana;
    if (kIdx === 0) karana = 'Kimstughna';
    else if (kIdx >= 57) karana = ['Shakuni', 'Chatushpada', 'Naga'][kIdx - 57] || 'Naga';
    else karana = KARANA[(kIdx - 1) % 7];

    // vara from the local civil day: JD 2451545.0 (2000-01-01 12:00 UT) was a Saturday
    var wd = ((Math.floor(jd + 1.5 + tz / 24) % 7) + 7) % 7;   // 0 = Sunday
    return {
      tithi: tName, tithiIndex: tIdx + 1, paksha: paksha,
      nakshatra: nakshatraOf(p.Moon.lon),
      yoga: YOGA[yogaIdx], karana: karana,
      vara: VARA[wd], varaHindi: VARA_HI[wd], varaLord: VARA_LORD[wd],
      moonRashi: rashiOf(p.Moon.lon), sunRashi: rashiOf(p.Sun.lon),
      positions: p
    };
  }

  /* ---------- dignity, aspects, strength ---------- */
  var EXALT = { Sun: 10, Moon: 33, Mars: 298, Mercury: 165, Jupiter: 95, Venus: 357, Saturn: 200, Rahu: 50, Ketu: 230 };
  var OWN = { Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10], Rahu: [10], Ketu: [7] };
  var FRIENDS = {
    Sun: ['Moon', 'Mars', 'Jupiter'], Moon: ['Sun', 'Mercury'],
    Mars: ['Sun', 'Moon', 'Jupiter'], Mercury: ['Sun', 'Venus'],
    Jupiter: ['Sun', 'Moon', 'Mars'], Venus: ['Mercury', 'Saturn'],
    Saturn: ['Mercury', 'Venus'], Rahu: ['Venus', 'Saturn'], Ketu: ['Mars', 'Jupiter']
  };
  var ENEMIES = {
    Sun: ['Venus', 'Saturn'], Moon: [], Mars: ['Mercury'],
    Mercury: ['Moon'], Jupiter: ['Mercury', 'Venus'], Venus: ['Sun', 'Moon'],
    Saturn: ['Sun', 'Moon', 'Mars'], Rahu: ['Sun', 'Moon', 'Mars'], Ketu: ['Sun', 'Moon']
  };

  function dignity(planet, lon) {
    var sign = rashiOf(lon);
    var ex = EXALT[planet];
    if (ex !== undefined) {
      if (Math.abs(norm180(lon - ex)) < 10) return { key: 'exalted', label: 'Uchcha (exalted)', score: 5 };
      if (Math.abs(norm180(lon - (ex + 180))) < 10) return { key: 'debilitated', label: 'Neecha (debilitated)', score: -4 };
    }
    if ((OWN[planet] || []).indexOf(sign) >= 0) return { key: 'own', label: 'Swakshetra (own sign)', score: 4 };
    var lord = RASHI_LORD[sign];
    if (lord === planet) return { key: 'own', label: 'Swakshetra (own sign)', score: 4 };
    if ((FRIENDS[planet] || []).indexOf(lord) >= 0) return { key: 'friend', label: 'Mitra (friendly sign)', score: 2 };
    if ((ENEMIES[planet] || []).indexOf(lord) >= 0) return { key: 'enemy', label: 'Shatru (enemy sign)', score: -2 };
    return { key: 'neutral', label: 'Sama (neutral sign)', score: 0 };
  }

  // Graha drishti (whole-sign, Parashari)
  function aspectsFrom(planet, house) {
    var a = [7];
    if (planet === 'Mars') a = [4, 7, 8];
    else if (planet === 'Jupiter') a = [5, 7, 9];
    else if (planet === 'Saturn') a = [3, 7, 10];
    else if (planet === 'Rahu' || planet === 'Ketu') a = [5, 7, 9];
    return a.map(function (n) { return ((house - 1 + n - 1) % 12) + 1; });
  }

  var BENEFIC = ['Jupiter', 'Venus', 'Moon', 'Mercury'];

  /* ---------- full chart ---------- */
  function buildChart(birth) {
    var jd = toJD(birth.year, birth.month, birth.day, birth.hour, birth.minute, 0, birth.tz);
    var pos = siderealPositions(jd);
    var ac = ascendant(jd, birth.lat, birth.lon);
    var ascSign = rashiOf(ac.asc);

    var planets = PLANETS.map(function (name) {
      var lon = pos[name].lon;
      var sign = rashiOf(lon);
      var house = ((sign - ascSign + 12) % 12) + 1;
      var nk = nakshatraOf(lon);
      var dg = dignity(name, lon);
      return {
        name: name, lon: lon, sign: sign,
        signName: RASHI[sign], signEn: RASHI_EN[sign], signHi: RASHI_HI[sign],
        deg: degInRashi(lon), house: house, nakshatra: nk,
        dignity: dg, retro: pos[name].retro,
        navamsaSign: rashiOf(navamsaLon(lon)),
        aspects: aspectsFrom(name, house),
        benefic: BENEFIC.indexOf(name) >= 0
      };
    });

    var byHouse = {};
    for (var h = 1; h <= 12; h++) byHouse[h] = [];
    planets.forEach(function (p) { byHouse[p.house].push(p); });

    var moon = planets.find(function (p) { return p.name === 'Moon'; });
    var dashaTree = vimshottari(moon.lon, jd, 3);

    return {
      jd: jd, birth: birth,
      ayanamsa: pos._ayanamsa,
      ascendant: ac.asc, ascSign: ascSign,
      ascSignName: RASHI[ascSign], ascSignEn: RASHI_EN[ascSign], ascSignHi: RASHI_HI[ascSign],
      ascNakshatra: nakshatraOf(ac.asc),
      mc: ac.mc,
      planets: planets, byHouse: byHouse,
      moonSign: moon.sign, sunSign: rashiOf(pos.Sun.lon),
      janmaNakshatra: moon.nakshatra,
      dashaTree: dashaTree,
      panchang: panchang(jd, birth.tz)
    };
  }

  function formatDeg(d) {
    var deg = Math.floor(d), m = (d - deg) * 60, min = Math.floor(m),
        sec = Math.round((m - min) * 60);
    if (sec === 60) { sec = 0; min++; }
    if (min === 60) { min = 0; deg++; }
    return deg + '°' + String(min).padStart(2, '0') + "'" + String(sec).padStart(2, '0') + '"';
  }

  global.Astro = {
    toJD: toJD, jdToDate: jdToDate, ayanamsa: ayanamsa,
    siderealPositions: siderealPositions, tropicalPositions: tropicalPositions,
    ascendant: ascendant, buildChart: buildChart,
    nakshatraOf: nakshatraOf, rashiOf: rashiOf, degInRashi: degInRashi,
    navamsaLon: navamsaLon, vimshottari: vimshottari, currentDasha: currentDasha,
    panchang: panchang, dignity: dignity, aspectsFrom: aspectsFrom,
    formatDeg: formatDeg, norm360: norm360,
    RASHI: RASHI, RASHI_EN: RASHI_EN, RASHI_HI: RASHI_HI, RASHI_LORD: RASHI_LORD,
    NAKSHATRA: NAKSHATRA, NAKSHATRA_HI: NAKSHATRA_HI,
    PLANETS: PLANETS, DASHA_ORDER: DASHA_ORDER, DASHA_YEARS: DASHA_YEARS,
    YEAR_DAYS: YEAR_DAYS
  };
})(window);
