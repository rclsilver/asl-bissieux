import { provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersModule } from '../../users.module';
import { UserFormComponent } from './user-form.component';

describe('Account permissions independently of access decisions', () => {
  let http: HttpTestingController;
  const dialog = { close: vi.fn() };
  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [UsersModule, NoopAnimationsModule],
      providers: [
        provideZoneChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            user: {
              id: 'user',
              username: 'pending@example.invalid',
              enabled: false,
              admin: false,
              access_status: 'pending',
              actions: ['legacy.Unknown'],
              updated_at: '2026-10-20T00:00:00Z',
            },
          },
        },
        { provide: MatDialogRef, useValue: dialog },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('preserves existing permissions after a catalogue error, retries and sends only one protected save', () => {
    const f = TestBed.createComponent(UserFormComponent);
    f.detectChanges();
    http
      .expectOne('/api/auth/actions')
      .flush({}, { status: 500, statusText: 'Error' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain(
      'Les droits existants sont conservés'
    );
    expect(f.componentInstance.form.value.actions).toEqual(['legacy.Unknown']);
    f.componentInstance.submit();
    http.expectNone('/api/auth/users/user');
    f.componentInstance.loadActions();
    http.expectOne('/api/auth/actions').flush(['budget.CreatePayment']);
    f.detectChanges();
    f.componentInstance.form.controls['admin'].setValue(true);
    f.componentInstance.submit();
    f.componentInstance.submit();
    const req = http.expectOne('/api/auth/users/user');
    expect(req.request.body).toEqual(
      expect.objectContaining({
        enabled: false,
        admin: true,
        actions: ['legacy.Unknown'],
        expected_updated_at: '2026-10-20T00:00:00Z',
      })
    );
    expect(req.request.body.access_decision).toBeUndefined();
    req.flush(
      { message: 'Le dernier administrateur doit rester actif.' },
      { status: 400, statusText: 'Invalid' }
    );
    f.detectChanges();
    expect(f.componentInstance.form.enabled).toBe(true);
    expect(f.componentInstance.form.value.admin).toBe(true);
    expect(dialog.close).not.toHaveBeenCalled();
    expect(f.nativeElement.textContent).toContain('dernier administrateur');
  });
});
