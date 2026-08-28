# Vendored dependency

`anthropic-sdk.js` is the official `@anthropic-ai/sdk` (v0.122.0) bundled for the
browser, exposing `window.Anthropic`.

The app has no build step and must run offline from the APK's assets, so the SDK
is committed as a prebuilt bundle rather than installed at build time.

To regenerate:

```bash
npm install @anthropic-ai/sdk esbuild
echo "import Anthropic from '@anthropic-ai/sdk'; window.Anthropic = Anthropic;" > entry.js
npx esbuild entry.js --bundle --format=iife --platform=browser --target=es2020 \
  --minify --legal-comments=none --external:node:* --outfile=anthropic-sdk.js
```

`--external:node:*` leaves the SDK's lazy `import('node:fs')` calls alone. They sit
in the Files API and memory-tool paths, which this app never touches.
