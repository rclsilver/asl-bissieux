// Form values are numbers; the API remains the authority for exact decimals.
export function validMoneyInput(value: unknown): boolean {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 9999999999.99) {
    return false;
  }
  return /^\d+(\.\d{1,2})?$/.test(String(value));
}
