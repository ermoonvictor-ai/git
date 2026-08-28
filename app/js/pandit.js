/* ============================================================
   Pandit — the one online feature.

   Everything else in this app runs offline. This module sends the
   user's question plus a summary of their own computed chart to the
   Claude API and streams the answer back.

   The API key is the user's own, stored only in localStorage on this
   device, and requests go directly to api.anthropic.com — there is no
   intermediate server of ours.
   ============================================================ */
(function (g) {
  'use strict';
  var A = g.Astro, D = g.JyotishData, R = g.Reading;

  var MODEL = 'claude-opus-5';

  /* ---------- grounding context ----------
     The model must reason from the chart this app actually computed,
     not from a chart it imagines. Everything it is allowed to assert
     about placements comes from here. */
  function chartContext(profile, chart, natal, palm, jd) {
    var L = [];
    var b = chart.birth;

    L.push('## Native');
    L.push('Name: ' + (profile.name || 'not given'));
    L.push('Born: ' + b.day + '/' + b.month + '/' + b.year + ' at ' +
      String(b.hour).padStart(2, '0') + ':' + String(b.minute).padStart(2, '0') +
      ' local time, ' + (profile.place || (b.lat + ', ' + b.lon)) +
      ' (lat ' + b.lat.toFixed(4) + ', lon ' + b.lon.toFixed(4) + ', UTC' + (b.tz >= 0 ? '+' : '') + b.tz + ')');
    L.push('Ayanamsa: Lahiri ' + A.formatDeg(chart.ayanamsa) + ' (sidereal, whole-sign bhava)');
    L.push('');

    L.push('## Core');
    L.push('Lagna: ' + chart.ascSignEn + ' ' + A.formatDeg(A.degInRashi(chart.ascendant)) +
      ', lagna lord ' + A.RASHI_LORD[chart.ascSign]);
    L.push('Moon rashi: ' + A.RASHI_EN[chart.moonSign] + ' | Sun rashi: ' + A.RASHI_EN[chart.sunSign]);
    L.push('Janma nakshatra: ' + chart.janmaNakshatra.name + ' pada ' + chart.janmaNakshatra.pada +
      ', lord ' + chart.janmaNakshatra.lord);
    L.push('');

    L.push('## Grahas');
    L.push('planet | rashi | degree | bhava | nakshatra(pada) | dignity | retro | navamsa');
    chart.planets.forEach(function (p) {
      L.push([p.name, p.signEn, A.formatDeg(p.deg), p.house,
        p.nakshatra.name + '(' + p.nakshatra.pada + ')', p.dignity.label,
        p.retro ? 'R' : '-', A.RASHI_EN[p.navamsaSign]].join(' | '));
    });
    L.push('');

    L.push('## Bhavas');
    L.push('house | rashi | lord | occupants | aspected by');
    natal.houses.forEach(function (H) {
      L.push([H.num, H.sign, H.lord,
        H.planets.length ? H.planets.join(',') : '-',
        H.aspectedBy.length ? H.aspectedBy.join(',') : '-'].join(' | '));
    });
    L.push('');

    if (natal.yogas.length) {
      L.push('## Yogas present');
      natal.yogas.forEach(function (y) { L.push('- ' + y.name); });
      L.push('');
    }
    L.push('## Mangal dosha');
    L.push(natal.mangal.present ? 'Present (Mars in house ' + natal.mangal.house + ')' : 'Absent');
    L.push('');

    var dash = R.dashaReport(chart, jd);
    L.push('## Vimshottari dasha (running)');
    dash.chain.forEach(function (c) {
      L.push(c.level + ': ' + c.lord + '  ' + fmt(c.from) + ' -> ' + fmt(c.to) +
        '  (' + c.remainingYears.toFixed(2) + ' years left)');
    });
    L.push('Next changes: ' + dash.upcoming.map(function (u) {
      return u.lord + ' ' + u.level + ' from ' + fmt(u.date);
    }).join('; '));
    L.push('');

    var day = R.dailyReport(chart, jd, b.tz);
    L.push('## Today (gochar)');
    L.push('Panchang: ' + day.panchang.vara + ', ' + day.panchang.paksha + ' ' + day.panchang.tithi +
      ', nakshatra ' + day.panchang.nakshatra.name + ', yoga ' + day.panchang.yoga +
      ', karana ' + day.panchang.karana);
    L.push('Tara bala: ' + day.tara.n + ' | Chandra bala: ' + day.chandraBala.house +
      'th from natal Moon' + (day.chandraBala.ashtama ? ' (CHANDRASHTAMA)' : ''));
    L.push('Transits (planet | rashi | house from natal Moon):');
    day.gochar.forEach(function (t) {
      L.push(t.name + ' | ' + t.sign + ' | ' + t.fromMoon + (t.retro ? ' | R' : ''));
    });
    if (day.sadeSati) L.push('Saturn: ' + day.sadeSati.phase);
    L.push(day.jupiterNote);
    L.push('');

    if (palm && palm.ok) {
      L.push('## Hasta rekha (measured from the native\'s own palm photograph)');
      L.push('Hand: ' + palm.hand + ', reading confidence ' + palm.confidence + '%');
      L.push('line | score/100 | band | breaks');
      palm.lines.forEach(function (x) {
        L.push(x.name + ' | ' + x.score + ' | ' + x.strength + ' | ' + x.breaks);
      });
      L.push('mount | level/100');
      palm.mounts.forEach(function (m) { L.push(m.name + ' | ' + m.level); });
      L.push('');
    } else {
      L.push('## Hasta rekha');
      L.push('No palm scan on file yet.');
      L.push('');
    }

    return L.join('\n');
  }

  function fmt(d) {
    return d.d + '/' + d.m + '/' + d.y;
  }

  function systemPrompt(context) {
    return [
      'You are a learned Jyotishi — a traditional Vedic astrologer — speaking privately with one person about their own chart.',
      '',
      'Their chart has already been computed for you and appears below. Treat it as the single source of truth.',
      '',
      '# Rules',
      '- Never invent or alter a placement. Every planet, house, nakshatra, dasha date and palm measurement you cite must come from the data below. If something is not in the data, say you do not have it rather than guessing.',
      '- Reason like a real jyotishi: name the specific yoga, dignity, house lordship, dasha or transit your reading rests on, then say what it means. A reading with no chart reasoning behind it is worthless to this person.',
      '- Reply in whatever language the person writes in. If they write Hindi or Hinglish, answer in the same register — natural, warm, not textbook translation. Devanagari for Hindi.',
      '- Be direct. Give an actual answer, not a hedge. Where the chart genuinely points both ways, say so and explain which side you weigh more heavily and why.',
      '- Keep it conversational in length — a few tight paragraphs, not an essay, unless they ask for depth.',
      '- Traditional remedies (mantra, daan, gemstone, fasting, conduct) are fine to suggest as tradition holds them. Present a gemstone as something to confirm with an astrologer in person before wearing.',
      '',
      '# Boundaries',
      '- Jyotisha is a traditional knowledge system, not validated science. You do not need to disclaim this in every message, but never present a prediction as established fact.',
      '- Never predict death, terminal illness, or the timing of anyone\'s death, and never diagnose a medical condition. If the person is asking about health, illness or a mental-health crisis, answer the astrological question briefly if there is one, and tell them plainly that this is a matter for a doctor — with real warmth, not a canned line.',
      '- Do not give specific legal, financial or investment instructions. Speak to timing and temperament, not to what to buy or sign.',
      '- If they seem to be in real distress, say something human first and astrology second.',
      '',
      '# Their chart',
      context
    ].join('\n');
  }

  function makeClient(apiKey) {
    if (typeof g.Anthropic !== 'function') throw new Error('SDK not loaded');
    return new g.Anthropic({ apiKey: apiKey, dangerouslyAllowBrowser: true });
  }

  /* Streams one turn. onDelta receives text chunks as they arrive. */
  function ask(opts) {
    var client = makeClient(opts.apiKey);
    var stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      // A policy decline would otherwise just stop the turn; this re-runs it
      // on a fallback model inside the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      // Chat is not a workload that repays maximum effort, and the person is
      // paying per token for their own key.
      output_config: { effort: 'medium' },
      system: [{
        type: 'text',
        text: opts.system,
        // The chart does not change between turns, so it caches cleanly.
        cache_control: { type: 'ephemeral' }
      }],
      messages: opts.messages
    });

    return (async function () {
      for await (var ev of stream) {
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
          opts.onDelta(ev.delta.text);
        }
      }
      var final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') {
        return { refused: true, usage: final.usage };
      }
      return { refused: false, usage: final.usage, model: final.model };
    })();
  }

  g.Pandit = {
    chartContext: chartContext,
    systemPrompt: systemPrompt,
    ask: ask,
    MODEL: MODEL
  };
})(window);
