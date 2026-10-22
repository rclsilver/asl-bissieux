import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { BreakpointObserver } from '@angular/cdk/layout';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-page',
  templateUrl: './page.component.html',
  styleUrls: ['./page.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class PageComponent {
  readonly theme = inject(ThemeService);
  mobileMenuOpen = false;
  readonly isHandset$ = this._breakpoints.observe('(max-width: 1100px)').pipe(
    map((result) => result.matches),
    shareReplay()
  );

  readonly authenticated$ = this._auth.authenticated$;
  readonly user$ = this._auth.user$;
  readonly active$ = this._auth.active$;
  readonly administrator$ = this._auth.administrator$;
  readonly configuration$ = this._auth.configuration$;
  readonly loading$ = this._auth.loading$;
  readonly message$ = this._auth.message$;

  readonly links: {
    label: string;
    icon: string | null;
    path: string;
    allowed$: Observable<boolean>;
  }[] = [
    {
      label: 'Accueil',
      path: '/dashboard',
      icon: 'dashboard',
      allowed$: this.active$,
    },
    {
      label: 'Budgets',
      path: '/budgets',
      icon: 'account_balance_wallet',
      allowed$: this.active$,
    },
    {
      label: 'Lots',
      path: '/units',
      icon: 'map',
      allowed$: this.active$,
    },
    {
      label: 'Membres',
      path: '/members',
      icon: 'groups',
      allowed$: this.active$,
    },
    {
      label: 'E-mails',
      path: '/emails',
      icon: 'mail',
      allowed$: this.active$,
    },
    {
      label: 'Utilisateurs',
      path: '/users',
      icon: 'manage_accounts',
      allowed$: this.administrator$,
    },
    {
      label: 'Listes de diffusion',
      path: '/mailing-lists',
      icon: 'contact_mail',
      allowed$: this.administrator$,
    },
  ];

  constructor(
    private _breakpoints: BreakpointObserver,
    private _auth: AuthService
  ) {}

  ngOnInit(): void {
    this._auth.init();
  }

  skipToContent(event: Event, content: HTMLElement) {
    // Prevent a fragment change: the application uses hash-based routing.
    event.preventDefault();
    content.focus();
  }

  closeMobileMenu(handset: boolean) {
    if (handset) this.mobileMenuOpen = false;
  }

  logout() {
    return this._auth.logout().subscribe({ error: () => {} });
  }

  checkingAccess = false;
  accessTitle(status?: string) {
    return status === 'pending'
      ? 'Compte en attente d’activation'
      : status === 'rejected'
        ? 'Accès refusé'
        : 'Accès désactivé';
  }
  accessMessage(status?: string) {
    return status === 'pending'
      ? 'Ton identité est vérifiée. Un administrateur doit examiner ta demande d’accès.'
      : status === 'rejected'
        ? 'Un administrateur a refusé l’accès à l’application. Contacte le bureau de l’ASL pour faire le point.'
        : 'Ton identité est vérifiée, mais l’accès à l’application est désactivé. Contacte un administrateur pour demander sa réactivation.';
  }
  refreshAccess() {
    if (this.checkingAccess) return;
    this.checkingAccess = true;
    this._auth.refresh().subscribe({
      next: () => (this.checkingAccess = false),
      error: () => (this.checkingAccess = false),
    });
  }
  loginLabel(label?: string): string {
    const provider = label?.trim();
    return provider && provider !== 'Se connecter'
      ? `Continuer avec ${provider}`
      : 'Se connecter';
  }

  reloadPage() {
    window.location.reload();
  }

  login() {
    this._auth.login();
  }
}
