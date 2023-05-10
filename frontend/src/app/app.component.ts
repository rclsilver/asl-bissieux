import { Component } from '@angular/core';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  constructor(private _auth: AuthService) {}

  login() {
    this._auth.login();
  }

  refresh() {
    this._auth.refresh();
  }

  logout() {
    this._auth.logout();
  }

  readonly authenticated$ = this._auth.authenticated$;
}
