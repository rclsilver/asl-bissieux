import { APISchemas } from '../core/api/openapi';

type Member = APISchemas['ModelsMember'];
type Unit = APISchemas['ModelsUnit'];

export function directoryText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[’'\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function memberName(member: Member): string {
  return (
    [member.first_name, member.last_name].filter(Boolean).join(' ') ||
    'Membre sans nom'
  );
}
export function sortedMemberUnits(member: Member): Unit[] {
  return [...(member.units ?? [])].sort(
    (a, b) => (a.number ?? 0) - (b.number ?? 0)
  );
}
export function memberOwnsUnit(member: Member, unit: Unit): boolean {
  return (member.units ?? []).some((owned) =>
    owned.id && unit.id
      ? owned.id === unit.id
      : owned.number !== undefined && owned.number === unit.number
  );
}
function termsMatch(text: string, query: string): boolean {
  return directoryText(query)
    .split(' ')
    .filter(Boolean)
    .every((term) => text.includes(term));
}
export function memberMatches(member: Member, query: string): boolean {
  const exactLot = /^lot\s*(\d+)$/.exec(directoryText(query));
  if (exactLot)
    return (member.units ?? []).some(
      (unit) => unit.number === Number(exactLot[1])
    );
  const text = directoryText(
    [
      member.first_name,
      member.last_name,
      member.email,
      member.phone_number,
      member.phone_number?.replace(/\D/g, ''),
      member.address,
      ...(member.units ?? []).flatMap((unit) => [unit.number, unit.address]),
    ]
      .filter((value) => value !== undefined && value !== null)
      .join(' ')
  );
  return termsMatch(text, query);
}
export function unitMatches(unit: Unit, query: string): boolean {
  const exactLot = /^lot\s*(\d+)$/.exec(directoryText(query));
  return exactLot
    ? unit.number === Number(exactLot[1])
    : termsMatch(
        directoryText(`${unit.number ?? ''} ${unit.address ?? ''}`),
        query
      );
}
export function compareMembers(a: Member, b: Member): number {
  return (
    String(a.last_name ?? '').localeCompare(String(b.last_name ?? ''), 'fr', {
      sensitivity: 'base',
    }) ||
    String(a.first_name ?? '').localeCompare(String(b.first_name ?? ''), 'fr', {
      sensitivity: 'base',
    }) ||
    String(a.id ?? '').localeCompare(String(b.id ?? ''))
  );
}
