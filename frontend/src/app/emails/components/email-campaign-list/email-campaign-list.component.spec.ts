import { provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatPaginator } from '@angular/material/paginator';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from 'src/app/core/services/auth.service';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { EmailsModule } from '../../emails.module';
import { EmailCampaignListComponent } from './email-campaign-list.component';

const first = {
  id: 'first-campaign',
  title: 'Dernière campagne',
  created_at: '2026-02-01T12:00:00Z',
  counts: {
    total: 5,
    successful: 2,
    waiting: 1,
    error: 1,
    unknown: 1,
    sending: 0,
  },
};
const older = {
  ...first,
  id: 'older-campaign',
  title: 'Ancienne campagne',
  created_at: '2026-01-01T12:00:00Z',
};
const path = '/api/email/campaigns';

describe('Server-paginated campaigns', () => {
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailsModule, NoopAnimationsModule],
      providers: [
        provideZoneChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { allowed$: () => of(true) } },
        {
          provide: NotificationsService,
          useValue: {
            showConfirm: vi.fn(() => ({ afterClosed: () => of(true) })),
            showDialog: vi.fn(),
          },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function request() {
    return http.expectOne((request) => request.url === path);
  }
  function setup() {
    const fixture = TestBed.createComponent(EmailCampaignListComponent);
    fixture.detectChanges();
    const initial = request();
    expect(initial.request.params.get('page')).toBe('1');
    expect(initial.request.params.get('page_size')).toBe('25');
    expect(initial.request.params.get('sort')).toBe('created_at');
    expect(initial.request.params.get('direction')).toBe('desc');
    initial.flush({ items: [first, older], page: 1, page_size: 25, total: 26 });
    fixture.detectChanges();
    return fixture;
  }
  it('uses the whole dataset for search and sort, resets pages and cancels obsolete responses', async () => {
    const fixture = setup(),
      component = fixture.componentInstance,
      table = component.table;
    const paginator = fixture.debugElement.query(By.directive(MatPaginator))
      .componentInstance as MatPaginator;
    expect(table.sort.active).toBe('created_at');
    expect(table.sort.direction).toBe('desc');
    expect(
      fixture.nativeElement.querySelector('tbody tr').textContent
    ).toContain(first.title);
    expect(fixture.nativeElement.textContent).toContain('2 envoyés');
    expect(paginator._intl.itemsPerPageLabel).toBe('Lignes par page :');
    paginator.nextPage();
    const obsolete = request();
    expect(obsolete.request.params.get('page')).toBe('2');
    table.search.show();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      'app-search-input input'
    ) as HTMLInputElement;
    input.value = 'Échéances';
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(obsolete.cancelled).toBe(true);
    const search = request();
    expect(search.request.params.get('query')).toBe('Échéances');
    expect(search.request.params.get('page')).toBe('1');
    search.flush({
      items: [{ ...first, title: 'Échéances annuelles' }],
      page: 1,
      page_size: 25,
      total: 1,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('app-search-input input')).toBe(
      input
    );
    expect(document.activeElement).toBe(input);
    table.sort.sort({ id: 'title', start: 'asc', disableClear: true });
    const sorted = request();
    expect(sorted.request.params.get('sort')).toBe('title');
    expect(sorted.request.params.get('direction')).toBe('asc');
    expect(sorted.request.params.get('query')).toBe('Échéances');
    sorted.flush({ items: [first], page: 1, page_size: 25, total: 1 });
    fixture.detectChanges();
    // The server response remains authoritative; no second local filter is applied.
    expect(
      fixture.nativeElement.querySelector('tbody tr').textContent
    ).toContain(first.title);
    component.datasource.setPage(0, 10);
    const resized = request();
    expect(resized.request.params.get('page_size')).toBe('10');
    expect(resized.request.params.get('page')).toBe('1');
    resized.flush({ items: [first], page: 1, page_size: 10, total: 1 });
    fixture.detectChanges();
    expect(paginator.pageSize).toBe(10);
  });
  it('accepts a clamped page after deletion and recovers from errors without exposing details', () => {
    const fixture = setup(),
      component = fixture.componentInstance;
    const paginator = fixture.debugElement.query(By.directive(MatPaginator))
      .componentInstance as MatPaginator;
    paginator.nextPage();
    request().flush({ items: [older], page: 2, page_size: 25, total: 26 });
    fixture.detectChanges();
    component.delete(older);
    http
      .expectOne('/api/email/campaigns/older-campaign')
      .flush(null, { status: 204, statusText: 'No Content' });
    const refreshed = request();
    expect(refreshed.request.params.get('page')).toBe('2');
    refreshed.flush({ items: [first], page: 1, page_size: 25, total: 25 });
    fixture.detectChanges();
    expect(paginator.pageIndex).toBe(0);
    expect(paginator.hasNextPage()).toBe(false);
    component.refresh();
    request().flush(
      { error: 'PRIVATE_SERVER_DETAIL' },
      { status: 500, statusText: 'Failure' }
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Impossible de charger'
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'PRIVATE_SERVER_DETAIL'
    );
    expect(fixture.nativeElement.querySelector('mat-paginator')).toBeNull();
    component.refresh();
    request().flush({ items: [], page: 1, page_size: 25, total: 0 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aucune donnée');
    expect(fixture.nativeElement.textContent).toContain('0 résultat');
  });
});
