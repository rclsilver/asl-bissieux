import { Component } from '@angular/core';
import { of } from 'rxjs';
import { MenuLink } from '../shared/models/menu-link';

@Component({
  templateUrl: './emails.component.html',
  styleUrls: ['./emails.component.scss'],
})
export class EmailsComponent {
  readonly links: MenuLink[] = [
    {
      label: 'Campaigns',
      icon: 'list',
      path: '/emails/campaigns',
      isAllowed$: of(true),
    },
    {
      label: 'Templates',
      icon: 'cog',
      path: '/emails/templates',
      isAllowed$: of(true),
    },
  ];
}
