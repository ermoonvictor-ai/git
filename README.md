# Jyoti — निजी ज्योतिष व हस्तरेखा

A private Vedic astrology and palm-reading app. Every calculation — charts, dasha,
panchang, transits, palm analysis — runs on your device, with no server of ours anywhere
in the picture. Your palm photograph never leaves the phone under any setting.

One feature is online and off by default: **Pandit**, a chat that reasons about your own
computed chart. It runs on either **Gemini** (Google AI Studio — has a genuinely free
tier, so it costs nothing) or **Claude** (better answers, pay-as-you-go). Turn it on with
your own key and your question plus a chart summary goes to that provider; leave it off
and the app makes no network calls at all.

---

## Getting it on your phone

### Option A — install the web app (no APK needed, ~1 minute)

Serve the `app/` folder over `https://` (or `http://localhost`) and open it in Chrome,
then **⋮ → Add to Home Screen**. You get a home-screen icon, a full-screen app with no
browser chrome, working camera, and it keeps running with the network switched off.

A secure origin is required — the palm scanner uses `getUserMedia()`, which browsers
refuse on a plain `file://` page.

### Option B — a real APK

`android/` holds a minimal Android shell around the same web app. It is not a second
codebase: Gradle mounts `app/` directly as the APK's assets, so the web app stays the
single source of truth.

**Direct download:** every `v*` tag publishes a Release with the APK attached under a
predictable, unauthenticated URL:

```
https://github.com/ermoonvictor-ai/git/releases/download/<tag>/jyoti-<tag>.apk
```

The [Releases page](https://github.com/ermoonvictor-ai/git/releases) always lists the
latest one. A release can also be cut without pushing a tag: *Actions → Build APK → Run
workflow*, and fill in **release_tag**. The workflow creates the tag itself.

**Per-commit builds:** the *Build APK* workflow also runs on every push and can be
started by hand from the **Actions** tab (*Build APK → Run workflow*). Open the finished
run and download the `jyoti-apk-<sha>` artifact — that one is a ZIP and needs a
logged-in GitHub session.

**Build it yourself** (needs the Android SDK and JDK 17):

```bash
cd android && ./gradlew assembleDebug
# android/app/build/outputs/apk/debug/app-debug.apk
```

Installing it means allowing "install unknown apps" for whatever app you transfer it
with — it is a debug-signed build, not a Play Store one.

Two details in the shell are load-bearing:

- The page is served through `WebViewAssetLoader` on
  `https://appassets.androidplatform.net/` rather than `file:///android_asset/`, because
  `file://` is not a secure context and the camera would be unavailable there. That host
  is served straight out of the APK.
- The manifest requests **no `INTERNET` permission**. The app is not merely promising not
  to phone home; Android will not let it.

---

## What it does

| Tab | Contents |
|---|---|
| **आज** | Day-strength score, panchang (tithi/nakshatra/yoga/karana/vara), tara & chandra bala, live gochar table, Sade Sati / dhaiya status, Jupiter transit, running dasha, remedy |
| **कुंडली** | North-Indian D1 and D9 charts, full planet table (sign/degree/house/nakshatra/dignity/retrograde), per-planet bhava-phala, yogas, Mangal dosha, twelve-house table with aspects |
| **दशा** | Vimshottari maha/antar/pratyantar with dates, effects of the running period, upcoming changes, the whole 120-year cycle |
| **हस्तरेखा** | Camera or gallery palm scan, measured line metrics with the detected lines drawn back over your photo, mount relief, classical interpretation |
| **संगम** | Chart and hand cross-referenced — mind, heart, career, vitality, dominant mount |
| **पंडित** | *(online, opt-in)* Streaming chat — Gemini or Claude — grounded in your computed chart |
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

## The Pandit chat (the only online part)

`app/js/pandit.js` builds a grounding context from what the app already computed — every
graha with sign, degree, bhava, nakshatra, dignity and navamsa; the twelve houses with
lords, occupants and aspects; detected yogas; the running Vimshottari chain with dates;
today's panchang, tara bala and transits; and the measured palm metrics if a scan exists.
The system prompt tells the model to reason only from that data and to say so when
something isn't in it, which is what keeps it from inventing placements.

Two providers, both called directly from the device with the user's own key:

- **Gemini** (`@google/genai`) — the free option. Model IDs are **not** hardcoded: Google
  renames and retires them often, so the app asks the key itself which models it can reach
  (`models.list`), drops the non-chat ones, and ranks what is left — flash-lite first
  (highest free daily allowance), then flash, then pro, newer versions ahead of older.
  The chosen model is shown in Settings and can be changed there.
- **Claude** (`@anthropic-ai/sdk`) — `claude-opus-5`, streaming, adaptive thinking at
  `medium` effort, server-side refusal fallbacks on, and the chart cached as a stable
  system prefix so follow-up turns are cheap.

Both SDKs are the official ones, vendored as one prebuilt browser bundle — see
`app/js/vendor/README.md`; the app has no build step and must run from APK assets.

**What is sent:** your question and that chart summary, which includes your birth date,
time and place. **What is never sent:** the palm photograph. It is analysed on-device and
only the resulting numbers can travel.

**The key is yours.** You paste your own key, it is stored in `localStorage` on that
device only, and requests go straight to the provider — there is no server of ours in
between, and any billing is on your own account. That does mean the key lives in the app;
for a single-user personal app that is the trade for having no backend at all. The
settings tab turns it off and deletes the key.

A key is unavoidable: no hosted model is free and unlimited, and embedding one in a
public APK would hand it to everyone who downloads it. Gemini's free tier is the way to
run this at zero cost.

The Android manifest requests `INTERNET` for this feature. Before it existed the app had
no such permission and the offline guarantee was enforced by the platform; now it is
enforced by the feature being off. Everything else still runs with the radio off.

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
  js/pandit.js            grounding context + Claude API calls (the online feature)
  js/vendor/              prebuilt @anthropic-ai/sdk + @google/genai browser bundle
  js/app.js               UI
  sw.js                   offline cache
  manifest.webmanifest
android/                  minimal WebView shell; mounts app/ as its assets
.github/workflows/        Build APK workflow
```

## Honest note

Jyotish and Samudrik Shastra are **traditional knowledge systems, not validated science**.
The calculations here are real and the classical rules are applied faithfully; the
*meaning* attached to them comes from tradition. Use it as a mirror for reflection.
Decisions about health, money, law or relationships belong with qualified people.

Built from the classical public-domain corpus — no third-party app was decompiled and no
proprietary content was copied.
