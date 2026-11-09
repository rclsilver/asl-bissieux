import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { Subject, finalize, takeUntil, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { ApiService } from '../core/services/api.service';
import { APISchemas } from '../core/api/openapi';
import { NotificationsService } from '../shared/services/notifications.service';
@Component({
  selector: 'app-mailings',
  standalone: false,
  templateUrl: './mailings.component.html',
  styleUrls: ['./mailings.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class MailingsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private notifications = inject(NotificationsService);
  private destroyed = new Subject<void>();
  private cancelLoad = new Subject<void>();
  plan: APISchemas['MailingsPlan'] | null = null;
  loading = false;
  busy = false;
  confirming = false;
  error = '';
  message = '';
  verified = false;
  allowed = false;
  ngOnInit() {
    this.auth.administrator$
      .pipe(distinctUntilChanged(), takeUntil(this.destroyed))
      .subscribe((allowed) => {
        this.allowed = allowed;
        this.cancelLoad.next();
        this.plan = null;
        this.error = '';
        this.message = '';
        this.verified = false;
        if (allowed) this.refresh();
      });
  }
  refresh() {
    if (!this.allowed || this.busy) return;
    this.cancelLoad.next();
    this.loading = true;
    this.plan = null;
    this.error = '';
    this.message = '';
    this.verified = false;
    this.api
      .previewMailingLists()
      .pipe(
        takeUntil(this.cancelLoad),
        takeUntil(this.destroyed),
        finalize(() => (this.loading = false))
      )
      .subscribe({
        next: (p) => (this.plan = p),
        error: () =>
          (this.error =
            'Impossible de lire la configuration ou les listes OVH. Vérifie la connexion puis réessaie.'),
      });
  }
  get addCount() {
    return this.plan?.lists?.reduce((n, l) => n + (l.add?.length ?? 0), 0) ?? 0;
  }
  get removeCount() {
    return (
      this.plan?.lists?.reduce((n, l) => n + (l.remove?.length ?? 0), 0) ?? 0
    );
  }
  get pending() {
    return (
      this.plan?.lists?.some((l) => (l.pending_tasks?.length ?? 0) > 0) ?? false
    );
  }
  get synchronized() {
    return (
      !!this.plan?.configured &&
      !this.loading &&
      !this.pending &&
      !this.plan.invalid?.length &&
      this.addCount + this.removeCount === 0
    );
  }
  sync() {
    if (
      !this.allowed ||
      !this.plan?.can_apply ||
      this.loading ||
      this.busy ||
      this.confirming
    )
      return;
    const token = this.plan.token!;
    const empty = this.plan.lists
      ?.filter((l) => l.expected?.length === 0 && (l.remove?.length ?? 0) > 0)
      .map((l) => l.group)
      .join(', ');
    this.confirming = true;
    this.notifications
      .showConfirm({
        title: 'Synchroniser les listes OVH',
        confirmLabel: 'Appliquer les changements',
        message:
          this.addCount +
          ' ajout(s), ' +
          this.removeCount +
          ' retrait(s) sur les listes Membres et Bureau. ' +
          (empty ? 'Ces listes seront vidées : ' + empty + '. ' : '') +
          'Les adresses affichées dans l’aperçu seront appliquées chez OVH.',
        class: 'warn',
      })
      .afterClosed()
      .pipe(takeUntil(this.destroyed))
      .subscribe((ok) => {
        this.confirming = false;
        if (!ok || !this.allowed || this.loading || this.plan?.token !== token)
          return;
        this.busy = true;
        this.error = '';
        this.message = '';
        this.api
          .syncMailingLists(token)
          .pipe(
            takeUntil(this.cancelLoad),
            takeUntil(this.destroyed),
            finalize(() => (this.busy = false))
          )
          .subscribe({
            next: (r) => {
              this.plan = r?.plan ?? null;
              this.verified = r?.verified ?? false;
              this.message = r?.message ?? '';
            },
            error: () => {
              this.plan = null;
              this.error =
                'Le résultat ne peut pas être confirmé ou l’aperçu a changé. Actualise les listes avant toute nouvelle tentative.';
            },
          });
      });
  }
  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
    this.cancelLoad.complete();
  }
}
