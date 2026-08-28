/* Jyoti — UI layer. Everything is local: localStorage + canvas, no network. */
(function () {
  'use strict';
  var A = window.Astro, D = window.JyotishData, R = window.Reading, P = window.Palm;
  var KEY = 'jyoti.profile.v1', PALMKEY = 'jyoti.palm.v1';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }

  var state = { profile: null, chart: null, natal: null, palm: null, view: 'Today', stream: null };

  /* ---------------- storage ---------------- */
  function load() {
    try { state.profile = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { state.profile = null; }
    try { state.palm = JSON.parse(localStorage.getItem(PALMKEY) || 'null'); } catch (e) { state.palm = null; }
  }
  function save() {
    localStorage.setItem(KEY, JSON.stringify(state.profile));
    if (state.palm) localStorage.setItem(PALMKEY, JSON.stringify(state.palm));
  }
  function rebuild() {
    if (!state.profile) return;
    state.chart = A.buildChart(state.profile.birth);
    state.natal = R.natalReport(state.chart);
  }
  function nowJD() {
    var d = new Date(), tz = state.profile ? state.profile.birth.tz : -d.getTimezoneOffset() / 60;
    return A.toJD(d.getFullYear(), d.getMonth() + 1, d.getDate(),
                  d.getHours(), d.getMinutes(), d.getSeconds(), -d.getTimezoneOffset() / 60);
  }
  function localTZ() { return -new Date().getTimezoneOffset() / 60; }

  /* ---------------- navigation ---------------- */
  function show(v) {
    state.view = v;
    $$('.view').forEach(function (s) { s.classList.remove('on'); });
    var target = $('#v' + v);
    if (target) target.classList.add('on');
    $$('#tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === v); });
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'auto' : 'auto' });
    render(v);
  }

  function render(v) {
    if (!state.profile && v !== 'Setup') { $('#vSetup').classList.add('on'); $$('.view').forEach(function(s){ if(s.id!=='vSetup') s.classList.remove('on'); }); return; }
    if (v === 'Today') renderToday();
    else if (v === 'Kundli') renderKundli();
    else if (v === 'Dasha') renderDasha();
    else if (v === 'Palm') renderPalm();
    else if (v === 'Fusion') renderFusion();
    else if (v === 'More') renderMore();
  }

  /* ---------------- setup ---------------- */
  var pickedCity = null;

  function setupPlaceSearch() {
    var inp = $('#fPlace'), list = $('#placeList');
    function close() { list.hidden = true; list.innerHTML = ''; }
    inp.addEventListener('input', function () {
      var q = inp.value.trim().toLowerCase();
      pickedCity = null;
      if (q.length < 2) return close();
      var hits = window.CITIES.filter(function (c) {
        return c.name.toLowerCase().indexOf(q) === 0;
      }).concat(window.CITIES.filter(function (c) {
        return c.name.toLowerCase().indexOf(q) > 0 || c.state.toLowerCase().indexOf(q) === 0;
      })).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 25);
      if (!hits.length) return close();
      list.innerHTML = hits.map(function (c, i) {
        return '<div data-i="' + i + '">' + esc(c.name) + '<small>' + esc(c.state) +
               ' · ' + c.lat.toFixed(2) + ', ' + c.lon.toFixed(2) + ' · UTC' +
               (c.tz >= 0 ? '+' : '') + c.tz + '</small></div>';
      }).join('');
      list.hidden = false;
      $$('div', list).forEach(function (d) {
        d.addEventListener('click', function () {
          var c = hits[+d.dataset.i];
          pickedCity = c;
          inp.value = c.name + ', ' + c.state;
          $('#fLat').value = c.lat; $('#fLon').value = c.lon; $('#fTz').value = c.tz;
          close();
        });
      });
    });
    inp.addEventListener('blur', function () { setTimeout(close, 180); });
  }

  function fillSetup() {
    if (!state.profile) return;
    var b = state.profile.birth;
    $('#fName').value = state.profile.name || '';
    $('#fDate').value = [b.year, String(b.month).padStart(2, '0'), String(b.day).padStart(2, '0')].join('-');
    $('#fTime').value = String(b.hour).padStart(2, '0') + ':' + String(b.minute).padStart(2, '0');
    $('#fPlace').value = state.profile.place || '';
    $('#fLat').value = b.lat; $('#fLon').value = b.lon; $('#fTz').value = b.tz;
    $('#fHand').value = state.profile.hand || 'right';
  }

  function saveSetup() {
    var date = $('#fDate').value, time = $('#fTime').value;
    if (!date) return alert('जन्म तिथि डालें');
    if (!time) return alert('जन्म समय डालें (अनुमान भी चलेगा — बाद में सुधार सकते हैं)');
    var lat = parseFloat($('#fLat').value), lon = parseFloat($('#fLon').value), tz = parseFloat($('#fTz').value);
    if (pickedCity) { lat = pickedCity.lat; lon = pickedCity.lon; tz = pickedCity.tz; }
    if (isNaN(lat) || isNaN(lon) || isNaN(tz)) return alert('जन्म स्थान चुनें, या manual में lat/lon/timezone भरें');
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return alert('Latitude -90..90 और Longitude -180..180 होना चाहिए');

    var dp = date.split('-').map(Number), tp = time.split(':').map(Number);
    state.profile = {
      name: $('#fName').value.trim(),
      place: pickedCity ? pickedCity.name + ', ' + pickedCity.state : $('#fPlace').value.trim(),
      hand: $('#fHand').value,
      birth: { year: dp[0], month: dp[1], day: dp[2], hour: tp[0], minute: tp[1], lat: lat, lon: lon, tz: tz }
    };
    rebuild(); save();
    $('#palmHand').value = state.profile.hand;
    show('Today');
  }

  /* ---------------- TODAY ---------------- */
  function renderToday() {
    var jd = nowJD();
    var day = R.dailyReport(state.chart, jd, localTZ());
    var dash = R.dashaReport(state.chart, jd);
    var pan = day.panchang;
    var name = state.profile.name ? state.profile.name.split(' ')[0] : 'नमस्ते';
    var now = new Date();

    var h = '';
    h += '<div class="card">' +
      '<div class="bigscore">' +
        '<div class="ring" style="--v:' + day.score + '"><b>' + day.score + '</b><small>दिन<br>बल</small></div>' +
        '<div style="min-width:0"><h2 style="margin-bottom:4px">' + esc(name) + ', आज</h2>' +
        '<p class="sub" style="margin-bottom:8px">' + now.toLocaleDateString('hi-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '</p>' +
        '<div class="chips">' +
          '<span class="pill y">' + esc(pan.varaHindi) + '</span>' +
          '<span class="pill">' + esc(pan.paksha) + ' ' + esc(pan.tithi) + '</span>' +
          '<span class="pill b">' + esc(pan.nakshatra.hindi) + '</span>' +
        '</div></div></div>' +
      '<hr class="hr"><p>' + esc(day.advice) + '</p>' +
      '<p class="sub">' + esc(day.dayLordNote) + '</p>' +
      '<div class="gridkv mt"><b>शुभ रंग</b><span>' + esc(day.luckyColor) + '</span>' +
      '<b>शुभ अंक</b><span>' + day.luckyNumber + '</span>' +
      '<b>मंत्र</b><span>' + esc(day.mantra) + '</span></div>' +
    '</div>';

    if (day.chandraBala.ashtama) h += '<div class="warn">🌑 <b>चन्द्राष्टम</b> — ' + esc(day.chandraBala.note) + '</div>';
    else if (day.score >= 78) h += '<div class="ok">✨ आज का योग मज़बूत है — ज़रूरी काम आज ही निपटाएँ।</div>';

    h += '<div class="card"><h2><span class="ic">📿</span> तारा व चन्द्र बल</h2>' +
      '<div class="gridkv">' +
      '<b>तारा</b><span>' + esc(day.tara.n) + ' — ' + esc(day.tara.e) + '</span>' +
      '<b>चन्द्र बल</b><span>जन्म चन्द्र से ' + day.chandraBala.house + 'वाँ — ' + esc(day.chandraBala.note) + '</span>' +
      '</div></div>';

    if (dash) {
      h += '<div class="card"><h2><span class="ic">🕉️</span> चल रही दशा</h2>' +
        '<div class="chips">' + dash.chain.map(function (c) {
          return '<span class="pill ' + (c.level === 'Mahadasha' ? 'y' : c.level === 'Antardasha' ? 'p' : '') + '">' +
            esc(c.level) + ': ' + esc(c.lord) + ' (' + esc(c.hi) + ')</span>';
        }).join('') + '</div>' +
        '<p class="mt">' + esc(dash.mahaEffect) + '</p>' +
        (dash.interplay ? '<p class="sub">' + esc(dash.interplay) + '</p>' : '') +
        '<p class="sub"><b>उपाय:</b> ' + esc(dash.remedy) + '</p></div>';
    }

    if (day.sadeSati) {
      h += '<div class="card"><h2><span class="ic">🪐</span> शनि गोचर — ' + esc(day.sadeSati.phase) + '</h2>' +
        '<p>' + esc(day.sadeSati.note) + '</p></div>';
    }
    h += '<div class="card"><h2><span class="ic">🌟</span> बृहस्पति गोचर</h2><p>' + esc(day.jupiterNote) + '</p></div>';

    h += '<div class="card"><h2><span class="ic">🔭</span> आज का गोचर</h2><div class="wrapx"><table class="tbl">' +
      '<tr><th>ग्रह</th><th>राशि</th><th>अंश</th><th>चन्द्र से</th><th></th></tr>' +
      day.gochar.map(function (t) {
        return '<tr><td>' + esc(t.name) + (t.retro ? ' <span class="pill r" style="padding:0 5px">℞</span>' : '') +
          '</td><td>' + esc(t.sign) + '</td><td class="dimtxt">' + esc(t.deg) + '</td><td>' + t.fromMoon + '</td>' +
          '<td>' + (t.favourable ? '<span class="pill g">शुभ</span>' : '<span class="pill">सामान्य</span>') + '</td></tr>';
      }).join('') + '</table></div></div>';

    h += '<div class="card"><h2><span class="ic">📅</span> आज का पंचांग</h2><div class="gridkv">' +
      '<b>वार</b><span>' + esc(pan.varaHindi) + ' (' + esc(pan.vara) + ')</span>' +
      '<b>तिथि</b><span>' + esc(pan.paksha) + ' ' + esc(pan.tithi) + '</span>' +
      '<b>नक्षत्र</b><span>' + esc(pan.nakshatra.hindi) + ' / ' + esc(pan.nakshatra.name) + ' — पाद ' + pan.nakshatra.pada + '</span>' +
      '<b>योग</b><span>' + esc(pan.yoga) + '</span>' +
      '<b>करण</b><span>' + esc(pan.karana) + '</span>' +
      '<b>चन्द्र राशि</b><span>' + esc(A.RASHI_HI[pan.moonRashi]) + '</span>' +
      '<b>सूर्य राशि</b><span>' + esc(A.RASHI_HI[pan.sunRashi]) + '</span>' +
      '</div></div>';

    $('#todayBody').innerHTML = h;
  }

  /* ---------------- KUNDLI ---------------- */
  function northChart(chart, mode) {
    // mode: 'rashi' | 'navamsa'
    var S = 320, pad = 2;
    var pos = [
      [160, 62], [80, 30], [30, 80], [78, 160], [30, 240], [80, 292],
      [160, 258], [240, 292], [290, 240], [242, 160], [290, 80], [240, 30]
    ];
    var lines = [
      'M' + pad + ' ' + pad + 'H' + (S - pad) + 'V' + (S - pad) + 'H' + pad + 'Z',
      'M' + pad + ' ' + pad + 'L' + (S - pad) + ' ' + (S - pad),
      'M' + (S - pad) + ' ' + pad + 'L' + pad + ' ' + (S - pad),
      'M' + (S / 2) + ' ' + pad + 'L' + (S - pad) + ' ' + (S / 2) + 'L' + (S / 2) + ' ' + (S - pad) + 'L' + pad + ' ' + (S / 2) + 'Z'
    ];
    var byHouse = {};
    for (var i = 1; i <= 12; i++) byHouse[i] = [];
    var ascSign = chart.ascSign;
    chart.planets.forEach(function (p) {
      var sign = mode === 'navamsa' ? p.navamsaSign : p.sign;
      var base = mode === 'navamsa' ? A.rashiOf(A.navamsaLon(chart.ascendant)) : ascSign;
      var house = ((sign - base + 12) % 12) + 1;
      byHouse[house].push(p);
    });
    var baseSign = mode === 'navamsa' ? A.rashiOf(A.navamsaLon(chart.ascendant)) : ascSign;

    var svg = '<svg viewBox="0 0 ' + S + ' ' + S + '" role="img" aria-label="Kundli chart">';
    svg += '<rect x="0" y="0" width="' + S + '" height="' + S + '" fill="#0e0b20"/>';
    lines.forEach(function (d) { svg += '<path d="' + d + '" fill="none" stroke="#3a2f6e" stroke-width="1.4"/>'; });
    for (var hh = 1; hh <= 12; hh++) {
      var sign = (baseSign + hh - 1) % 12;
      var x = pos[hh - 1][0], y = pos[hh - 1][1];
      svg += '<text x="' + x + '" y="' + (y - 16) + '" fill="#7a739f" font-size="11" text-anchor="middle">' + (sign + 1) + '</text>';
      var ps = byHouse[hh];
      ps.forEach(function (p, k) {
        var abbr = { Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju',
                     Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke' }[p.name];
        var col = p.dignity.key === 'exalted' ? '#5fd39a' : p.dignity.key === 'debilitated' ? '#ff6b7a' : '#ece9ff';
        var cols = Math.min(2, ps.length);
        var cx = x + ((k % cols) - (cols - 1) / 2) * 30;
        var cy = y + Math.floor(k / cols) * 14;
        svg += '<text x="' + cx + '" y="' + cy + '" fill="' + col + '" font-size="12.5" font-weight="600" text-anchor="middle">' +
               abbr + '</text>';
        if (p.retro) svg += '<text x="' + (cx + 12) + '" y="' + (cy - 5) + '" fill="#ff6b7a" font-size="8">R</text>';
      });
      if (hh === 1) svg += '<text x="' + x + '" y="' + (y + (ps.length ? Math.ceil(ps.length / 2) * 14 + 4 : 16)) + '" fill="#f5c451" font-size="10" text-anchor="middle">लग्न</text>';
    }
    svg += '</svg>';
    return svg;
  }

  function renderKundli() {
    var c = state.chart, n = state.natal;
    var h = '';

    h += '<div class="card"><h2><span class="ic">🔯</span> जन्म कुंडली</h2>' +
      '<p class="sub">' + esc(state.profile.name || '') + ' · ' +
      c.birth.day + '/' + c.birth.month + '/' + c.birth.year + ' · ' +
      String(c.birth.hour).padStart(2, '0') + ':' + String(c.birth.minute).padStart(2, '0') + ' · ' +
      esc(state.profile.place || (c.birth.lat.toFixed(2) + ', ' + c.birth.lon.toFixed(2))) + '</p>' +
      '<div class="chips"><span class="pill y">लग्न ' + esc(c.ascSignHi) + '</span>' +
      '<span class="pill b">चन्द्र ' + esc(A.RASHI_HI[c.moonSign]) + '</span>' +
      '<span class="pill">सूर्य ' + esc(A.RASHI_HI[c.sunSign]) + '</span>' +
      '<span class="pill p">' + esc(c.janmaNakshatra.hindi) + ' ' + c.janmaNakshatra.pada + '</span></div>' +
      '<div class="chartbox mt">' + northChart(c, 'rashi') + '</div>' +
      '<p class="sub center mt">राशि चक्र (D1) · लाहिरी अयनांश ' + A.formatDeg(c.ayanamsa) + '</p>' +
      '</div>';

    h += '<div class="card"><h2><span class="ic">📖</span> सार</h2><p>' + esc(n.summary) + '</p>' +
      '<hr class="hr"><div class="gridkv">' +
      '<b>लग्न</b><span>' + esc(n.core.lagna) + '</span>' +
      '<b>चन्द्र</b><span>' + esc(n.core.moon) + '</span>' +
      '<b>सूर्य</b><span>' + esc(n.core.sun) + '</span>' +
      '<b>नक्षत्र</b><span>' + esc(n.core.nakshatra) + '</span>' +
      '</div></div>';

    h += '<div class="card"><h2><span class="ic">🪐</span> ग्रह स्थिति</h2><div class="wrapx"><table class="tbl">' +
      '<tr><th>ग्रह</th><th>राशि</th><th>अंश</th><th>भाव</th><th>नक्षत्र</th><th>बल</th></tr>' +
      c.planets.map(function (p) {
        var cls = p.dignity.key === 'exalted' ? 'g' : p.dignity.key === 'debilitated' ? 'r'
                : p.dignity.key === 'own' ? 'y' : '';
        return '<tr><td><b>' + esc(p.name) + '</b>' + (p.retro ? ' ℞' : '') + '<br><span class="dimtxt" style="font-size:11px">' +
          esc(D.PLANET_INFO[p.name].hi) + '</span></td>' +
          '<td>' + esc(p.signEn) + '</td><td class="dimtxt">' + esc(A.formatDeg(p.deg)) + '</td>' +
          '<td>' + p.house + '</td><td style="font-size:11.5px">' + esc(p.nakshatra.name) + '<br><span class="dimtxt">पाद ' + p.nakshatra.pada + '</span></td>' +
          '<td><span class="pill ' + cls + '">' + esc(p.dignity.label.split(' ')[0]) + '</span></td></tr>';
      }).join('') + '</table></div></div>';

    h += '<div class="card"><h2><span class="ic">🏠</span> भाव फल</h2>' +
      n.planets.map(function (p) {
        return '<details class="acc"><summary>' + esc(p.name) + ' (' + esc(p.hi) + ') — भाव ' + p.house + ' · ' + esc(p.placement) + '</summary>' +
          '<div class="body"><p>' + esc(p.reading) + '</p>' +
          (p.note ? '<p class="sub">' + esc(p.note) + '</p>' : '') +
          '<p class="sub"><b>कारक:</b> ' + esc(p.karaka) + '<br><b>नक्षत्र:</b> ' + esc(p.nakshatra) +
          '<br><b>भाव:</b> ' + esc(p.houseName) + '</p></div></details>';
      }).join('') + '</div>';

    if (n.yogas.length) {
      h += '<div class="card"><h2><span class="ic">✨</span> योग</h2>' +
        n.yogas.map(function (y) {
          return '<details class="acc"><summary>' + esc(y.name) + '</summary><div class="body"><p>' + esc(y.text) + '</p></div></details>';
        }).join('') + '</div>';
    }

    h += '<div class="card"><h2><span class="ic">🔥</span> मंगल दोष</h2>' +
      '<p>' + esc(n.mangal.note) + '</p></div>';

    h += '<div class="card"><h2><span class="ic">🏛️</span> बारह भाव</h2><div class="wrapx"><table class="tbl">' +
      '<tr><th>भाव</th><th>राशि</th><th>स्वामी</th><th>ग्रह</th><th>दृष्टि</th></tr>' +
      n.houses.map(function (H) {
        return '<tr><td><b>' + H.num + '</b><br><span class="dimtxt" style="font-size:11px">' + esc(H.meta.title) + '</span></td>' +
          '<td>' + esc(H.sign) + '</td><td>' + esc(H.lord) + '</td>' +
          '<td>' + (H.planets.length ? esc(H.planets.join(', ')) : '<span class="dimtxt">—</span>') + '</td>' +
          '<td class="dimtxt" style="font-size:11.5px">' + (H.aspectedBy.length ? esc(H.aspectedBy.join(', ')) : '—') + '</td></tr>';
      }).join('') + '</table></div></div>';

    h += '<div class="card"><h2><span class="ic">9️⃣</span> नवांश (D9)</h2>' +
      '<p class="sub">विवाह, जीवनसाथी और ग्रहों की असली मज़बूती — D9 में जो ग्रह अपनी राशि में जाए (वर्गोत्तम) वो सबसे बलवान।</p>' +
      '<div class="chartbox mt">' + northChart(c, 'navamsa') + '</div>' +
      '<div class="chips mt">' + c.planets.filter(function (p) { return p.navamsaSign === p.sign; })
        .map(function (p) { return '<span class="pill g">' + esc(p.name) + ' वर्गोत्तम</span>'; }).join('') + '</div></div>';

    $('#kundliBody').innerHTML = h;
  }

  /* ---------------- DASHA ---------------- */
  function fmtDate(d) {
    var M = ['जन','फर','मार्च','अप्रैल','मई','जून','जुल','अग','सित','अक्ट','नव','दिस'];
    return d.d + ' ' + M[d.m - 1] + ' ' + d.y;
  }

  function renderDasha() {
    var jd = nowJD(), c = state.chart;
    var dash = R.dashaReport(c, jd);
    var h = '';

    h += '<div class="card"><h2><span class="ic">🕉️</span> विंशोत्तरी दशा</h2>' +
      '<p class="sub">जन्म नक्षत्र ' + esc(c.janmaNakshatra.hindi) + ' (' + esc(c.janmaNakshatra.name) + '), स्वामी ' +
      esc(c.janmaNakshatra.lord) + ' — यहीं से 120 वर्ष का चक्र शुरू होता है।</p>' +
      '<hr class="hr">' +
      dash.chain.map(function (x) {
        return '<div class="mb"><span class="pill ' + (x.level === 'Mahadasha' ? 'y' : x.level === 'Antardasha' ? 'p' : 'b') + '">' +
          esc(x.level) + '</span> <b>' + esc(x.lord) + '</b> (' + esc(x.hi) + ')<br>' +
          '<span class="sub">' + fmtDate(x.from) + ' → ' + fmtDate(x.to) + ' · शेष ' +
          (x.remainingYears >= 1 ? x.remainingYears.toFixed(1) + ' वर्ष' : Math.round(x.remainingYears * 12) + ' माह') + '</span></div>';
      }).join('') +
      '</div>';

    h += '<div class="card"><h2><span class="ic">📜</span> महादशा का प्रभाव</h2>' +
      '<p>' + esc(dash.mahaEffect) + '</p>' +
      '<p class="sub">' + esc(dash.mahaPlacement) + '</p>' +
      (dash.antarEffect ? '<hr class="hr"><h3>अंतर्दशा — ' + esc(dash.chain[1].lord) + '</h3><p>' + esc(dash.antarEffect) + '</p>' : '') +
      (dash.interplay ? '<p class="sub">' + esc(dash.interplay) + '</p>' : '') +
      '</div>';

    h += '<div class="card"><h2><span class="ic">🪔</span> उपाय</h2>' +
      '<div class="gridkv"><b>दिन</b><span>' + esc(dash.day) + '</span>' +
      '<b>मंत्र</b><span>' + esc(dash.mantra) + '</span>' +
      '<b>रत्न</b><span>' + esc(D.PLANET_INFO[dash.chain[0].lord].gem) + ' <span class="dimtxt">(किसी जानकार से पुष्टि कराकर ही धारण करें)</span></span>' +
      '</div><p class="mt">' + esc(dash.remedy) + '</p></div>';

    h += '<div class="card"><h2><span class="ic">⏭️</span> आने वाले बदलाव</h2><div class="tl">' +
      dash.upcoming.map(function (u) {
        return '<div class="ev"><b>' + esc(u.lord) + '</b> <span class="pill">' + esc(u.level) + '</span><br>' +
          '<span class="sub">' + fmtDate(u.date) + ' · ' + u.inYears.toFixed(1) + ' वर्ष बाद</span></div>';
      }).join('') + '</div></div>';

    h += '<div class="card"><h2><span class="ic">📈</span> पूरा जीवन चक्र</h2>' +
      c.dashaTree.map(function (m) {
        var cur = jd >= m.startJD && jd < m.endJD;
        return '<details class="acc"' + (cur ? ' open' : '') + '><summary>' +
          (cur ? '▶ ' : '') + esc(m.lord) + ' (' + esc(D.PLANET_INFO[m.lord].hi) + ') · ' + m.years + ' वर्ष' +
          ' <span class="pill" style="margin-left:auto">' + fmtDate(A.jdToDate(m.startJD)) + '</span></summary>' +
          '<div class="body"><p class="sub">' + esc(D.DASHA_EFFECT[m.lord]) + '</p>' +
          '<table class="tbl">' + m.children.map(function (a) {
            var acur = jd >= a.startJD && jd < a.endJD;
            return '<tr' + (acur ? ' style="color:var(--gold)"' : '') + '><td>' + esc(a.lord) + '</td>' +
              '<td class="dimtxt">' + fmtDate(A.jdToDate(a.startJD)) + '</td>' +
              '<td class="dimtxt">' + fmtDate(A.jdToDate(a.endJD)) + '</td></tr>';
          }).join('') + '</table></div></details>';
      }).join('') + '</div>';

    $('#dashaBody').innerHTML = h;
  }

  /* ---------------- PALM ---------------- */
  var LINE_COLORS = { life: '#ff6b7a', head: '#6fa8ff', heart: '#f5c451', fate: '#b98cff',
                      sun: '#5fd39a', mercury: '#ff8a3d', marriage: '#ff9ecb', girdle: '#8ee0ff' };

  function renderPalm() {
    var body = $('#palmBody');
    var intro = $('#palmIntro');
    if (intro && !state.stream) intro.hidden = !!state.palm;
    if (!state.palm) {
      body.innerHTML = '<div class="card"><h2><span class="ic">📜</span> यह कैसे काम करता है</h2>' +
        '<p class="sub">तस्वीर पर local image-processing चलती है: skin segmentation → हथेली का bounding box → ' +
        'local-contrast से crease map → सामुद्रिक शास्त्र के तय रेखा-पथों पर band search → हर रेखा की गहराई, ' +
        'निरंतरता और टूट का माप → पर्वतों की उभार गणना। फिर उन मापों को शास्त्रीय फल से जोड़ा जाता है।</p>' +
        '<p class="sub"><b>ईमानदारी से:</b> यह heuristic माप है, कोई medical scanner नहीं। तस्वीर की quality ' +
        'सीधे परिणाम बदलती है — इसीलिए हर रिपोर्ट में confidence भी दिखता है।</p></div>';
      return;
    }
    var p = state.palm.report, meta = state.palm;
    var h = '';

    h += '<div class="card"><h2><span class="ic">🖐️</span> आपकी हस्तरेखा</h2>' +
      '<p class="sub">' + esc(meta.hand === 'left' ? 'बायाँ हाथ' : 'दायाँ हाथ') + ' · ' +
      new Date(meta.at).toLocaleString('hi-IN') + ' · भरोसा ' + p.confidence + '%</p>' +
      '<div class="meter ' + (p.confidence >= 65 ? 'g' : p.confidence >= 40 ? '' : 'r') + ' mb"><i style="width:' + p.confidence + '%"></i></div>' +
      (p.quality.issues.length ? '<div class="warn">' + p.quality.issues.map(esc).join('<br>') + '</div>' : '') +
      '<div class="overlaywrap">' +
        '<img src="' + meta.preview + '" alt="palm">' +
        meta.overlay +
      '</div>' +
      '<div class="legend">' + Object.keys(LINE_COLORS).filter(function (k) { return k !== 'marriage'; }).map(function (k) {
        return '<span><i style="background:' + LINE_COLORS[k] + '"></i>' + esc(window.PalmData.LINE_INFO[k].hi) + '</span>';
      }).join('') + '</div>' +
      '<hr class="hr"><p>' + esc(p.summary) + '</p>' +
      '<button class="btn ghost sm mt" id="btnRescan">फिर से स्कैन करें</button>' +
      '</div>';

    h += '<div class="card"><h2><span class="ic">📏</span> रेखाएँ</h2>' +
      p.lines.map(function (L) {
        var cls = L.score >= 66 ? 'g' : L.score >= 40 ? '' : 'r';
        return '<details class="acc"><summary><span style="width:10px;height:10px;border-radius:50%;background:' +
          (LINE_COLORS[L.key] || '#888') + ';display:inline-block"></span>' +
          esc(L.hi) + ' <span class="dimtxt" style="font-weight:400;font-size:12px">' + esc(L.name) + '</span>' +
          '<span class="pill ' + cls + '" style="margin-left:auto">' + L.score + '</span></summary>' +
          '<div class="body">' +
          '<div class="meter ' + cls + ' mb"><i style="width:' + L.score + '%"></i></div>' +
          '<p class="sub">' + esc(L.about) + '</p>' +
          '<p>' + esc(L.text) + '</p>' +
          L.extra.map(function (e) { return '<p>' + esc(e) + '</p>'; }).join('') +
          '<div class="gridkv" style="font-size:12px"><b>गहराई</b><span>' + L.depth + '%</span>' +
          '<b>स्पष्टता</b><span>' + L.clarity + '%</span>' +
          '<b>निरंतरता</b><span>' + L.continuity + '%</span>' +
          '<b>टूट</b><span>' + L.breaks + '</span></div>' +
          '</div></details>';
      }).join('') + '</div>';

    h += '<div class="card"><h2><span class="ic">⛰️</span> पर्वत</h2>' +
      p.mounts.map(function (m) {
        return '<div class="mb"><div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">' +
          '<b>' + esc(m.hi) + '</b><span class="dimtxt" style="font-size:12px">' + esc(m.name) + '</span>' +
          '<span class="pill ' + (m.band === 'high' ? 'g' : m.band === 'low' ? '' : 'y') + '" style="margin-left:auto">' + m.level + '</span></div>' +
          '<div class="meter mb"><i style="width:' + m.level + '%"></i></div>' +
          '<p class="sub" style="margin:0">' + esc(m.text) + '</p></div>';
      }).join('') + '</div>';

    body.innerHTML = h;
    var rb = $('#btnRescan');
    if (rb) rb.addEventListener('click', function () {
      $('#palmIntro').hidden = false;
      $('#palmIntro').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function buildOverlay(res) {
    var svg = '<svg viewBox="0 0 ' + res.imageW + ' ' + res.imageH + '" preserveAspectRatio="none">';
    Object.keys(res.lines).forEach(function (key) {
      if (key === 'marriage') return;
      var col = LINE_COLORS[key] || '#fff';
      var tr = res.lines[key].trace || [];
      var seg = [], segs = [];
      tr.forEach(function (t) {
        if (t.hit) seg.push(t.px.toFixed(1) + ',' + t.py.toFixed(1));
        else { if (seg.length > 2) segs.push(seg.join(' ')); seg = []; }
      });
      if (seg.length > 2) segs.push(seg.join(' '));
      segs.forEach(function (s) {
        svg += '<polyline points="' + s + '" fill="none" stroke="' + col +
               '" stroke-width="2.2" stroke-linecap="round" opacity=".92"/>';
      });
    });
    var b = res.palmBox;
    svg += '<rect x="' + b.x.toFixed(1) + '" y="' + b.y.toFixed(1) + '" width="' + b.w.toFixed(1) +
           '" height="' + b.h.toFixed(1) + '" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-dasharray="5 5"/>';
    svg += '</svg>';
    return svg;
  }

  function runAnalysis(source) {
    var hand = $('#palmHand').value;
    $('#palmBody').innerHTML = '<div class="card center"><span class="spinner"></span> हथेली पढ़ी जा रही है…</div>';
    setTimeout(function () {
      var res;
      try { res = P.analyse(source, { hand: hand }); }
      catch (e) {
        $('#palmBody').innerHTML = '<div class="card"><div class="warn">तस्वीर पढ़ी नहीं जा सकी: ' + esc(e.message) + '</div></div>';
        return;
      }
      if (!res.ok) {
        $('#palmBody').innerHTML = '<div class="card"><div class="warn">' + esc(res.error) + '</div>' +
          (res.quality.issues.length ? '<p class="sub">' + res.quality.issues.map(esc).join('<br>') + '</p>' : '') +
          '</div>';
        return;
      }
      var report = R.palmReport(res);
      state.palm = { at: Date.now(), hand: hand, preview: res.preview, overlay: buildOverlay(res), report: report };
      try { localStorage.setItem(PALMKEY, JSON.stringify(state.palm)); }
      catch (e) { /* quota — keep in memory only */ }
      renderPalm();
    }, 30);
  }

  function openCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('इस browser में कैमरा उपलब्ध नहीं — गैलरी से तस्वीर चुनें।');
      return;
    }
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1706 } }
    }).then(function (s) {
      state.stream = s;
      var v = $('#cam');
      v.srcObject = s;
      v.play();
      $('#camCard').hidden = false;
      $('#palmIntro').hidden = true;
      $('#camCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).catch(function (e) {
      alert('कैमरा नहीं खुला (' + e.name + ')। गैलरी से तस्वीर चुनें।');
    });
  }

  function closeCamera() {
    if (state.stream) { state.stream.getTracks().forEach(function (t) { t.stop(); }); state.stream = null; }
    $('#camCard').hidden = true;
    $('#palmIntro').hidden = false;
  }

  /* ---------------- FUSION ---------------- */
  function renderFusion() {
    var body = $('#fusionBody');
    if (!state.palm) {
      body.innerHTML = '<div class="card"><h2><span class="ic">🔮</span> संगम</h2>' +
        '<p>यहाँ कुंडली और हस्तरेखा को आमने-सामने रखा जाता है — जहाँ दोनों एक बात कहें वो आपकी सबसे पक्की रेखा है, ' +
        'और जहाँ अलग कहें वहीं असली जानकारी छिपी है।</p>' +
        '<p class="sub">पहले हस्तरेखा टैब से एक स्कैन कर लें।</p></div>';
      return;
    }
    var f = R.fusion(state.chart, state.natal, state.palm.report);
    var jd = nowJD();
    var dash = R.dashaReport(state.chart, jd);
    var day = R.dailyReport(state.chart, jd, localTZ());

    var h = '<div class="card"><h2><span class="ic">🔮</span> कुंडली + हस्तरेखा</h2>' +
      '<p class="sub">शास्त्र कहता है: कुंडली प्रारब्ध है, हाथ क्रियमाण। दोनों मिलकर ही पूरी तस्वीर बनाते हैं।</p></div>';

    h += f.map(function (x) {
      return '<div class="card"><h3>' + esc(x.title) + '</h3><p>' + esc(x.text) + '</p></div>';
    }).join('');

    h += '<div class="card"><h2><span class="ic">🧭</span> अभी क्या करें</h2>' +
      '<p>' + esc(dash.mahaEffect.split('.')[0]) + '. ' + esc(day.advice) + '</p>' +
      '<div class="gridkv mt">' +
      '<b>अभी की दशा</b><span>' + esc(dash.chain.map(function (c) { return c.lord; }).join(' → ')) + '</span>' +
      '<b>हाथ की ताक़त</b><span>' + esc(state.palm.report.strongestLine.name) + ' (' + state.palm.report.strongestLine.score + '/100)</span>' +
      '<b>प्रमुख पर्वत</b><span>' + esc(state.palm.report.dominantMount.name) + '</span>' +
      '<b>चार्ट का बल</b><span>' + esc(state.natal.strongest.name) + ' — ' + esc(state.natal.strongest.dignity.label) + '</span>' +
      '<b>ध्यान देने योग्य</b><span>' + esc(state.natal.weakest.name) + ' — ' + esc(state.natal.weakest.dignity.label) + ', भाव ' + state.natal.weakest.house + '</span>' +
      '</div>' +
      '<hr class="hr"><p class="sub"><b>उपाय:</b> ' + esc(dash.remedy) + '<br><b>मंत्र:</b> ' + esc(dash.mantra) + '</p></div>';

    body.innerHTML = h;
  }

  /* ---------------- MORE ---------------- */
  function renderMore() {
    var c = state.chart;
    var h = '';
    h += '<div class="card"><h2><span class="ic">👤</span> प्रोफ़ाइल</h2>' +
      '<div class="gridkv">' +
      '<b>नाम</b><span>' + esc(state.profile.name || '—') + '</span>' +
      '<b>जन्म</b><span>' + c.birth.day + '/' + c.birth.month + '/' + c.birth.year + ' ' +
        String(c.birth.hour).padStart(2, '0') + ':' + String(c.birth.minute).padStart(2, '0') + '</span>' +
      '<b>स्थान</b><span>' + esc(state.profile.place || '—') + '</span>' +
      '<b>निर्देशांक</b><span>' + c.birth.lat.toFixed(4) + ', ' + c.birth.lon.toFixed(4) + ' · UTC' + (c.birth.tz >= 0 ? '+' : '') + c.birth.tz + '</span>' +
      '<b>अयनांश</b><span>Lahiri ' + esc(A.formatDeg(c.ayanamsa)) + '</span>' +
      '</div>' +
      '<div class="btnrow mt"><button class="btn ghost" id="btnEdit">विवरण बदलें</button>' +
      '<button class="btn ghost" id="btnExport">रिपोर्ट सहेजें</button></div>' +
      '</div>';

    h += '<div class="card"><h2><span class="ic">🔒</span> गोपनीयता</h2>' +
      '<p>यह app पूरी तरह offline है। कोई भी जानकारी — जन्म विवरण या हथेली की तस्वीर — इस device से बाहर नहीं जाती। ' +
      'कोई server, कोई analytics, कोई account नहीं। सब कुछ browser के localStorage में रहता है।</p>' +
      '<div class="btnrow"><button class="btn ghost" id="btnClearPalm">हस्तरेखा डेटा मिटाएँ</button>' +
      '<button class="btn ghost" id="btnClearAll" style="color:var(--rd)">सब मिटाएँ</button></div></div>';

    h += '<div class="card"><h2><span class="ic">📐</span> गणना विधि</h2>' +
      '<div class="gridkv" style="font-size:13px">' +
      '<b>पद्धति</b><span>वैदिक / निरयन (sidereal)</span>' +
      '<b>अयनांश</b><span>चित्रपक्ष (Lahiri)</span>' +
      '<b>भाव</b><span>पूर्ण राशि (whole sign) — पराशरी परंपरा</span>' +
      '<b>दशा</b><span>विंशोत्तरी, 3 स्तर तक</span>' +
      '<b>राहु/केतु</b><span>मध्यम (mean) नोड</span>' +
      '<b>ग्रह गणना</b><span>Keplerian elements + मुख्य perturbations</span>' +
      '<b>शुद्धता</b><span>सूर्य/चन्द्र ~1-2 कला; ग्रह ~2-5 कला</span>' +
      '</div>' +
      '<p class="sub mt">रेखागणित नक्षत्र (3°20\') और राशि (30°) से कहीं ज़्यादा बारीक है, इसलिए फल पर असर नहीं पड़ता। ' +
      'सेकंड-स्तर की astronomical शुद्धता चाहिए तो Swiss Ephemeris जैसी लाइब्रेरी लगेगी।</p></div>';

    h += '<div class="card"><h2><span class="ic">⚖️</span> ईमानदार बात</h2>' +
      '<p>ज्योतिष और सामुद्रिक शास्त्र <b>पारंपरिक ज्ञान-पद्धतियाँ</b> हैं, प्रमाणित विज्ञान नहीं। ' +
      'यह app उन्हीं शास्त्रीय नियमों को सही-सही लागू करता है — गणना असली है, पर फल की व्याख्या परंपरा से आती है।</p>' +
      '<p>इसे आत्म-चिंतन के आईने की तरह लें। स्वास्थ्य, पैसे, कानून या रिश्तों के बड़े फ़ैसले इस पर मत छोड़िए — ' +
      'उनके लिए योग्य इंसानों से बात कीजिए।</p></div>';

    $('#moreBody').innerHTML = h;

    $('#btnEdit').addEventListener('click', function () {
      fillSetup(); $$('.view').forEach(function (s) { s.classList.remove('on'); });
      $('#vSetup').classList.add('on'); $$('#tabs button').forEach(function (b) { b.classList.remove('on'); });
      window.scrollTo(0, 0);
    });
    $('#btnClearPalm').addEventListener('click', function () {
      if (!confirm('हस्तरेखा स्कैन मिटा दें?')) return;
      localStorage.removeItem(PALMKEY); state.palm = null; alert('मिट गया।');
    });
    $('#btnClearAll').addEventListener('click', function () {
      if (!confirm('सारा डेटा स्थायी रूप से मिट जाएगा। जारी रखें?')) return;
      localStorage.removeItem(KEY); localStorage.removeItem(PALMKEY);
      location.reload();
    });
    $('#btnExport').addEventListener('click', exportReport);
  }

  function exportReport() {
    var jd = nowJD(), c = state.chart, n = state.natal;
    var dash = R.dashaReport(c, jd), day = R.dailyReport(c, jd, localTZ());
    var L = [];
    L.push('JYOTI — व्यक्तिगत ज्योतिष रिपोर्ट');
    L.push('='.repeat(50));
    L.push('नाम: ' + (state.profile.name || '—'));
    L.push('जन्म: ' + c.birth.day + '/' + c.birth.month + '/' + c.birth.year + ' ' +
      String(c.birth.hour).padStart(2, '0') + ':' + String(c.birth.minute).padStart(2, '0') +
      ' · ' + (state.profile.place || ''));
    L.push('अयनांश (Lahiri): ' + A.formatDeg(c.ayanamsa));
    L.push('');
    L.push('-- मूल --');
    L.push('लग्न: ' + c.ascSignEn + ' ' + A.formatDeg(A.degInRashi(c.ascendant)));
    L.push('चन्द्र राशि: ' + A.RASHI_EN[c.moonSign] + ' | सूर्य राशि: ' + A.RASHI_EN[c.sunSign]);
    L.push('जन्म नक्षत्र: ' + c.janmaNakshatra.name + ' पाद ' + c.janmaNakshatra.pada + ' (' + c.janmaNakshatra.lord + ')');
    L.push('');
    L.push(n.summary);
    L.push('');
    L.push('-- ग्रह --');
    c.planets.forEach(function (p) {
      L.push(p.name.padEnd(9) + p.signEn.padEnd(12) + A.formatDeg(p.deg).padEnd(12) +
        'भाव ' + String(p.house).padEnd(3) + p.dignity.label + (p.retro ? ' ℞' : ''));
    });
    L.push('');
    L.push('-- भाव फल --');
    n.planets.forEach(function (p) { L.push('[' + p.name + ' — भाव ' + p.house + '] ' + p.reading); });
    L.push('');
    if (n.yogas.length) {
      L.push('-- योग --');
      n.yogas.forEach(function (y) { L.push('* ' + y.name + ': ' + y.text); });
      L.push('');
    }
    L.push('-- ' + n.mangal.note);
    L.push('');
    L.push('-- दशा --');
    dash.chain.forEach(function (x) {
      L.push(x.level + ': ' + x.lord + ' (' + fmtDate(x.from) + ' → ' + fmtDate(x.to) + ')');
    });
    L.push(dash.mahaEffect);
    L.push(dash.mahaPlacement);
    L.push('उपाय: ' + dash.remedy + ' | मंत्र: ' + dash.mantra);
    L.push('');
    L.push('-- आज --');
    L.push('दिन बल: ' + day.score + '/100 · ' + day.panchang.varaHindi + ' · ' +
      day.panchang.paksha + ' ' + day.panchang.tithi + ' · ' + day.panchang.nakshatra.name);
    L.push(day.advice);
    if (day.sadeSati) L.push('शनि: ' + day.sadeSati.phase + ' — ' + day.sadeSati.note);
    L.push(day.jupiterNote);
    if (state.palm) {
      L.push('');
      L.push('-- हस्तरेखा (' + state.palm.hand + ', भरोसा ' + state.palm.report.confidence + '%) --');
      state.palm.report.lines.forEach(function (x) {
        L.push('[' + x.name + ' ' + x.score + '/100] ' + x.text);
        x.extra.forEach(function (e) { L.push('   + ' + e); });
      });
      L.push('');
      state.palm.report.mounts.forEach(function (m) { L.push(m.name + ' (' + m.level + '): ' + m.text); });
      var fz = R.fusion(c, n, state.palm.report);
      if (fz) { L.push(''); L.push('-- संगम --'); fz.forEach(function (x) { L.push('[' + x.title + '] ' + x.text); }); }
    }
    L.push('');
    L.push('—— पारंपरिक ज्ञान-पद्धति; आत्म-चिंतन हेतु। चिकित्सा/कानूनी/वित्तीय सलाह नहीं। ——');

    var blob = new Blob([L.join('\n')], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'jyoti-report-' + new Date().toISOString().slice(0, 10) + '.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /* ---------------- boot ---------------- */
  function boot() {
    load();
    setupPlaceSearch();

    $('#btnSave').addEventListener('click', saveSetup);
    $$('#tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!state.profile) return alert('पहले जन्म विवरण भरें');
        show(b.dataset.v);
      });
    });
    $('#btnCam').addEventListener('click', openCamera);
    $('#btnCamClose').addEventListener('click', closeCamera);
    $('#btnShot').addEventListener('click', function () {
      var v = $('#cam');
      if (!v.videoWidth) return alert('कैमरा अभी तैयार नहीं');
      runAnalysis(v);
      closeCamera();
    });
    $('#btnFile').addEventListener('click', function () { $('#fileInp').click(); });
    $('#fileInp').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var img = new Image();
      img.onload = function () { runAnalysis(img); URL.revokeObjectURL(img.src); };
      img.onerror = function () { alert('तस्वीर लोड नहीं हुई'); };
      img.src = URL.createObjectURL(f);
      e.target.value = '';
    });

    if (state.profile) {
      try {
        rebuild();
        $('#palmHand').value = state.profile.hand || 'right';
        show('Today');
      } catch (err) {
        console.error(err);
        fillSetup();
        $('#vSetup').classList.add('on');
      }
    } else {
      var d = new Date();
      $('#fTz').value = localTZ();
      $('#vSetup').classList.add('on');
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () { });
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
