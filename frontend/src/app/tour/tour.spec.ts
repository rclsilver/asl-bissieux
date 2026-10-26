import { provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APISchemas } from '../core/api/openapi';
import { AuthService } from '../core/services/auth.service';
import { NotificationsService } from '../shared/services/notifications.service';
import { TourService, TourState } from './tour.service';
import { TourComponent } from './tour.component';
import { TourPromptComponent } from './tour-prompt.component';
import { TourExampleComponent } from './tour-example.component';

const learner = { id: 'learner', enabled: true, admin: false, actions: [] };
function state(
  seen: string[] = [],
  ids = ['overview', 'directory', 'budgets', 'emails']
): TourState {
  return {
    version: 1,
    seen_version: seen.length === ids.length ? 1 : 0,
    steps: ids.map((id) => ({
      id,
      revision: 1,
      seen_revision: seen.includes(id) ? 1 : 0,
      title: id,
      description: 'Exemple fictif',
      changes: [],
      capabilities: [],
    })),
  };
}
describe('Versioned guided tour', () => {
  let http: HttpTestingController;
  let user: BehaviorSubject<APISchemas['AuthUser'] | null>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(async () => {
    user = new BehaviorSubject<APISchemas['AuthUser'] | null>(null);
    params = new BehaviorSubject(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [
        TourComponent,
        TourPromptComponent,
        TourExampleComponent,
        NoopAnimationsModule,
      ],
      providers: [
        provideZoneChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user$: user.asObservable() } },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: params.asObservable() },
        },
        { provide: NotificationsService, useValue: { showDialog: vi.fn() } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function setup(s = state()) {
    user.next(learner);
    const fixture = TestBed.createComponent(TourComponent);
    fixture.detectChanges();
    http.expectOne('/api/auth/tour').flush(s);
    fixture.detectChanges();
    TestBed.tick();
    return fixture;
  }
  it('offers an optional tour, postpones without marking anything seen and clears it after logout', () => {
    const fixture = TestBed.createComponent(TourPromptComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
    user.next(learner);
    http.expectOne('/api/auth/tour').flush(state());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Découvrir le site');
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
    http.expectNone('/api/auth/tour/progress');
    user.next(null);
    expect(TestBed.inject(TourService).state()).toBeNull();
    user.next({ ...learner, id: 'another' });
    http.expectOne('/api/auth/tour').flush(state(['overview']));
    expect(
      TestBed.inject(TourService)
        .pending()
        .map((s) => s.id)
    ).not.toContain('overview');
  });
  it('does not load or offer training for an inactive account and recovers a catalogue failure', () => {
    const tour = TestBed.inject(TourService);
    user.next({ ...learner, enabled: false });
    http.expectNone('/api/auth/tour');
    user.next(learner);
    http
      .expectOne('/api/auth/tour')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(tour.error()).toBe(true);
    expect(tour.offer()).toBe(false);
    tour.reload();
    http.expectOne('/api/auth/tour').flush(state());
    expect(tour.error()).toBe(false);
  });
  it('resumes only unseen chapters, saves once and keeps the same chapter after an error', () => {
    const fixture = setup(state(['overview', 'directory']));
    const page = fixture.componentInstance;
    expect(page.current()?.id).toBe('budgets');
    page.next();
    page.next();
    const request = http.expectOne('/api/auth/tour/progress');
    expect(request.request.body).toEqual({
      version: 1,
      step_id: 'budgets',
      revision: 1,
    });
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(page.index()).toBe(0);
    expect(page.saving()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(
      'n’a pas pu être enregistrée'
    );
    page.next();
    http
      .expectOne('/api/auth/tour/progress')
      .flush(state(['overview', 'directory', 'budgets']));
    fixture.detectChanges();
    expect(page.current()?.id).toBe('emails');
    expect(
      document.activeElement ===
        fixture.nativeElement.querySelector('#tour-chapter-title')
    ).toBe(true);
    page.next();
    http
      .expectOne('/api/auth/tour/progress')
      .flush(state(['overview', 'directory', 'budgets', 'emails']));
    fixture.detectChanges();
    expect(page.finished()).toBe(true);
    expect(TestBed.inject(TourService).pending()).toHaveLength(0);
  });
  it('shows only the revised/new authorized chapters with their change notes and handles stale versions', () => {
    const data = state(['overview', 'directory', 'budgets', 'emails']);
    data.version = 2;
    data.steps![1] = {
      ...data.steps![1],
      revision: 2,
      changes: ['Fenêtre des membres'],
    };
    const fixture = setup(data),
      page = fixture.componentInstance;
    expect(page.chapters().map((s) => s.id)).toEqual(['directory']);
    expect(fixture.nativeElement.textContent).toContain('Fenêtre des membres');
    expect(fixture.nativeElement.textContent).not.toContain('Simuler l’envoi');
    page.next();
    http
      .expectOne('/api/auth/tour/progress')
      .flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(page.finished()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Recharge le parcours');
  });
  it('rebuilds the chapter session after a catalogue reload or same-account rights change', () => {
    const fixture = setup(
      state(['overview', 'directory', 'budgets', 'emails'])
    );
    const page = fixture.componentInstance;
    expect(page.chapters()).toHaveLength(0);
    page.tour.reload();
    const updated = state(
      ['overview', 'directory', 'budgets', 'emails'],
      ['overview', 'directory', 'budgets', 'emails', 'payments']
    );
    updated.version = 2;
    updated.steps![1].revision = 2;
    http.expectOne('/api/auth/tour').flush(updated);
    fixture.detectChanges();
    TestBed.tick();
    expect(page.chapters().map((s) => s.id)).toEqual(['directory', 'payments']);
    user.next({ ...learner, admin: true });
    http
      .expectOne('/api/auth/tour')
      .flush(
        state(
          ['overview', 'directory', 'budgets', 'emails'],
          ['overview', 'directory', 'budgets', 'emails', 'access', 'mailings']
        )
      );
    fixture.detectChanges();
    TestBed.tick();
    expect(page.chapters().map((s) => s.id)).toEqual(['access', 'mailings']);
    expect(page.finished()).toBe(false);
  });
  it('cancels an old progress continuation when the replay mode changes', () => {
    const fixture = setup();
    const page = fixture.componentInstance;
    page.next();
    const pending = http.expectOne('/api/auth/tour/progress');
    params.next(convertToParamMap({ mode: 'all' }));
    fixture.detectChanges();
    TestBed.tick();
    expect(pending.cancelled).toBe(true);
    expect(page.index()).toBe(0);
    expect(page.current()?.id).toBe('overview');
    expect(page.saving()).toBe(false);
    expect(page.finished()).toBe(false);
  });
  it('can replay all seen chapters without changing stored progress', () => {
    params.next(convertToParamMap({ mode: 'all' }));
    const fixture = setup(
      state(['overview', 'directory', 'budgets', 'emails'])
    );
    const page = fixture.componentInstance;
    expect(page.chapters()).toHaveLength(4);
    page.next();
    fixture.detectChanges();
    expect(page.current()?.id).toBe('directory');
    http.expectNone('/api/auth/tour/progress');
    page.previous();
    expect(page.current()?.id).toBe('overview');
  });
  it('cancels in-flight progress and does not leak it to a different account', () => {
    const fixture = setup();
    fixture.componentInstance.next();
    const pending = http.expectOne('/api/auth/tour/progress');
    user.next({ ...learner, id: 'another' });
    expect(pending.cancelled).toBe(true);
    http.expectOne('/api/auth/tour').flush(state(['overview', 'directory']));
    fixture.detectChanges();
    TestBed.tick();
    expect(fixture.componentInstance.current()?.id).toBe('budgets');
  });
  it('refilters the tour when account rights are refreshed', () => {
    const tour = TestBed.inject(TourService);
    user.next(learner);
    http.expectOne('/api/auth/tour').flush(state());
    user.next({ ...learner, admin: true });
    http
      .expectOne('/api/auth/tour')
      .flush(state([], ['overview', 'access', 'mailings']));
    expect(tour.pending().map((s) => s.id)).toContain('access');
    user.next(learner);
    http.expectOne('/api/auth/tour').flush(state());
    expect(tour.state()?.steps?.map((s) => s.id)).not.toContain('access');
  });
  it('keeps all interactive examples local and hides actions without the matching right', () => {
    const fixture = TestBed.createComponent(TourExampleComponent);
    fixture.componentRef.setInput('step', { id: 'emails', capabilities: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Simuler l’envoi');
    fixture.componentRef.setInput('step', {
      id: 'emails',
      capabilities: ['email.SendEmail'],
    });
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Envoi simulé uniquement'
    );
    fixture.componentRef.setInput('step', { id: 'payments', capabilities: [] });
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.amount = '50,001';
    page.simulatePayment();
    expect(page.paid).toBe(0);
    expect(page.exampleError).not.toBe('');
    page.amount = '50,00';
    page.simulatePayment();
    fixture.detectChanges();
    expect(page.paid).toBe(5000);
    expect(page.money(5000)).toContain('50,00');
    page.amount = '120';
    page.simulatePayment();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Trop-perçu');
    http.expectNone((request) => request.url.startsWith('/api/'));
  });
  it('searches fictional coowners and shows their details in a closable example window', async () => {
    const fixture = TestBed.createComponent(TourExampleComponent);
    fixture.componentRef.setInput('step', {
      id: 'directory',
      capabilities: [],
    });
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.query = 'NOÉ';
    expect(page.matches.map((m) => m.name)).toEqual(['Noé Laurent']);
    page.query = 'lot 24';
    expect(page.matches.map((m) => m.name)).toEqual(['Camille Martin']);
    page.openLot(1);
    fixture.detectChanges();
    await fixture.whenStable();
    TestBed.tick();
    expect(document.querySelector('mat-dialog-content')?.textContent).toContain(
      'Camille'
    );
    expect(document.querySelector('mat-dialog-content')?.textContent).toContain(
      'Noé'
    );
    document.querySelector<HTMLButtonElement>('[mat-dialog-close]')!.click();
    await fixture.whenStable();
    TestBed.tick();
    expect(document.querySelector('[role=dialog]')).toBeNull();
    http.expectNone((request) => request.url.startsWith('/api/'));
  });
});
