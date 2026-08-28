# Jyoti — निजी ज्योतिष व हस्तरेखा

A private, **fully offline** Vedic astrology and palm-reading app. No server, no account,
no analytics, no network calls of any kind. Your birth details and your palm photograph
never leave the device.

Open `app/index.html` in a browser, or serve the `app/` folder and install it as a PWA
("Add to Home Screen") — it then works with the network switched off entirely.

---

## What it does

| Tab | Contents |
|---|---|
| **आज** | Day-strength score, panchang (tithi/nakshatra/yoga/karana/vara), tara & chandra bala, live gochar table, Sade Sati / dhaiya status, Jupiter transit, running dasha, remedy |
| **कुंडली** | North-Indian D1 and D9 charts, full planet table (sign/degree/house/nakshatra/dignity/retrograde), per-planet bhava-phala, yogas, Mangal dosha, twelve-house table with aspects |
| **दशा** | Vimshottari maha/antar/pratyantar with dates, effects of the running period, upcoming changes, the whole 120-year cycle |
| **हस्तरेखा** | Camera or gallery palm scan, measured line metrics with the detected lines drawn back over your photo, mount relief, classical interpretation |
| **संगम** | Chart and hand cross-referenced — mind, heart, career, vitality, dominant mount |
| **और** | Profile, method notes, plain-text report export, one-tap data wipe |

## Astronomy

Positions come from a self-contained ephemeris — Keplerian orbital elements plus the
principal perturbation terms (the twelve main lunar terms, and the Jupiter–Saturn great
inequality). No external ephemeris file, no API.

- Sidereal / nirayana, **Lahiri (Chitrapaksha)** ayanamsa
- Whole-sign bhava, the Parashari standard
- Mean lunar node for Rahu/Ketu
- Retrogression from the day-either-side longitude difference

Validated against known syzygies: the computed Sun–Moon elongation at the new moons of
1990-08-20, 2000-01-06 and 2024-01-11 and the full moon of 2024-01-25 is within **0.06°**,
i.e. a few minutes of time. Planetary longitudes land within a few arc-minutes — far finer
than the 3°20′ nakshatra pada and 30° rashi divisions the interpretation actually uses.

For arc-second accuracy you would need Swiss Ephemeris; nothing in the readings depends
on that level of precision.

## Palm analysis

Real image processing, run on a local `<canvas>`:

1. **Skin segmentation** in YCbCr, then morphological open/close
2. **Largest connected component** → hand bounding box → palm box (fingers cropped)
3. **Crease response** = local box-mean − pixel (a black-hat style filter), normalised
   per image by its own 97th percentile so lighting cancels out
4. **Band search** along the classical rekha paths in palm-space, sampling perpendicular
   to the path — yielding coverage, depth, continuity, break count and lateral wobble
5. **Mount relief** from local luminance against the palm mean
6. Metrics → Samudrik Shastra interpretation, with a stated confidence

Left hands are mirrored so the thumb is always at `u = 0` in palm-space.

The detector discriminates: on a synthetic palm carrying only the heart, head and life
lines it returns 100/100 for those three and 7/100 for the fate line; adding a fate line
moves it to 100/100. Relationship-line counting requires the mark to fade before it
reaches the palm interior, so the heart line running out to the percussion edge is not
miscounted.

This is a heuristic measurement, not a medical scanner, and image quality moves the
result — which is why every report shows its confidence and lists what was wrong with
the photo.

## Layout

```
app/
  index.html              shell + views
  css/style.css
  js/astro.js             ephemeris, ayanamsa, lagna, nakshatra, dasha, panchang
  js/jyotish-data.js      bhava, planet, nakshatra, yoga and dasha significations
  js/palm.js              image pipeline
  js/palm-data.js         hast-rekha interpretation layer
  js/reading.js           report generation (natal, dasha, daily, palm, fusion)
  js/cities.js            201 offline places with lat/lon/tz
  js/app.js               UI
  sw.js                   offline cache
  manifest.webmanifest
```

## Honest note

Jyotish and Samudrik Shastra are **traditional knowledge systems, not validated science**.
The calculations here are real and the classical rules are applied faithfully; the
*meaning* attached to them comes from tradition. Use it as a mirror for reflection.
Decisions about health, money, law or relationships belong with qualified people.

Built from the classical public-domain corpus — no third-party app was decompiled and no
proprietary content was copied.
