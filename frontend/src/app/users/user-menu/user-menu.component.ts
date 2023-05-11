import { Component } from '@angular/core';
import { AuthService } from 'src/app/core/auth.service';

@Component({
  selector: 'app-user-menu',
  templateUrl: './user-menu.component.html',
  styleUrls: ['./user-menu.component.scss'],
})
export class UserMenuComponent {
  readonly authenticated$ = this._auth.authenticated$;
  readonly active$ = this._auth.active$;
  readonly administrator$ = this._auth.administrator$;
  readonly user$ = this._auth.user$;

  constructor(private _auth: AuthService) {}

  login() {
    return this._auth.login();
  }

  logout() {
    return this._auth.logout();
  }
}
