import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, '..', 'dist');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

for (const file of walk(dist).filter((p) => p.endsWith('.html'))) {
  let html = fs.readFileSync(file, 'utf8');

  // Sample data only contains generic source categories, not real citations.
  // Do not display a blanket source declaration. Real quoted media should be
  // added later as an explicit, article-specific 「引用：媒体名」 citation.
  html = html.replace(/<p class="news-citation">[\s\S]*?<\/p>/g, '');

  fs.writeFileSync(file, html);
}

console.log('Postprocess complete: generic source declarations removed');
