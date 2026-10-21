import { provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject, of, BehaviorSubject } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { NotificationsService } from '../shared/services/notifications.service';
import { MailingsModule } from './mailings.module';
import { MailingsComponent } from './mailings.component';
const preview = '/api/mailing-lists/preview',
  sync = '/api/mailing-lists/sync';
const plan = {
  configured: true,
  domain: 'example.invalid',
  token: 'one',
  can_apply: true,
  invalid: [],
  lists: [
    {
      group: 'membres',
      name: 'membres',
      add: ['alice@example.invalid'],
      remove: ['former@example.invalid'],
      expected: ['alice@example.invalid'],
      current: ['former@example.invalid'],
      pending_tasks: [],
    },
    {
      group: 'bureau',
      name: 'bureau',
      add: [],
      remove: [],
      expected: [],
      current: [],
      pending_tasks: [],
    },
  ],
};
describe('Reviewed OVH list synchronization', () => {
  let http: HttpTestingController;
  let administrator: BehaviorSubject<boolean>;
  let notifications: any;
  beforeEach(async () => {
    administrator = new BehaviorSubject(true);
    notifications = {
      showConfirm: vi.fn(() => ({ afterClosed: () => of(true) })),
    };
    await TestBed.configureTestingModule({
      imports: [MailingsModule, NoopAnimationsModule],
      providers: [
        provideZoneChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { administrator$: administrator } },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('clears administrative data and cancels a read when access is revoked', () => {
    const f = TestBed.createComponent(MailingsComponent);
    f.detectChanges();
    const pending = http.expectOne(preview);
    administrator.next(false);
    expect(pending.cancelled).toBe(true);
    f.detectChanges();
    expect(f.componentInstance.plan).toBeNull();
    f.componentInstance.refresh();
    http.expectNone(preview);
    administrator.next(true);
    http.expectOne(preview).flush(plan);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('former@example.invalid');
    administrator.next(false);
    f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('former@example.invalid');
  });
  it('distinguishes missing configuration and read failure, and retries without applying changes', () => {
    const f = TestBed.createComponent(MailingsComponent);
    f.detectChanges();
    http
      .expectOne(preview)
      .flush({ configured: false, lists: [], invalid: [] });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('reste à configurer');
    f.componentInstance.refresh();
    http
      .expectOne(preview)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Impossible de lire');
    f.componentInstance.refresh();
    http.expectOne(preview).flush(plan);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('alice@example.invalid');
    http.expectNone(sync);
  });
  it('rejects an obsolete confirmation, blocks double submits and reports pending tasks honestly', () => {
    const f = TestBed.createComponent(MailingsComponent);
    f.detectChanges();
    http.expectOne(preview).flush(plan);
    const old = new Subject<boolean>();
    notifications.showConfirm.mockReturnValue({ afterClosed: () => old });
    f.componentInstance.sync();
    f.componentInstance.refresh();
    http.expectOne(preview).flush({ ...plan, token: 'two' });
    old.next(true);
    old.complete();
    http.expectNone(sync);
    notifications.showConfirm.mockReturnValue({ afterClosed: () => of(true) });
    f.componentInstance.sync();
    f.componentInstance.sync();
    const r = http.expectOne(sync);
    expect(r.request.body.token).toBe('two');
    r.flush({
      verified: false,
      message: 'Demandes acceptées par OVH.',
      plan: {
        ...plan,
        can_apply: false,
        lists: [{ ...plan.lists[0], pending_tasks: [123] }, plan.lists[1]],
      },
    });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain(
      'OVH traite encore des tâches'
    );
    expect(f.nativeElement.textContent).not.toContain(
      'Les deux listes sont vérifiées à jour'
    );
    f.componentInstance.sync();
    http.expectNone(sync);
  });
  it('clears an uncertain result and requires a fresh preview before retry', () => {
    const f = TestBed.createComponent(MailingsComponent);
    f.detectChanges();
    http.expectOne(preview).flush(plan);
    f.componentInstance.sync();
    http.expectOne(sync).flush({}, { status: 400, statusText: 'Stale' });
    f.detectChanges();
    expect(f.componentInstance.plan).toBeNull();
    expect(f.nativeElement.textContent).toContain('Actualise les listes');
    f.componentInstance.sync();
    http.expectNone(sync);
    f.componentInstance.refresh();
    http.expectOne(preview).flush({
      ...plan,
      can_apply: false,
      lists: plan.lists.map((l) => ({
        ...l,
        add: [],
        remove: [],
        current: l.expected,
      })),
    });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain(
      'Les deux listes sont vérifiées à jour'
    );
  });
});
