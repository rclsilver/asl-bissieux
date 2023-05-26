import { Observable } from 'rxjs';

export type MenuLink = {
  label: string;
  icon?: string;
  path: string;
  isAllowed$: Observable<boolean>;
};
