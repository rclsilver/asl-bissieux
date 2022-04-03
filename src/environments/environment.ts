// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import { Position } from 'src/app/types/position.type';
import { Candidat } from '../app/models/candidat.model';

const candidats: Candidat[] = [
  {
    firstName: 'John',
    lastName: 'Doe',
    pictureUrl: 'assets/pictures/thomas.betrancourt.jpg',
    age: 42,
    jobTitle: 'Web Developer',
    positions: [
      Position.PRESIDENT,
      Position.VICE_PRESIDENT,
      Position.SECRETAIRE,
    ],
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  },
  {
    firstName: 'Jane',
    lastName: 'Doe',
    pictureUrl: 'https://fakeimg.pl/700x400/ffff00,128/000,255',
    jobTitle: 'Web Designer',
    positions: [Position.TRESORIER],
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  },
  {
    firstName: 'Jean',
    lastName: 'Doe',
    pictureUrl: 'https://fakeimg.pl/200x350/ff00ff,128/000,255',
    jobTitle: 'Web Designer',
    positions: [Position.VICE_PRESIDENT, Position.TRESORIER],
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  },
  {
    firstName: 'Sylvie',
    lastName: 'Doe',
    pictureUrl: 'https://fakeimg.pl/400x700/ffaaff,128/000,255',
    jobTitle: 'Web Designer',
    positions: [Position.VICE_PRESIDENT],
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  },
  {
    firstName: 'Tux',
    lastName: 'Doe',
    pictureUrl: 'https://fakeimg.pl/800x1400/e5baf0,128/000,255',
    jobTitle: 'Web Designer',
    positions: [Position.PRESIDENT],
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  },
];

export const environment = {
  production: false,
  candidats: candidats,
};
