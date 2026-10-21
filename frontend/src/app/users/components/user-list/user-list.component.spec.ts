import { provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from 'src/app/core/services/auth.service';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { UsersModule } from '../../users.module';
import { UserListComponent } from './user-list.component';

describe('Explicit account access decisions', () => {
  let http: HttpTestingController;
  let confirm: Subject<boolean>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const notifications = { showConfirm: vi.fn(), showForm: vi.fn() };
  beforeEach(async () => {
    confirm = new Subject();
    params = new BehaviorSubject(convertToParamMap({ status: 'pending' }));
    notifications.showConfirm.mockReturnValue({ afterClosed: () => confirm });
    await TestBed.configureTestingModule({
      imports: [UsersModule, NoopAnimationsModule],
      providers: [
        provideZoneChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
        {
          provide: AuthService,
          useValue: { administrator$: of(true), refresh: () => of(null) },
        },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('filters from the URL, confirms using a fresh identity and preserves the current permissions', () => {
    const f = TestBed.createComponent(UserListComponent);
    f.detectChanges();
    http
      .expectOne('/api/auth/users?status=pending')
      .flush([
        {
          id: 'user',
          username: 'pending@example.invalid',
          access_status: 'pending',
        },
      ]);
    f.detectChanges();
    f.componentInstance.decide({ id: 'user' }, 'approve');
    f.componentInstance.decide({ id: 'user' }, 'approve');
    http
      .expectOne('/api/auth/users/user')
      .flush({
        id: 'user',
        username: 'verified@example.invalid',
        enabled: false,
        admin: false,
        access_status: 'pending',
        actions: ['budget.CreatePayment'],
        updated_at: '2026-10-21T00:00:00Z',
        identities: [
          { issuer: 'https://accounts.google.com', subject: 'stable' },
        ],
      });
    expect(notifications.showConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('verified@example.invalid (Google)'),
      })
    );
    http.expectNone((r) => r.method === 'PUT');
    confirm.next(true);
    const write = http.expectOne('/api/auth/users/user');
    expect(write.request.body).toEqual(
      expect.objectContaining({
        access_decision: 'approve',
        enabled: true,
        actions: ['budget.CreatePayment'],
        expected_updated_at: '2026-10-21T00:00:00Z',
      })
    );
    write.flush({});
    http.expectOne('/api/auth/users?status=pending').flush([]);
    params.next(convertToParamMap({ status: 'invalid' }));
    http.expectOne('/api/auth/users').flush([]);
    expect(f.componentInstance.status).toBe('');
  });
  it('cancels older filter requests before accepting a new result', () => {
    const f=TestBed.createComponent(UserListComponent);f.detectChanges();const pending=http.expectOne('/api/auth/users?status=pending');
    params.next(convertToParamMap({status:'active'}));const active=http.expectOne('/api/auth/users?status=active');expect(pending.cancelled).toBe(true);
    params.next(convertToParamMap({status:'pending'}));expect(active.cancelled).toBe(true);http.expectOne('/api/auth/users?status=pending').flush([{id:'pending',username:'Pending result',access_status:'pending'}]);f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Pending result');expect(()=>active.flush([{username:'Stale active result'}])).toThrow();expect(f.nativeElement.textContent).not.toContain('Stale active result');
  });
  it('does not confirm a decision when the account status changed', () => {
    const f = TestBed.createComponent(UserListComponent);
    f.detectChanges();
    http.expectOne('/api/auth/users?status=pending').flush([]);
    notifications.showConfirm.mockClear();
    f.componentInstance.decide({ id: 'user' }, 'approve');
    http
      .expectOne('/api/auth/users/user')
      .flush({ id: 'user', access_status: 'active', enabled: true });
    expect(notifications.showConfirm).not.toHaveBeenCalled();
    http.expectOne('/api/auth/users?status=pending').flush([]);
    expect(f.componentInstance.error).toContain('changé');
  });
});
