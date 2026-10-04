// ギルドの灯 — 1ファイルにまとめるビルド
//   node guild/build.mjs
//   dist/index.html    … そのままブラウザで開ける単体ファイル
//   dist/artifact.html … claude.ai の Artifact 用（<html>/<head>/<body> を外した版）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');

const html = read('index.html');
const css = read('css/style.css');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const js = scripts.map((src) => `/* ---- ${src} ---- */\n${read(src)}`).join('\n');

const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]+>/)[0];
const body = html.slice(html.indexOf('<!--BODY-->') + 11, html.indexOf('<!--/BODY-->')).trim();
const title = html.match(/<title>[^<]*<\/title>/)[0];
// </script> が JS 文字列に紛れても壊れないように（置換は関数で渡す：JS 内の $' などを解釈させない）
const safeJs = js.replace(/<\/script/gi, '<\\/script');

mkdirSync(join(root, 'dist'), { recursive: true });

const standalone = html
  .replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}\n</style>`)
  .replace(/(<script src="[^"]+"><\/script>\n?)+/, () => `<script>\n${safeJs}\n</script>\n`);
writeFileSync(join(root, 'dist/index.html'), standalone);

const artifact = `<meta charset="utf-8">
${title}
<meta name="theme-color" content="#060a16">
${fonts}
<style>
${css}
</style>
${body}
<script>
${safeJs}
</script>
`;
writeFileSync(join(root, 'dist/artifact.html'), artifact);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + 'KB';
console.log(`dist/index.html ${kb(standalone)} / dist/artifact.html ${kb(artifact)} (${scripts.length} scripts)`);
