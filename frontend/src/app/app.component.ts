import { Component, OnInit } from '@angular/core';
import { AuthService } from './core/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  readonly loading$ = this._auth.loading$;
  readonly active$ = this._auth.active$;
  readonly administrator$ = this._auth.administrator$;

  constructor(private _auth: AuthService, private _router: Router) {}

  ngOnInit(): void {
    this._auth
      .runInitialLoginSequence()
      .then(() => this._router.navigate(['/']));
  }
}
