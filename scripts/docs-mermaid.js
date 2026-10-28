/**
 * Post-processes the Compodoc output so the guide's diagrams render:
 * copies Mermaid into the docs (works offline) and loads it on every page
 * that contains a <pre class="mermaid"> block.
 *
 * Usage: node scripts/docs-mermaid.js [docsFolder]
 */
const fs = require('fs');
const path = require('path');

const out = path.resolve(process.argv[2] ?? 'docs');
const src = require.resolve('mermaid/dist/mermaid.min.js');
fs.copyFileSync(src, path.join(out, 'js', 'mermaid.min.js'));

// Diagrams sit on a light card in both the light and the dark docs theme.
const style = `<style>
  pre.mermaid { background: #fff !important; color: #222; border: 1px solid #dde3ea; border-radius: 10px;
    padding: 18px 12px; text-align: center; overflow-x: auto; white-space: pre;
    height: auto !important; max-height: none !important;
    /* The content area is a flex column: without this the block shrinks to nothing. */
    flex-shrink: 0; }
  pre.mermaid svg { display: block; margin: 0 auto; max-width: 100%; height: auto; }
  .content table { margin: 12px 0; }
</style>`;

const init = `mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  flowchart: { curve: 'basis' },
  themeVariables: { fontFamily: 'Roboto, system-ui, sans-serif', fontSize: '15px' },
});`;

let pages = 0;
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name);
    if (e.isDirectory()) walk(file);
    else if (e.name.endsWith('.html')) {
      let html = fs.readFileSync(file, 'utf8');
      if (!html.includes('class="mermaid"') || html.includes('mermaid.min.js')) continue;
      const rel = path.relative(path.dirname(file), path.join(out, 'js', 'mermaid.min.js')).split(path.sep).join('/');
      html = html.replace('</head>', `${style}\n</head>`);
      html = html.replace('</body>', `<script src="${rel}"></script>\n<script>${init}</script>\n</body>`);
      fs.writeFileSync(file, html);
      pages++;
    }
  }
};
walk(out);
console.log(`Mermaid enabled on ${pages} page(s) in ${out}`);
