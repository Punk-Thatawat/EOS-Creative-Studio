// Loads TypeScript source files from src/app/admin/credits as CommonJS modules, without a bundler.
// Relative imports are resolved against the same folder; package imports are provided by `stubs`.
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');

export function transpile(source) {
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
}

export function createLoader(dir, externals) {
  const cache = new Map();
  function load(file) {
    const full = path.resolve(dir, file);
    if (cache.has(full)) return cache.get(full).exports;
    const source = readFileSync(full, 'utf8');
    const moduleObject = { exports: {} };
    cache.set(full, moduleObject);
    const localRequire = (request) => {
      if (request.startsWith('./')) {
        const base = request.replace(/^\.\//, '');
        const candidate = ['.ts', '.tsx'].map((ext) => base + ext).find((name) => existsSync(path.resolve(dir, name)));
        if (!candidate) throw new Error(`Cannot resolve ${request} from ${file}`);
        return load(candidate);
      }
      if (request in externals) return externals[request];
      throw new Error(`Unexpected import "${request}" in ${file}`);
    };
    vm.runInNewContext(transpile(source), { module: moduleObject, exports: moduleObject.exports, require: localRequire });
    return moduleObject.exports;
  }
  return load;
}
