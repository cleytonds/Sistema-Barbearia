import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { transform } from 'esbuild';
export async function load(url, context, nextLoad) {
  if (/\.(?:jpg|jpeg|png|webp|svg)$/.test(url)) {
    return { format: 'module', shortCircuit: true, source: `export default ${JSON.stringify(url)}` };
  }
  if (!url.endsWith('.jsx')) return nextLoad(url, context);
  const source = await readFile(new URL(url), 'utf8');
  const result = await transform(source, { loader: 'jsx', format: 'esm', jsx: 'automatic' });
  return { format: 'module', shortCircuit: true, source: result.code };
}
