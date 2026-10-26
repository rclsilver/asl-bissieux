import { Component, ChangeDetectionStrategy } from '@angular/core';
import { of } from 'rxjs';
import { MenuLink } from '../shared/models/menu-link';

@Component({
  templateUrl: './emails.component.html',
  styleUrls: ['./emails.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class EmailsComponent {
  readonly links: MenuLink[] = [
    {
      label: 'Campagnes',
      icon: 'list',
      path: '/emails/campaigns',
      isAllowed$: of(true),
    },
    {
      label: 'Modèles',
      icon: 'cog',
      path: '/emails/templates',
      isAllowed$: of(true),
    },
  ];
}
