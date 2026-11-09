import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { isAuthenticated } from './auth.guard';

describe('Route guards during session restoration', () => {
  it('waits for the session before deciding access to a direct budget URL', async () => {
    const loading$ = new BehaviorSubject(true);
    const active$ = new BehaviorSubject(false);
    const rememberReturnPath = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { loading$, active$, rememberReturnPath },
        },
      ],
    });
    const result = TestBed.runInInjectionContext(() =>
      isAuthenticated(
        {} as ActivatedRouteSnapshot,
        { url: '/budgets/test' } as RouterStateSnapshot
      )
    ) as Observable<boolean>;
    const access = firstValueFrom(result);
    expect(rememberReturnPath).not.toHaveBeenCalled();
    active$.next(true);
    loading$.next(false);
    expect(await access).toBe(true);
  });

  it('remembers the requested page when the user needs to sign in', async () => {
    const rememberReturnPath = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            loading$: new BehaviorSubject(false),
            active$: new BehaviorSubject(false),
            rememberReturnPath,
          },
        },
      ],
    });
    const result = TestBed.runInInjectionContext(() =>
      isAuthenticated(
        {} as ActivatedRouteSnapshot,
        { url: '/budgets/test' } as RouterStateSnapshot
      )
    ) as Observable<boolean>;
    expect(await firstValueFrom(result)).toBe(false);
    expect(rememberReturnPath).toHaveBeenCalledWith('/budgets/test');
  });
});
