import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Subject,
  catchError,
  distinctUntilChanged,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { APISchemas } from '../core/api/openapi';

export type TourStep = APISchemas['TourStep'];
export type TourState = APISchemas['TourState'];

@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly accountChanged = new Subject<void>();
  readonly account = signal('');
  readonly generation = signal(0);
  readonly state = signal<TourState | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly dismissed = signal(false);
  readonly pending = computed(() =>
    (this.state()?.steps ?? []).filter(
      (s) => (s.seen_revision ?? 0) < (s.revision ?? 1)
    )
  );
  readonly offer = computed(
    () => !!this.state() && this.pending().length > 0 && !this.dismissed()
  );

  constructor() {
    this.auth.user$
      .pipe(
        distinctUntilChanged(
          (a, b) =>
            a?.id === b?.id &&
            a?.enabled === b?.enabled &&
            a?.admin === b?.admin &&
            JSON.stringify(a?.actions) === JSON.stringify(b?.actions)
        ),
        tap((user) => {
          this.accountChanged.next();
          this.account.set(user?.enabled ? (user.id ?? '') : '');
          this.state.set(null);
          this.dismissed.set(false);
          this.error.set(false);
          this.loading.set(!!user?.enabled);
          this.generation.update((value) => value + 1);
        }),
        switchMap((user) => (user?.enabled ? this.fetch() : of(null))),
        takeUntilDestroyed()
      )
      .subscribe((state) => {
        this.state.set(state ?? null);
        this.loading.set(false);
      });
  }
  private fetch() {
    return this.api.getTour().pipe(
      catchError(() => {
        this.error.set(true);
        return of(null);
      })
    );
  }
  reload() {
    if (!this.account() || this.loading()) return;
    this.loading.set(true);
    this.error.set(false);
    this.accountChanged.next();
    this.generation.update((value) => value + 1);
    this.fetch()
      .pipe(takeUntil(this.accountChanged))
      .subscribe((state) => {
        this.state.set(state ?? null);
        this.loading.set(false);
      });
  }
  seen(step: TourStep) {
    return this.api
      .viewTourStep({
        version: this.state()!.version!,
        step_id: step.id!,
        revision: step.revision!,
      })
      .pipe(
        takeUntil(this.accountChanged),
        tap((state) => {
          this.state.set(state ?? null);
        })
      );
  }
  dismiss() {
    this.dismissed.set(true);
  }
}
