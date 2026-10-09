// Node loader hook for unit tests: Vite's `import url from './asset?url'` becomes a module whose
// default export is the asset path, so browser engine modules can be imported under node:test.
export async function load(url, context, nextLoad) {
  if (url.endsWith('?url')) return { format: 'module', shortCircuit: true, source: `export default ${JSON.stringify(url.replace(/\?url$/, ''))};` };
  return nextLoad(url, context);
}
