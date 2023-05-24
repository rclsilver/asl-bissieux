import { Component } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-page',
  templateUrl: './page.component.html',
  styleUrls: ['./page.component.scss'],
})
export class PageComponent {
  readonly isHandset$ = this._breakpoints.observe(Breakpoints.Handset).pipe(
    map((result) => result.matches),
    shareReplay()
  );

  readonly authenticated$ = this._auth.authenticated$;
  readonly user$ = this._auth.user$;
  readonly active$ = this._auth.active$;
  readonly administrator$ = this._auth.administrator$;

  readonly links: {
    label: string;
    icon: string | null;
    path: string;
    allowed$: Observable<boolean>;
  }[] = [
    {
      label: 'Budgets',
      path: '/budgets',
      icon: 'euro-sign',
      allowed$: this.authenticated$,
    },
    {
      label: 'Units',
      path: '/units',
      icon: 'map',
      allowed$: this.authenticated$,
    },
    {
      label: 'Members',
      path: '/members',
      icon: 'users',
      allowed$: this.authenticated$,
    },
    {
      label: 'E-mails',
      path: '/emails',
      icon: 'mail-bulk',
      allowed$: this.authenticated$,
    },
    {
      label: 'Users',
      path: '/users',
      icon: 'key',
      allowed$: this.administrator$,
    },
  ];

  constructor(
    private _breakpoints: BreakpointObserver,
    private _auth: AuthService,
    private _router: Router
  ) {}

  ngOnInit(): void {
    this._auth.authenticated$.subscribe((authenticated) => {
      this._router.navigate(['/']);
    });

    this._auth.init();
  }

  logout() {
    return this._auth.logout().subscribe(() => {});
  }
}
