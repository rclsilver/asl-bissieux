import { Position } from '../types/position.type';

export declare class Candidat {
  firstName: string;
  lastName: string;
  pictureUrl: string;
  age?: number;
  jobTitle?: string;
  description: string;
  positions: Position[];
}
