/* Report generator: turns raw chart + palm metrics into readable guidance. */
(function (g) {
  'use strict';
  var A = g.Astro, D = g.JyotishData, PD = g.PalmData;

  var TARA = [
    { n: 'Janma', e: 'Your own star — keep it low-key. Rest, do not launch.' },
    { n: 'Sampat', e: 'Wealth star — excellent for money matters, purchases and asking for things.' },
    { n: 'Vipat', e: 'Obstacle star — avoid travel, signing and confrontation today.' },
    { n: 'Kshema', e: 'Prosperity star — good for work, health and steady progress.' },
    { n: 'Pratyari', e: 'Friction star — expect resistance. Do routine work, not new ventures.' },
    { n: 'Sadhaka', e: 'Achievement star — the best day of the cycle to finish and deliver.' },
    { n: 'Vadha', e: 'Difficult star — postpone anything important; guard your health and temper.' },
    { n: 'Mitra', e: 'Friend star — favourable for people, meetings and negotiation.' },
    { n: 'Ati-Mitra', e: 'Best friend star — auspicious across the board.' }
  ];

  function taraBala(natalNakIndex, todayNakIndex) {
    var count = ((todayNakIndex - natalNakIndex + 27) % 27) + 1;
    return TARA[(count - 1) % 9];
  }

  function chandraBala(natalMoonSign, todayMoonSign) {
    var n = ((todayMoonSign - natalMoonSign + 12) % 12) + 1;
    var good = [1, 3, 6, 7, 10, 11];
    return {
      house: n,
      good: good.indexOf(n) >= 0,
      ashtama: n === 8,
      note: n === 8
        ? 'Chandrashtama — the Moon transits the 8th from your natal Moon. Classical advice: no launches, no confrontation, no travel if avoidable. Rest and finish old work.'
        : good.indexOf(n) >= 0
          ? 'Chandra bala is supportive — the mind is steady and the day cooperates with effort.'
          : 'Chandra bala is average — nothing blocked, but push gently rather than hard.'
    };
  }

  /* ---------- natal narrative ---------- */
  function natalReport(chart) {
    var out = { sections: [] };

    var lagnaTrait = D.RASHI_TRAITS[chart.ascSign];
    var moonTrait = D.RASHI_TRAITS[chart.moonSign];
    var sunTrait = D.RASHI_TRAITS[chart.sunSign];
    var nak = D.NAK_TRAITS[chart.janmaNakshatra.index];

    out.core = {
      lagna: chart.ascSignEn + ' (' + chart.ascSignHi + ') — ' + lagnaTrait.d,
      moon: chart.planets.find(function (p) { return p.name === 'Moon'; }).signEn + ' — ' + moonTrait.d,
      sun: chart.planets.find(function (p) { return p.name === 'Sun'; }).signEn + ' — ' + sunTrait.d,
      nakshatra: chart.janmaNakshatra.name + ' pada ' + chart.janmaNakshatra.pada + ' — ' + nak.d
    };

    out.summary =
      'Your rising sign is ' + chart.ascSignEn + ', so the world meets you as ' +
      lagnaTrait.d.charAt(0).toLowerCase() + lagnaTrait.d.slice(1).replace(/\.$/, '') + '. ' +
      'Inside, the Moon in ' + A.RASHI_EN[chart.moonSign] + ' runs your emotional weather: ' +
      moonTrait.d.replace(/\.$/, '') + '. ' +
      'The Sun in ' + A.RASHI_EN[chart.sunSign] + ' is the part of you that wants to matter — ' +
      sunTrait.d.replace(/\.$/, '') + '. ' +
      'Your janma nakshatra is ' + chart.janmaNakshatra.name + ', pada ' + chart.janmaNakshatra.pada +
      ', ruled by ' + chart.janmaNakshatra.lord + '. ' + nak.d;

    // planets
    out.planets = chart.planets.map(function (p) {
      var info = D.PLANET_INFO[p.name];
      return {
        name: p.name, hi: info.hi,
        placement: p.signEn + ' ' + A.formatDeg(p.deg) + (p.retro ? ' ℞' : ''),
        house: p.house,
        houseName: D.HOUSES[p.house].title,
        dignity: p.dignity.label,
        dignityKey: p.dignity.key,
        nakshatra: p.nakshatra.name + ' (' + p.nakshatra.lord + ') pada ' + p.nakshatra.pada,
        reading: D.PLANET_HOUSE[p.name][p.house],
        karaka: info.karaka,
        note: p.dignity.key === 'exalted'
          ? info.hi + ' is exalted here — ' + info.good + '. This is one of the real strengths of the chart.'
          : p.dignity.key === 'debilitated'
            ? info.hi + ' is debilitated — ' + info.weak + '. Classical texts add that debilitation in a kendra or with its dispositor strong produces Neecha-bhanga: the weakness converts into unusual strength after struggle.'
            : p.dignity.key === 'own'
              ? info.hi + ' is in its own sign — steady and dependable results in this area.'
              : ''
      };
    });

    // yogas
    out.yogas = D.YOGAS.filter(function (y) {
      try { return y.test(chart); } catch (e) { return false; }
    }).map(function (y) { return { name: y.name, text: y.text }; });

    // mangal dosha
    var mars = chart.planets.find(function (p) { return p.name === 'Mars'; });
    out.mangal = {
      present: D.MANGAL_HOUSES.indexOf(mars.house) >= 0,
      house: mars.house,
      note: D.MANGAL_HOUSES.indexOf(mars.house) >= 0
        ? 'Mars sits in house ' + mars.house + ', so the chart carries Mangal (Kuja) Dosha in the standard reckoning. In practice it describes intensity and friction in partnership rather than a verdict — it is considered cancelled when Mars is in its own or exalted sign, when Saturn or Jupiter aspects it, or when both partners carry it. Treat it as a note on temperament, not a disqualification.'
        : 'Mars is outside the Mangal Dosha houses (1, 2, 4, 7, 8, 12) — no Kuja Dosha in the standard reckoning.'
    };

    // sade sati (Saturn transiting 12th/1st/2nd from natal Moon)
    out.sadeSatiBase = chart.moonSign;

    // strongest / weakest
    var scored = chart.planets.slice().sort(function (a, b) {
      return (b.dignity.score + kendraBonus(b)) - (a.dignity.score + kendraBonus(a));
    });
    out.strongest = scored[0];
    out.weakest = scored[scored.length - 1];

    // house occupancy
    out.houses = [];
    for (var h = 1; h <= 12; h++) {
      out.houses.push({
        num: h, meta: D.HOUSES[h],
        sign: A.RASHI_EN[(chart.ascSign + h - 1) % 12],
        signHi: A.RASHI_HI[(chart.ascSign + h - 1) % 12],
        lord: A.RASHI_LORD[(chart.ascSign + h - 1) % 12],
        planets: chart.byHouse[h].map(function (p) { return p.name; }),
        aspectedBy: chart.planets.filter(function (p) { return p.aspects.indexOf(h) >= 0; })
                                 .map(function (p) { return p.name; })
      });
    }
    return out;
  }

  function kendraBonus(p) {
    if ([1, 4, 7, 10].indexOf(p.house) >= 0) return 2;
    if ([5, 9].indexOf(p.house) >= 0) return 2.5;
    if ([6, 8, 12].indexOf(p.house) >= 0) return -2;
    return 0;
  }

  /* ---------- dasha narrative ---------- */
  function dashaReport(chart, jdNow) {
    var chain = A.currentDasha(chart.dashaTree, jdNow);
    if (!chain.length) return null;
    var maha = chain[0], antar = chain[1], pratyantar = chain[2];
    var mahaPlanet = chart.planets.find(function (p) { return p.name === maha.lord; });
    var antarPlanet = antar && chart.planets.find(function (p) { return p.name === antar.lord; });

    function combine(a, b) {
      if (!a || !b) return '';
      var relation = ((b.house - a.house + 12) % 12) + 1;
      var tone = [1, 4, 5, 7, 9, 10, 11].indexOf(relation) >= 0 ? 'supportive' : 'testing';
      return 'The antardasha lord ' + b.name + ' sits ' + relation + ' houses from the mahadasha lord ' +
             a.name + ', which makes this sub-period ' + tone + '. ' +
             'Concretely: ' + D.HOUSES[b.house].title.toLowerCase() + ' is where the action is right now.';
    }

    return {
      chain: chain.map(function (c, i) {
        return {
          level: ['Mahadasha', 'Antardasha', 'Pratyantar'][i],
          lord: c.lord,
          hi: D.PLANET_INFO[c.lord].hi,
          from: A.jdToDate(c.startJD), to: A.jdToDate(c.endJD),
          years: c.years,
          remainingYears: (c.endJD - jdNow) / A.YEAR_DAYS
        };
      }),
      mahaEffect: D.DASHA_EFFECT[maha.lord],
      mahaPlacement: mahaPlanet
        ? maha.lord + ' in your chart is in ' + mahaPlanet.signEn + ', house ' + mahaPlanet.house +
          ' (' + D.HOUSES[mahaPlanet.house].title + '), ' + mahaPlanet.dignity.label +
          '. That is where this ' + Math.round(maha.years) + '-year period does its work.'
        : '',
      antarEffect: antar ? D.DASHA_EFFECT[antar.lord] : '',
      interplay: combine(mahaPlanet, antarPlanet),
      remedy: D.PLANET_INFO[maha.lord].remedy,
      mantra: D.PLANET_INFO[maha.lord].mantra,
      day: D.PLANET_INFO[maha.lord].day,
      upcoming: upcomingChanges(chart.dashaTree, jdNow, 5)
    };
  }

  function upcomingChanges(tree, jdNow, n) {
    var events = [];
    tree.forEach(function (m) {
      if (m.startJD > jdNow) events.push({ level: 'Mahadasha', lord: m.lord, jd: m.startJD });
      (m.children || []).forEach(function (a) {
        if (a.startJD > jdNow) events.push({ level: 'Antardasha', lord: m.lord + '/' + a.lord, jd: a.startJD });
      });
    });
    events.sort(function (a, b) { return a.jd - b.jd; });
    return events.slice(0, n).map(function (e) {
      return { level: e.level, lord: e.lord, date: A.jdToDate(e.jd),
               inYears: (e.jd - jdNow) / A.YEAR_DAYS };
    });
  }

  /* ---------- daily / transit ---------- */
  function dailyReport(chart, jdNow, tz) {
    var pan = A.panchang(jdNow, tz);
    var pos = pan.positions;
    var tara = taraBala(chart.janmaNakshatra.index, pan.nakshatra.index);
    var cbala = chandraBala(chart.moonSign, pan.moonRashi);

    // gochar: transiting planets relative to natal Moon (Chandra lagna)
    var gochar = A.PLANETS.map(function (name) {
      var sign = A.rashiOf(pos[name].lon);
      var fromMoon = ((sign - chart.moonSign + 12) % 12) + 1;
      var fromLagna = ((sign - chart.ascSign + 12) % 12) + 1;
      return {
        name: name, sign: A.RASHI_EN[sign], deg: A.formatDeg(A.degInRashi(pos[name].lon)),
        retro: pos[name].retro, fromMoon: fromMoon, fromLagna: fromLagna,
        favourable: favourableTransit(name, fromMoon)
      };
    });

    // Sade Sati / Dhaiya
    var satSign = A.rashiOf(pos.Saturn.lon);
    var satFromMoon = ((satSign - chart.moonSign + 12) % 12) + 1;
    var sade = null;
    if ([12, 1, 2].indexOf(satFromMoon) >= 0) {
      sade = {
        phase: satFromMoon === 12 ? 'Rising phase (1st dhaiya)'
             : satFromMoon === 1 ? 'Peak phase (2nd dhaiya)' : 'Setting phase (3rd dhaiya)',
        note: 'Saturn is transiting the ' + satFromMoon + (satFromMoon === 1 ? 'st' : satFromMoon === 2 ? 'nd' : 'th') +
              ' from your natal Moon — you are in Sade Sati. It is not a curse; it is an audit. ' +
              'Whatever in your life is built on pretence gets expensive, and whatever is built on real work gets permanent. ' +
              'Keep commitments small and keep every one of them.'
      };
    } else if ([4, 8].indexOf(satFromMoon) >= 0) {
      sade = {
        phase: satFromMoon === 4 ? 'Kantak Shani (small panoti)' : 'Ashtama Shani',
        note: 'Saturn is in the ' + satFromMoon + 'th from your Moon — a two-and-a-half year dhaiya. Expect friction around ' +
              (satFromMoon === 4 ? 'home, property and peace of mind' : 'health, hidden obligations and sudden change') + '.'
      };
    }

    // Jupiter transit
    var jupSign = A.rashiOf(pos.Jupiter.lon);
    var jupFromMoon = ((jupSign - chart.moonSign + 12) % 12) + 1;
    var jupNote = [2, 5, 7, 9, 11].indexOf(jupFromMoon) >= 0
      ? 'Jupiter transits the ' + jupFromMoon + 'th from your Moon — a genuinely supportive year for growth, learning and money.'
      : 'Jupiter transits the ' + jupFromMoon + 'th from your Moon — protective but not expansive right now; consolidate rather than expand.';

    var score = 50;
    score += cbala.good ? 12 : cbala.ashtama ? -22 : 0;
    score += [1, 3, 5, 7, 8].indexOf(TARA.indexOf(tara)) >= 0 ? 10 : -6;
    gochar.forEach(function (t) { score += t.favourable ? 3 : -2; });
    if (sade && sade.phase.indexOf('Peak') >= 0) score -= 8;
    score = Math.max(5, Math.min(97, Math.round(score)));

    var lord = pan.varaLord;
    return {
      panchang: pan,
      tara: tara, chandraBala: cbala, gochar: gochar,
      sadeSati: sade, jupiterNote: jupNote,
      score: score,
      dayLord: lord,
      dayLordNote: 'Today is ' + pan.varaHindi + ', ruled by ' + D.PLANET_INFO[lord].hi + ' (' + lord +
                   '). Favours: ' + D.PLANET_INFO[lord].karaka + '.',
      advice: dayAdvice(score, cbala, tara),
      luckyColor: LUCKY_COLOR[lord], luckyNumber: LUCKY_NUM[lord],
      mantra: D.PLANET_INFO[lord].mantra,
      auspicious: !cbala.ashtama && score > 55
    };
  }

  var LUCKY_COLOR = { Sun: 'Deep orange / copper', Moon: 'White / silver', Mars: 'Red', Mercury: 'Green',
                      Jupiter: 'Yellow / gold', Venus: 'White / pastel', Saturn: 'Dark blue / black' };
  var LUCKY_NUM = { Sun: 1, Moon: 2, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 6, Saturn: 8 };

  function favourableTransit(name, fromMoon) {
    var map = {
      Sun: [3, 6, 10, 11], Moon: [1, 3, 6, 7, 10, 11], Mars: [3, 6, 11],
      Mercury: [2, 4, 6, 8, 10, 11], Jupiter: [2, 5, 7, 9, 11],
      Venus: [1, 2, 3, 4, 5, 8, 9, 11, 12], Saturn: [3, 6, 11],
      Rahu: [3, 6, 10, 11], Ketu: [3, 6, 11]
    };
    return (map[name] || []).indexOf(fromMoon) >= 0;
  }

  function dayAdvice(score, cbala, tara) {
    if (cbala.ashtama) return 'Chandrashtama. Do not start, sign or confront today. Close old loops, sleep early.';
    if (score >= 78) return 'A strong day. Put your most important conversation or decision here — the timing supports you. ' + tara.e;
    if (score >= 60) return 'A workable day with a clear tailwind for steady effort. ' + tara.e;
    if (score >= 42) return 'A neutral day. Nothing is blocked, but nothing carries you either — push with your own effort. ' + tara.e;
    return 'A resistant day. Keep to routine work, avoid new commitments and let arguments pass. ' + tara.e;
  }

  /* ---------- palm narrative ---------- */
  function palmReport(res) {
    if (!res.ok) return res;
    var lines = [], L = res.lines;

    function band(m) {
      if (m.score >= 66) return 'strong';
      if (m.score >= 40) return 'medium';
      return 'faint';
    }

    ['life', 'head', 'heart', 'fate', 'sun', 'mercury', 'girdle'].forEach(function (key) {
      var m = L[key], info = PD.LINE_INFO[key], b = band(m);
      var text = PD.LINE_READ[key][b];
      var extra = [];
      if (m.breaks >= 2 && m.coverage > 0.25) extra.push(PD.LINE_READ[key].broken);
      if (key === 'head' && m.straightness < 0.55 && m.coverage > 0.3)
        extra.push('The head line curves down towards the Luna mount — imagination leads your reasoning. You solve problems by picturing them, not by listing them.');
      if (key === 'life' && m.trace) {
        var far = m.trace.filter(function (t) { return t.hit && t.off < -0.02; }).length;
        if (far > m.trace.length * 0.35)
          extra.push('The line sweeps wide of the thumb, enlarging the Venus mount — generous energy, strong family pull, and a real appetite for physical life.');
      }
      lines.push({
        key: key, name: info.name, hi: info.hi, sk: info.sk, about: info.about,
        strength: b, score: m.score,
        depth: Math.round(m.depth * 100), clarity: Math.round(m.clarity * 100),
        continuity: Math.round(m.continuity * 100), breaks: m.breaks,
        text: text, extra: extra
      });
    });

    var mCount = L.marriage.count || 0;
    lines.push({
      key: 'marriage', name: PD.LINE_INFO.marriage.name, hi: PD.LINE_INFO.marriage.hi,
      sk: PD.LINE_INFO.marriage.sk, about: PD.LINE_INFO.marriage.about,
      strength: mCount >= 2 ? 'strong' : mCount === 1 ? 'medium' : 'faint',
      score: Math.min(100, mCount * 33 + Math.round(L.marriage.score * 0.4)),
      depth: Math.round(L.marriage.depth * 100), clarity: Math.round(L.marriage.clarity * 100),
      continuity: Math.round(L.marriage.continuity * 100), breaks: L.marriage.breaks,
      text: mCount === 0
        ? 'No clearly readable relationship line at this resolution. Either the marks are fine (a private, slow-forming attachment) or the edge of the palm was cut off in the frame — retake with the little-finger edge fully visible.'
        : mCount === 1
          ? 'One clear relationship line — a single defining bond rather than several. Depth here matters more than count: a deep single line is the classical marker of a long partnership.'
          : mCount + ' distinct relationship lines — more than one significant attachment in the life, or one relationship that goes through a decisive break and reforms.',
      extra: []
    });

    var mounts = Object.keys(PD.MOUNT_READ).map(function (k) {
      var m = res.mounts[k], meta = PD.MOUNT_READ[k];
      var b = m.level >= 62 ? 'high' : m.level >= 38 ? 'norm' : 'low';
      return { key: k, name: meta.name, hi: meta.hi, pos: meta.pos, level: m.level, band: b, text: meta[b] };
    });

    var dominant = mounts.slice().sort(function (a, b) { return b.level - a.level; })[0];
    var strongestLine = lines.slice().sort(function (a, b) { return b.score - a.score; })[0];

    return {
      ok: true, hand: res.hand, quality: res.quality, preview: res.preview,
      lines: lines, mounts: mounts,
      dominantMount: dominant, strongestLine: strongestLine,
      summary: 'On your ' + res.hand + ' palm the clearest mark is the ' + strongestLine.name.toLowerCase() +
        ' (' + strongestLine.score + '/100), and the most developed mount is the ' + dominant.name +
        '. ' + strongestLine.text.split('.')[0] + '. ' + dominant.text,
      confidence: Math.round(Math.min(100,
        (res.quality.focus > 120 ? 40 : res.quality.focus / 3) +
        (res.quality.skinRatio > 0.3 ? 30 : res.quality.skinRatio * 100) +
        (res.quality.issues.length === 0 ? 30 : Math.max(0, 30 - res.quality.issues.length * 12))))
    };
  }

  /* ---------- fusion: palm + chart ---------- */
  function fusion(chart, natal, palm) {
    if (!palm || !palm.ok) return null;
    var out = [];
    function line(k) { return palm.lines.find(function (l) { return l.key === k; }); }
    function planet(n) { return chart.planets.find(function (p) { return p.name === n; }); }

    var head = line('head'), heart = line('heart'), fate = line('fate'),
        life = line('life'), sun = line('sun');
    var me = planet('Mercury'), mo = planet('Moon'), sa = planet('Saturn'),
        su = planet('Sun'), ve = planet('Venus'), ma = planet('Mars');

    out.push({
      title: 'Mind — head line vs Mercury & Moon',
      text: 'Your head line reads ' + head.strength + ' (' + head.score + '/100). In the chart, Mercury sits in ' +
        me.signEn + ' house ' + me.house + ' (' + me.dignity.label + ') and the Moon in ' + mo.signEn +
        ' house ' + mo.house + '. ' +
        (head.score >= 60 && me.dignity.score >= 2
          ? 'Both agree: sustained analytical capacity. Long-form work is your advantage — use it instead of chasing quick tasks.'
          : head.score < 40 && me.dignity.score < 0
            ? 'Both agree: your mind works in bursts, not marathons. Build your schedule around short deep sessions rather than fighting your own wiring.'
            : 'The two disagree, which is itself informative: the hand shows how you actually work day to day, the chart shows what you are capable of when conditions are right. Close that gap with structure, not willpower.')
    });

    out.push({
      title: 'Heart — heart line vs Venus & 7th house',
      text: 'The heart line reads ' + heart.strength + '. Venus is in ' + ve.signEn + ' house ' + ve.house +
        ', and the 7th house of partnership holds ' +
        (chart.byHouse[7].length ? chart.byHouse[7].map(function (p) { return p.name; }).join(', ') : 'no planets') +
        '. ' + (heart.score >= 60
          ? 'A deep heart line with this Venus says you attach strongly and slowly, and you do not recover quickly from a break — which is also why your long relationships last.'
          : 'A finer heart line with this Venus says you keep emotional life private. People close to you may not know how much you feel unless you tell them explicitly.')
    });

    out.push({
      title: 'Career — fate & sun line vs 10th house',
      text: 'Fate line ' + fate.score + '/100, sun line ' + sun.score + '/100. The 10th house (' +
        natal.houses[9].sign + ', lord ' + natal.houses[9].lord + ') holds ' +
        (chart.byHouse[10].length ? chart.byHouse[10].map(function (p) { return p.name; }).join(', ') : 'no planets') +
        '. ' + (fate.score >= 60
          ? 'A defined fate line plus this 10th house means a structured career path — you do well inside an institution or a long-running venture.'
          : 'A light fate line means the structure has to come from you. Self-employment, portfolio careers and unconventional routes suit this combination better than a fixed ladder.') +
        (sun.score >= 60 ? ' The sun line supports public recognition — do not hide your work.'
                         : ' The weak sun line is a nudge: your work is better than your visibility. Publish, present, put your name on things.')
    });

    out.push({
      title: 'Vitality — life line vs lagna lord & Saturn',
      text: 'Life line ' + life.score + '/100 with the ' + life.strength + ' band. Your lagna lord is ' +
        natal.houses[0].lord + ', and Saturn — the planet of endurance — sits in ' + sa.signEn +
        ' house ' + sa.house + ' (' + sa.dignity.label + '). ' +
        (life.score >= 60
          ? 'Good reserves. The risk in your case is not weakness, it is overconfidence in your own stamina.'
          : 'Modest reserves. Protect sleep and meals; this combination burns out quietly and then all at once.')
    });

    var dm = palm.dominantMount;
    var mountPlanet = { Jupiter: 'Jupiter', Saturn: 'Saturn', Sun: 'Sun', Mercury: 'Mercury',
                        Venus: 'Venus', Luna: 'Moon', UpperMars: 'Mars', LowerMars: 'Mars' }[dm.key];
    var mp = planet(mountPlanet);
    out.push({
      title: 'Dominant mount — ' + dm.name,
      text: dm.text + ' In the chart, ' + mountPlanet + ' is in ' + mp.signEn + ', house ' + mp.house +
        ', ' + mp.dignity.label + (mp.retro ? ', retrograde' : '') + '. ' +
        (mp.dignity.score >= 2
          ? 'The hand and the chart both point at ' + mountPlanet + ' — treat this as the strongest single signature in your reading, and build your choices around it.'
          : 'The hand emphasises ' + mountPlanet + ' more than the chart does. Classical practice reads the hand as the current life and the chart as the inheritance: this is a capacity you developed yourself rather than one you were given.')
    });

    return out;
  }

  g.Reading = {
    natalReport: natalReport, dashaReport: dashaReport, dailyReport: dailyReport,
    palmReport: palmReport, fusion: fusion, taraBala: taraBala, chandraBala: chandraBala
  };
})(window);
