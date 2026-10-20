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
import { EmailsModule } from '../../emails.module';
import { templateSampleData } from '../../template-variables';
import { EmailTemplatePreviewFormComponent } from './email-template-preview-form.component';

const url = '/api/email/templates/template-test/preview';
describe('Saved email template preview', () => {
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailsModule, NoopAnimationsModule],
      providers: [
        provideZoneChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: { template: { id: 'template-test', label: 'Modèle test' } },
        },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function setup() {
    const fixture = TestBed.createComponent(EmailTemplatePreviewFormComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('can preview the explicit fictitious context immediately and renders the server result inline', () => {
    const fixture = setup();
    const page = fixture.componentInstance;
    expect(page.canPreview).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('fictives');
    page.submit();
    page.submit();
    const request = http.expectOne(url);
    expect(request.request.body).toEqual({ data: templateSampleData });
    request.flush({ subject: 'Bonjour Camille', message: '<p>Lot 1</p>' });
    fixture.detectChanges();
    expect(page.previewCurrent).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.preview-message').textContent
    ).toBe('Lot 1');
    expect(fixture.nativeElement.textContent).toContain('Exemple fictif');
  });

  it('preserves separate sample and custom inputs and transmits only the chosen typed data', () => {
    const fixture = setup();
    const page = fixture.componentInstance;
    page.form.controls.source.setValue('custom');
    fixture.detectChanges();
    page.activeData.setValue(
      '{"reference":"Essai","n":2,"enabled":false,"nested":{"value":3}}'
    );
    fixture.detectChanges();
    const custom = page.activeData.value;
    page.form.controls.source.setValue('sample');
    fixture.detectChanges();
    expect(JSON.parse(page.activeData.value)).toEqual(templateSampleData);
    page.form.controls.source.setValue('custom');
    fixture.detectChanges();
    expect(page.activeData.value).toBe(custom);
    page.submit();
    const request = http.expectOne(url);
    expect(request.request.body).toEqual({ data: JSON.parse(custom) });
    request.flush({ subject: 'Essai', message: '<p>Test</p>' });
    expect(page.resultSource).toContain('fournies');
  });

  it('blocks malformed JSON and incomplete guided values without losing the input', () => {
    const fixture = setup();
    const page = fixture.componentInstance;
    page.form.controls.source.setValue('custom');
    fixture.detectChanges();
    const add = fixture.nativeElement.querySelector(
      'button[aria-label="Ajouter une valeur"]'
    ) as HTMLButtonElement;
    add.click();
    fixture.detectChanges();
    expect(page.activeData.invalid).toBe(true);
    expect(page.form.controls.source.disabled).toBe(true);
    page.submit();
    http.expectNone(url);
    fixture.nativeElement.querySelector('button[mat-icon-button]').click();
    fixture.detectChanges();
    expect(page.canPreview).toBe(true);
    expect(page.form.controls.source.enabled).toBe(true);
    page.activeData.setValue('{"bad":');
    fixture.detectChanges();
    page.submit();
    http.expectNone(url);
    expect(page.activeData.value).toBe('{"bad":');
    expect(page.activeData.invalid).toBe(true);
  });

  it('ignores stale responses and marks an earlier result outdated after editing', () => {
    const fixture = setup();
    const page = fixture.componentInstance;
    page.submit();
    const stale = http.expectOne(url);
    page.form.controls.sampleData.setValue(
      JSON.stringify({ ...templateSampleData, amount: 300 })
    );
    stale.flush({ subject: 'Old', message: '<p>Old</p>' });
    fixture.detectChanges();
    expect(page.result).toBeUndefined();
    expect(page.error).toContain('changé');
    page.submit();
    http
      .expectOne(url)
      .flush({ subject: 'Current', message: '<p>Current</p>' });
    expect(page.previewCurrent).toBe(true);
    page.form.controls.source.setValue('custom');
    fixture.detectChanges();
    expect(page.previewCurrent).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('plus à jour');
  });

  it('names missing values, retains data on failure and can retry without creating a campaign', () => {
    const fixture = setup();
    const page = fixture.componentInstance;
    const original = page.activeData.value;
    page.submit();
    http
      .expectOne(url)
      .flush(
        { message: 'map has no entry for key "date_limite"' },
        { status: 400, statusText: 'Bad request' }
      );
    fixture.detectChanges();
    expect(page.error).toContain('date_limite');
    expect(page.activeData.value).toBe(original);
    page.submit();
    http.expectOne(url).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(page.canPreview).toBe(true);
    expect(page.error).toContain('conservées');
    http.expectNone('/api/email/campaigns');
    http.expectNone('/api/email/templates');
  });
});
