import { describe, expect, it } from 'vitest';
import {
  compareMembers,
  memberMatches,
  memberOwnsUnit,
  unitMatches,
} from './member-directory';

const member = {
  id: 'member-a',
  first_name: 'Élodie',
  last_name: 'Cœur-Dupont',
  phone_number: '06 12 34 56 78',
  email: 'elodie@example.invalid',
  units: [
    { id: 'unit-a', number: 12, address: 'Allée du Chêne' },
    { id: 'unit-b', number: 112 },
  ],
};
describe('Member directory matching', () => {
  it('matches names across fields regardless of accents, ligatures, case and word order', () => {
    for (const query of [
      'ELODIE',
      'coeur elodie',
      'Dupont Élodie',
      'cheNE',
      '061234',
    ])
      expect(memberMatches(member, query)).toBe(true);
    expect(memberMatches(member, 'Paul')).toBe(false);
    expect(memberMatches({ first_name: 'Zoé' }, 'zoe')).toBe(true);
    expect(memberMatches({}, '')).toBe(true);
  });
  it('supports an exact lot query and identifies relations by ID before number', () => {
    expect(memberMatches(member, 'lot 12')).toBe(true);
    expect(memberMatches({ units: [{ number: 112 }] }, 'lot 12')).toBe(false);
    expect(memberOwnsUnit(member, { id: 'unit-a', number: 999 })).toBe(true);
    expect(memberOwnsUnit(member, { id: 'other-unit', number: 12 })).toBe(
      false
    );
    expect(unitMatches({ number: 12, address: 'Rue du Chêne' }, 'chene')).toBe(
      true
    );
    expect(unitMatches({ number: 112 }, 'lot 12')).toBe(false);
  });
  it('sorts names and equal names deterministically and handles absent coordinates', () => {
    const first = { id: 'a', first_name: 'Alice', last_name: 'Dupont' };
    const second = { id: 'b', first_name: 'Alice', last_name: 'Dupont' };
    expect(compareMembers(first, second)).toBeLessThan(0);
    expect(compareMembers({}, first)).toBeLessThan(0);
    expect(memberMatches({ first_name: 'Alice', units: [] }, 'alice')).toBe(
      true
    );
  });
});
