import { Component, Input, OnInit } from '@angular/core';
import { MenuLink } from '../../models/menu-link';

@Component({
  selector: 'app-horizontal-nav',
  templateUrl: './horizontal-nav.component.html',
  styleUrls: ['./horizontal-nav.component.scss'],
})
export class HorizontalNavComponent {
  @Input() links: MenuLink[] = [];
}
