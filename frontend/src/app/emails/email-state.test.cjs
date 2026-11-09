const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'email-state.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const helper = { exports: {} };
new Function('exports', compiled)(helper.exports);
const { canSendEmail, canResetEmail, emailStateLabel } = helper.exports;

for (const [state, send, reset, label] of [
  ['WAITING', true, false, 'En attente'],
  ['ERROR', true, false, 'Erreur'],
  ['SENDING', false, false, 'En cours'],
  ['UNKNOWN', false, true, 'À vérifier'],
  ['SENT', false, true, 'Envoyé'],
  ['READ', false, true, 'Lu'],
  [undefined, false, false, 'État inconnu'],
]) {
  test(`delivery actions for ${state}`, () => {
    assert.equal(canSendEmail(state), send);
    assert.equal(canResetEmail(state), reset);
    assert.equal(emailStateLabel(state), label);
  });
}
