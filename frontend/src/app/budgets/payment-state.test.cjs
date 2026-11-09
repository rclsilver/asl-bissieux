const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');

// Execute the actual TypeScript helper without a browser or Angular runtime.
const source = fs.readFileSync(path.join(__dirname, 'payment-state.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const helper = { exports: {} };
new Function('exports', compiled)(helper.exports);
const { paymentState, paymentClass, PaymentState } = helper.exports;

for (const [label, cotisation, state, css] of [
  ['missing paid amount', { amount: 100 }, PaymentState.Waiting, 'payment-waiting'],
  ['no payment', { amount: 100, paid: 0 }, PaymentState.Waiting, 'payment-waiting'],
  ['below half', { amount: 100, paid: 25 }, PaymentState.Waiting, 'payment-waiting'],
  ['just below half', { amount: 100, paid: 49.99 }, PaymentState.Waiting, 'payment-waiting'],
  ['half paid', { amount: 100, paid: 50 }, PaymentState.Doing, 'payment-doing'],
  ['above half', { amount: 100, paid: 75 }, PaymentState.Doing, 'payment-doing'],
  ['fully paid', { amount: 100, paid: 100 }, PaymentState.Done, 'payment-done'],
  ['overpayment to refund', { amount: 100, paid: 120 }, PaymentState.Overpaid, 'payment-overpaid'],
  ['one cent to refund', { amount: 100, paid: 100.01 }, PaymentState.Overpaid, 'payment-overpaid'],
  ['nothing due', { amount: 0, paid: 0 }, PaymentState.Done, 'payment-done'],
]) {
  test(label, () => {
    assert.equal(paymentState(cotisation), state);
    assert.equal(paymentClass(cotisation), css);
  });
}

test('exact server state takes precedence over rounded historical JSON numbers', () => {
  const cotisation = { amount: 33.333333333333336, paid: 33.333333333333336, payment_state: PaymentState.Waiting };
  assert.equal(paymentState(cotisation), PaymentState.Waiting);
  assert.equal(paymentClass(cotisation), 'payment-waiting');
});
