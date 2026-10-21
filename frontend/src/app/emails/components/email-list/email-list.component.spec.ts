import { provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatPaginator } from '@angular/material/paginator';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from 'src/app/core/services/auth.service';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { EmailsModule } from '../../emails.module';
import { EmailListComponent } from './email-list.component';

const waiting = {
  id: 'waiting',
  to: 'waiting@example.invalid',
  state: 'WAITING',
  subject: 'Waiting',
  created_at: '2026-01-01T12:00:00Z',
  has_error: false,
};
const failed = {
  ...waiting,
  id: 'failed',
  to: 'failed@example.invalid',
  state: 'ERROR',
  has_error: true,
};
const sending = { ...waiting, id: 'sending', state: 'SENDING' };
const read = { ...waiting, id: 'read', state: 'READ' };
const rows = [waiting, failed, sending, read];
const campaignPath = '/api/email/campaigns/campaign-test';
const path = campaignPath + '/emails';

describe('Paged email history and safe actions', () => {
  let http: HttpTestingController;
  let notifications: {
    showConfirm: ReturnType<typeof vi.fn>;
    showForm: ReturnType<typeof vi.fn>;
    showDialog: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
  };
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(async () => {
    notifications = {
      showConfirm: vi.fn(() => ({ afterClosed: () => of(true) })),
      showForm: vi.fn(() => ({ afterClosed: () => of(false) })),
      showDialog: vi.fn(),
      show: vi.fn(),
    };
    queryParams = new BehaviorSubject(convertToParamMap({}));
    params = new BehaviorSubject(convertToParamMap({ id: 'campaign-test' }));
    await TestBed.configureTestingModule({
      imports: [EmailsModule, NoopAnimationsModule],
      providers: [
        provideZoneChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: params.asObservable(),
            queryParamMap: queryParams,
          },
        },
        { provide: AuthService, useValue: { allowed$: () => of(true) } },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });
  afterEach(() => http.verify());
  function request() {
    return http.expectOne((request) => request.url === path);
  }
  function flushPage(items = rows, page = 1, total = 30) {
    request().flush({ items, page, page_size: 25, total });
  }
  function setup() {
    const fixture = TestBed.createComponent(EmailListComponent);
    fixture.detectChanges();
    http
      .expectOne(campaignPath)
      .flush({ id: 'campaign-test', title: 'Campaign' });
    fixture.detectChanges();
    const initial = request();
    expect(initial.request.params.get('page')).toBe('1');
    expect(initial.request.params.get('sort')).toBe('created_at');
    initial.flush({ items: rows, page: 1, page_size: 25, total: 30 });
    fixture.detectChanges();
    return fixture;
  }
  it('restores an error filter from the dashboard URL and updates it without reloading campaign metadata', () => {
    queryParams.next(convertToParamMap({ state: 'ERROR' }));
    const f = TestBed.createComponent(EmailListComponent);
    f.detectChanges();
    http
      .expectOne('/api/email/campaigns/campaign-test')
      .flush({ id: 'campaign-test', title: 'Fixture' });
    f.detectChanges();
    const initial = request();
    expect(initial.request.params.get('state')).toBe('ERROR');
    initial.flush({ items: [], page: 1, page_size: 25, total: 0 });
    f.detectChanges();
    queryParams.next(convertToParamMap({ state: 'WAITING' }));
    const filtered = request();
    expect(filtered.request.params.get('state')).toBe('WAITING');
    filtered.flush({ items: [], page: 1, page_size: 25, total: 0 });
    http.expectNone('/api/email/campaigns/campaign-test');
  });
  it('clears selection immediately and disables stale rows while changing page, state and recipient', async () => {
    const fixture = setup(),
      page = fixture.componentInstance,
      table = page.table;
    const paginator = fixture.debugElement.query(By.directive(MatPaginator))
      .componentInstance as MatPaginator;
    table.selected.toggle(waiting);
    paginator.nextPage();
    fixture.detectChanges();
    let selected: unknown[] = [];
    table.selected.selected$.subscribe((rows) => (selected = rows));
    expect(selected).toEqual([]);
    expect(
      fixture.nativeElement.querySelector('.table-scroll').hasAttribute('inert')
    ).toBe(true);
    page.delete(waiting);
    page.bulkSend();
    expect(notifications.showConfirm).not.toHaveBeenCalled();
    const obsolete = request();
    expect(obsolete.request.params.get('page')).toBe('2');
    page.setState('ERROR');
    expect(obsolete.cancelled).toBe(true);
    const filter = request();
    expect(filter.request.params.get('state')).toBe('ERROR');
    expect(filter.request.params.get('page')).toBe('1');
    filter.flush({ items: [failed], page: 1, page_size: 25, total: 1 });
    fixture.detectChanges();
    table.selected.toggle(failed);
    table.search.show();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      'app-search-input input'
    ) as HTMLInputElement;
    input.value = 'failed';
    input.dispatchEvent(new Event('input'));
    expect(selected).toEqual([]);
    expect(page.loading).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const search = request();
    expect(search.request.params.get('query')).toBe('failed');
    expect(search.request.params.get('state')).toBe('ERROR');
    search.flush({ items: [failed], page: 1, page_size: 25, total: 1 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-search-input input')).toBe(
      input
    );
    expect(fixture.nativeElement.textContent).toContain(
      'uniquement sur la page'
    );
  });
  it('freezes confirmed recipients and rejects confirmations from an obsolete page', () => {
    const fixture = setup(),
      page = fixture.componentInstance;
    const confirm = new Subject<boolean>();
    notifications.showConfirm.mockReturnValueOnce({
      afterClosed: () => confirm,
    });
    page.table.selected.toggle(waiting);
    page.bulkSend();
    page.refresh();
    confirm.next(true);
    confirm.complete();
    expect(notifications.showForm).not.toHaveBeenCalled();
    expect(notifications.showDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'La liste a changé' })
    );
    flushPage();
    fixture.detectChanges();
    const closed = new Subject<boolean>();
    notifications.showForm.mockReturnValueOnce({ afterClosed: () => closed });
    for (const row of [waiting, failed, sending])
      page.table.selected.toggle(row);
    page.bulkSend();
    const config = notifications.showForm.mock.calls[0][1];
    expect(config.data.emails.map((row: { id: string }) => row.id)).toEqual([
      'waiting',
      'failed',
    ]);
    expect(config.maxWidth).toBe('calc(100vw - 2rem)');
    expect(page.busyAction).toBe(true);
    const confirms = notifications.showConfirm.mock.calls.length;
    page.delete(failed);
    expect(notifications.showConfirm).toHaveBeenCalledTimes(confirms);
    closed.next(false);
    closed.complete();
    flushPage();
    fixture.detectChanges();
    expect(page.busyAction).toBe(false);
    http.expectNone((request) => request.method === 'POST');
  });
  it('loads full previews and delivery errors only on request, cancels obsolete detail and handles failure', () => {
    const fixture = setup(),
      page = fixture.componentInstance;
    http.expectNone('/api/email/waiting');
    page.show(waiting);
    page.show(waiting);
    http.expectOne('/api/email/waiting').flush({
      id: 'waiting',
      subject: 'Full subject',
      message: '<p>Full body</p>',
    });
    expect(notifications.show).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: { subject: 'Full subject', message: '<p>Full body</p>' },
      })
    );
    page.showError(failed);
    http
      .expectOne('/api/email/failed/status')
      .flush({ id: 'failed', state: 'ERROR', error: 'SMTP fixture failure' });
    expect(notifications.showDialog).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'SMTP fixture failure' })
    );
    page.show(waiting);
    const obsolete = http.expectOne('/api/email/waiting');
    page.setState('READ');
    expect(obsolete.cancelled).toBe(true);
    flushPage([read], 1, 1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Signal d’ouverture');
    page.show(read);
    http
      .expectOne('/api/email/read')
      .flush(
        { message: 'PRIVATE_SERVER_DETAIL' },
        { status: 500, statusText: 'Failure' }
      );
    expect(JSON.stringify(notifications.showDialog.mock.calls)).not.toContain(
      'PRIVATE_SERVER_DETAIL'
    );
    expect(page.previewingId).toBeNull();
  });
  it('shows a retryable metadata error and recovers without presenting it as an empty campaign', () => {
    const fixture = TestBed.createComponent(EmailListComponent);
    fixture.detectChanges();
    http
      .expectOne(campaignPath)
      .flush(
        { message: 'PRIVATE_SERVER_DETAIL' },
        { status: 500, statusText: 'Failure' }
      );
    fixture.detectChanges();
    expect(fixture.componentInstance.campaignError).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'Impossible de charger cette campagne'
    );
    http.expectNone((request) => request.url === path);
    fixture.componentInstance.reloadCampaign();
    http
      .expectOne(campaignPath)
      .flush({ id: 'campaign-test', title: 'Recovered' });
    fixture.detectChanges();
    flushPage([], 1, 0);
    fixture.detectChanges();
    expect(fixture.componentInstance.campaignError).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Aucune donnée');
  });
  it('cancels an old preview before the next campaign metadata arrives', () => {
    const fixture = setup(),
      page = fixture.componentInstance;
    page.table.selected.toggle(waiting);
    page.show(waiting);
    const old = http.expectOne('/api/email/waiting');
    params.next(convertToParamMap({ id: 'next-campaign' }));
    expect(old.cancelled).toBe(true);
    expect(page.previewingId).toBeNull();
    expect(notifications.show).not.toHaveBeenCalled();
    let selected: unknown[] = [];
    page.table.selected.selected$.subscribe((rows) => (selected = rows));
    expect(selected).toEqual([]);
    http
      .expectOne('/api/email/campaigns/next-campaign')
      .flush({ id: 'next-campaign', title: 'Next campaign' });
    fixture.detectChanges();
    http
      .expectOne(
        (request) => request.url === '/api/email/campaigns/next-campaign/emails'
      )
      .flush({ items: [], page: 1, page_size: 25, total: 0 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Next campaign');
  });
});
