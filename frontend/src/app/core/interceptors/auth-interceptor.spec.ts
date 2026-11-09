import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../services/auth.service';
import { ApiService } from '../services/api.service';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { AuthInterceptor } from './auth-interceptor';

describe('Authentication through the migrated HTTP providers', () => {
  let token: BehaviorSubject<string | undefined>;
  let http: HttpTestingController;

  beforeEach(() => {
    token = new BehaviorSubject<string | undefined>(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: AuthService, useValue: { token$: token.asObservable() } },
        { provide: NotificationsService, useValue: {} },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the Google token on the current-user request', () => {
    token.next('local-test-token');
    TestBed.inject(ApiService).getCurrentUser().subscribe();
    const request = http.expectOne('/api/auth/me');
    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer local-test-token'
    );
    request.flush({ enabled: true, admin: false });
  });

  it('does not invent an Authorization header before login', () => {
    TestBed.inject(ApiService).getCurrentUser().subscribe();
    const request = http.expectOne('/api/auth/me');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});
