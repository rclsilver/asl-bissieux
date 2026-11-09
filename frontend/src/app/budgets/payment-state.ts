import { APISchemas } from '../core/api/openapi';

export enum PaymentState {
  Done = 1,
  Doing = 2,
  Waiting = 3,
  Overpaid = 4,
}

export function paymentState(cotisation: APISchemas['ModelsCotisationResult']): PaymentState {
  // The server compares exact decimals, including historical fractions of cents.
  if ([PaymentState.Done, PaymentState.Doing, PaymentState.Waiting, PaymentState.Overpaid].includes(cotisation.payment_state!)) {
    return cotisation.payment_state!;
  }
  const amount = cotisation.amount ?? 0;
  const paid = cotisation.paid ?? 0;

  if (paid > amount) {
    return PaymentState.Overpaid;
  }

  if (paid === amount) {
    return PaymentState.Done;
  }

  return paid >= amount / 2 ? PaymentState.Doing : PaymentState.Waiting;
}

export function paymentClass(cotisation: APISchemas['ModelsCotisationResult']): string {
  switch (paymentState(cotisation)) {
    case PaymentState.Overpaid: return 'payment-overpaid';
    case PaymentState.Done: return 'payment-done';
    case PaymentState.Doing: return 'payment-doing';
    default: return 'payment-waiting';
  }
}
