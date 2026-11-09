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
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { EmailsModule } from '../../emails.module';
import { EmailTemplateFormComponent } from './email-template-form.component';

const existing = {
  id: 'template-test',
  label: 'Modèle avancé',
  subject: 'Budget {{.budget.label}}',
  message:
    '{{range .cotisations}}{{.unit.number}} : {{printf "%.2f" .remaining}}{{end}}',
  attachments: [{ id: 'attachment-test', name: 'Document' }],
};

describe('Email template variable insertion', () => {
  let http: HttpTestingController;
  let close: ReturnType<typeof vi.fn>;
  let notify: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    close = vi.fn();
    notify = vi.fn();
    await TestBed.configureTestingModule({
      imports: [EmailsModule, NoopAnimationsModule],
      providers: [
        provideZoneChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { template: existing } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: NotificationsService, useValue: { showDialog: notify } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function setup() {
    const fixture = TestBed.createComponent(EmailTemplateFormComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('keeps advanced expressions intact and does not save an unchanged model', () => {
    const fixture = setup();
    const page = fixture.componentInstance;
    expect(page.form.controls.message.value).toBe(existing.message);
    expect(page.canSave).toBe(false);
    page.submit();
    http.expectNone('/api/email/templates/template-test');
    expect(existing.attachments).toHaveLength(1);
  });

  it('replaces a remembered subject selection, restores focus and continues at the new cursor', () => {
    const fixture = setup();
    const page = fixture.componentInstance;
    const input = fixture.nativeElement.querySelector(
      'input[formControlName="subject"]'
    ) as HTMLInputElement;
    page.form.controls.subject.setValue('Bonjour texte !');
    fixture.detectChanges();
    input.focus();
    input.setSelectionRange(8, 13);
    input.dispatchEvent(new Event('select'));
    input.blur();
    page.variable.setValue('member.first_name');
    page.insertVariable();
    expect(page.form.controls.subject.value).toBe(
      'Bonjour {{.member.first_name}} !'
    );
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(8 + '{{.member.first_name}}'.length);
    page.insertVariable();
    expect(page.form.controls.subject.value).toBe(
      'Bonjour {{.member.first_name}}{{.member.first_name}} !'
    );
    expect(page.form.controls.message.value).toBe(existing.message);
    expect(page.canSave).toBe(true);
  });

  it('appends by default and keeps a separate body selection for a complete repeated block', () => {
    const fixture = setup();
    const page = fixture.componentInstance;
    page.variable.setValue('member.last_name');
    page.insertVariable();
    expect(page.form.controls.message.value).toBe(
      existing.message + '{{.member.last_name}}'
    );
    const textarea = fixture.nativeElement.querySelector(
      'textarea'
    ) as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(0, 0);
    textarea.dispatchEvent(new Event('select'));
    textarea.blur();
    page.variable.setValue('cotisations.remaining');
    page.target.setValue('subject');
    expect(page.canInsert).toBe(false);
    page.insertVariable();
    expect(page.form.controls.subject.value).toBe(existing.subject);
    page.target.setValue('message');
    page.insertVariable();
    expect(page.form.controls.message.value).toBe(
      '{{range .cotisations}}Lot {{.unit.number}} : {{.remaining}} € restants\n{{end}}' +
        existing.message +
        '{{.member.last_name}}'
    );
    expect(document.activeElement).toBe(textarea);
  });

  it('inserts explicit extra values and refuses invalid or reserved names without changing the model', () => {
    const fixture = setup();
    const page = fixture.componentInstance;
    page.variable.setValue('custom');
    for (const name of ['', 'date limite', '1date', 'member', 'amount']) {
      page.customName.setValue(name);
      page.insertVariable();
      expect(page.form.controls.message.value).toBe(existing.message);
    }
    page.customName.setValue('date_limite');
    page.insertVariable();
    expect(page.form.controls.message.value).toBe(
      existing.message + '{{.date_limite}}'
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Cette valeur n’est pas automatique'
    );
  });

  it('saves only editable fields once, preserves expressions and recovers after a server error', () => {
    const fixture = setup();
    const page = fixture.componentInstance;
    page.form.controls.label.setValue('Nouveau libellé');
    page.form.markAsDirty();
    page.submit();
    page.submit();
    page.cancel();
    const request = http.expectOne('/api/email/templates/template-test');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      label: 'Nouveau libellé',
      subject: existing.subject,
      message: existing.message,
    });
    expect(page.form.disabled).toBe(true);
    expect(page.variable.disabled).toBe(true);
    expect(close).not.toHaveBeenCalled();
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(page.canSave).toBe(true);
    expect(page.variable.enabled).toBe(true);
    expect(page.form.controls.message.value).toBe(existing.message);
    expect(page.error).toContain('conservée');
    page.submit();
    http
      .expectOne('/api/email/templates/template-test')
      .flush({ ...existing, label: 'Nouveau libellé' });
    expect(close).toHaveBeenCalledWith(true);
    expect(notify).toHaveBeenCalled();
  });

  it('creates a new model without requiring a variable and blocks an invalid form', () => {
    TestBed.inject(MAT_DIALOG_DATA).template = undefined;
    const fixture = setup();
    const page = fixture.componentInstance;
    page.submit();
    http.expectNone('/api/email/templates');
    page.form.setValue({
      label: 'Simple',
      subject: 'Bonjour',
      message: 'Un message fixe.',
    });
    page.form.markAsDirty();
    page.submit();
    page.submit();
    const request = http.expectOne('/api/email/templates');
    expect(request.request.method).toBe('POST');
    request.flush({ id: 'created', label: 'Simple' });
    expect(close).toHaveBeenCalledWith(true);
  });
});
