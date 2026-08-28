# Vendored dependencies

`llm-sdks.js` bundles both official SDKs for the browser:

- `@anthropic-ai/sdk` 0.122.0 → `window.Anthropic`
- `@google/genai` 2.19.0 → `window.GoogleGenAI`

The app has no build step and must run offline from the APK's assets, so these
are committed as one prebuilt bundle rather than installed at build time.

To regenerate:

```bash
npm install @anthropic-ai/sdk @google/genai esbuild
cat > entry.js <<'JS'
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
window.Anthropic = Anthropic;
window.GoogleGenAI = GoogleGenAI;
JS
npx esbuild entry.js --bundle --format=iife --platform=browser --target=es2020 \
  --minify --legal-comments=none --external:node:* --outfile=llm-sdks.js
```

`--external:node:*` leaves the SDKs' lazy `import('node:fs')` calls alone. They sit
in file-upload and memory-tool paths that this app never touches.
