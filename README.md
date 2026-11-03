Violentmonkey userscript that automatically skips red muted segments in Twitch video recordings. Adjacent muted segments are skipped together.

The script reads Twitch's muted annotations on the seekbar. It leaves paused recordings at the selected position and skips a muted range when playback resumes. Seeking outside a muted range preserves the selected position. Both `/videos/ID` and `/CHANNEL/video/ID` recording URLs are supported.

Install [Violentmonkey](https://violentmonkey.github.io/get-it/), open the [userscript](https://raw.githubusercontent.com/sashokey/skip-twitch-muted-segments/master/skip-twitch-muted-segments.user.js), and confirm installation. Reload Twitch and open a video recording. The script runs automatically without configuration, using content injection and no privileged APIs.

The authoritative source is `skip-twitch-muted-segments.src.ts`. All authored executable files, including fixtures, tests, build helpers, and the test-sensitivity check, use strict TypeScript. Node.js 24 and locked dependencies compile an ES2022 classic script with esbuild and minify it with Terser. The generated `.user.js` preserves the source metadata and version.

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run build
npm run check
```

`npm run check` runs type-aware linting, strict type checking, JavaScript syntax and metadata-preserving build reproducibility checks, 44 browser tests with real media, and sensitivity checks proving both generated artifacts reject removal of channel-recording URL support or paused-playback protection. GitHub Actions runs the same commands on pushes and pull requests.

The browser tests exercise the readable compiled artifact and the minified distribution with real media elements and seekbar fixtures based on inspected Twitch markup. They cover adjacent muted ranges, translucent and invisible markers, unsupported non-HTML markers, paused playback and manual seeking, both recording URL forms, duration mismatch, dynamic ranges, repeated execution, SPA navigation, late and replaced players, and idle work after player removal.

All authored TypeScript, including tests and helpers, uses `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and type-aware unsafe-operation lint rules. `allowJs` is disabled. `skipLibCheck` applies only to overlapping third-party browser declarations; authored files remain checked. Dependencies and tool versions are pinned in `package-lock.json`.
