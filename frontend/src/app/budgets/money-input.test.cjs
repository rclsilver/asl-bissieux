const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'money-input.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const helper = { exports: {} };
new Function('exports', compiled)(helper.exports);

test('positive cent amounts, including the supported limit', () => {
  for (const amount of [0.01, 0.1, 0.3, 1.1, 2, 100.99, 9999999999.99]) {
    assert.equal(helper.exports.validMoneyInput(amount), true, `${amount}`);
  }
});
test('fractions of cents, zero, negative and invalid values are rejected', () => {
  for (const amount of [0, -1, 0.001, 1.234, 10000000000, NaN, Infinity, null, undefined, '', '1.23']) {
    assert.equal(helper.exports.validMoneyInput(amount), false, `${amount}`);
  }
});
