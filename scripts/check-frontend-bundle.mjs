import { gzipSync } from 'node:zlib';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const dist = new URL('../frontend/dist/assets/', import.meta.url);
const limits = {
  entryGzipBytes: 500 * 1024,
  monacoGzipBytes: 1.2 * 1024 * 1024,
  totalJsGzipBytes: 2 * 1024 * 1024
};

const entries = await readdir(dist);
const jsFiles = entries.filter((file) => file.endsWith('.js') && !file.endsWith('.worker.js'));
if (jsFiles.length === 0) {
  throw new Error('No frontend JS assets found. Run pnpm build first.');
}

const sizes = await Promise.all(
  jsFiles.map(async (file) => {
    const source = await readFile(join(dist.pathname, file));
    return {
      file,
      bytes: source.byteLength,
      gzipBytes: gzipSync(source).byteLength
    };
  })
);

const entryChunks = sizes.filter((item) => /^index-[A-Za-z0-9_-]+\.js$/.test(item.file));
const monacoChunks = sizes.filter((item) => item.file.startsWith('monaco-editor-'));
const totalJsGzipBytes = sizes.reduce((total, item) => total + item.gzipBytes, 0);
const maxEntry = maxBy(entryChunks, (item) => item.gzipBytes);
const maxMonaco = maxBy(monacoChunks, (item) => item.gzipBytes);

const failures = [];
if (!maxEntry) failures.push('Missing entry index-*.js chunk.');
else if (maxEntry.gzipBytes > limits.entryGzipBytes) failures.push(`${maxEntry.file} gzip ${format(maxEntry.gzipBytes)} exceeds ${format(limits.entryGzipBytes)}.`);
if (!maxMonaco) failures.push('Missing async monaco-editor chunk.');
else if (maxMonaco.gzipBytes > limits.monacoGzipBytes) failures.push(`${maxMonaco.file} gzip ${format(maxMonaco.gzipBytes)} exceeds ${format(limits.monacoGzipBytes)}.`);
if (totalJsGzipBytes > limits.totalJsGzipBytes) failures.push(`Total JS gzip ${format(totalJsGzipBytes)} exceeds ${format(limits.totalJsGzipBytes)}.`);

console.log(
  JSON.stringify(
    {
      entry: maxEntry,
      monaco: maxMonaco,
      totalJsGzipBytes,
      limits
    },
    null,
    2
  )
);

if (failures.length > 0) {
  throw new Error(`Bundle budget failed:\n${failures.join('\n')}`);
}

function maxBy(items, select) {
  return items.reduce((best, item) => (!best || select(item) > select(best) ? item : best), undefined);
}

function format(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
