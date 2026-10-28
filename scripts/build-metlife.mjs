import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFileSync(resolve(root, name), 'utf8');
const data = JSON.stringify(JSON.parse(read('metlife/fixtures.json'))).replace(/</g, '\\u003c');
let html = read('metlife/template.html');
for (const [token, content] of [
  ['__STYLES__', read('metlife/styles.css')],
  ['__FIXTURES__', data], ['__MODEL__', read('metlife/model.cjs')], ['__APP__', read('metlife/app.js') + '\n;globalThis.MetlifeCalibration=' + read('metlife/calibration.json') + ';\n' + read('metlife/customer-model.cjs') + '\n' + read('metlife/customer.js')]
]) {
  if (html.split(token).length !== 2) throw new Error('Template marker missing or duplicated: ' + token);
  html = html.replace(token, () => content);
}
writeFileSync(resolve(root, 'metlife-variable-term.html'), html);
console.log('Built metlife-variable-term.html (standalone, no external assets)');
