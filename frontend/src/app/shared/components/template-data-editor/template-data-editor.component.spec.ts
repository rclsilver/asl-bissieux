import {
  ChangeDetectionStrategy,
  Component,
  provideZoneChangeDetection,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it } from 'vitest';
import { TemplateDataEditorComponent } from './template-data-editor.component';

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule, TemplateDataEditorComponent],
  template: '<app-template-data-editor [formControl]="data" />',
})
class DataHarness {
  data = new FormControl('{}', { nonNullable: true });
}

describe('Template data editor', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataHarness, NoopAnimationsModule],
      providers: [provideZoneChangeDetection()],
    }).compileComponents();
  });
  function setup(value = '{}') {
    const fixture = TestBed.createComponent(DataHarness);
    fixture.componentInstance.data.setValue(value);
    fixture.detectChanges();
    const editor = fixture.debugElement.query(
      By.directive(TemplateDataEditorComponent)
    ).componentInstance as TemplateDataEditorComponent;
    return { fixture, editor, control: fixture.componentInstance.data };
  }

  it('preserves scalar types and accepts a French decimal without converting other values to text', () => {
    const { editor, control } = setup(
      '{"date_limite":"31 décembre","montant":12.5,"oui":true,"non":false,"vide":null}'
    );
    editor.fields.at(1).controls['value'].setValue('24,01');
    expect(control.valid).toBe(true);
    expect(JSON.parse(control.value)).toEqual({
      date_limite: '31 décembre',
      montant: 24.01,
      oui: true,
      non: false,
      vide: null,
    });
    editor.fields.at(1).controls['value'].setValue('douze');
    expect(control.invalid).toBe(true);
    expect(control.errors?.['templateData']).toContain('nombre');
    editor.fields.at(1).controls['value'].setValue('1e3');
    expect(JSON.parse(control.value).montant).toBe(1000);
    expect(control.valid).toBe(true);
  });

  it('validates added and duplicate names and recovers after removing an incomplete row', () => {
    const { fixture, editor, control } = setup('{"reference":"budget 2026"}');
    fixture.nativeElement
      .querySelector('button[aria-label="Ajouter une valeur"]')
      .click();
    fixture.detectChanges();
    expect(control.invalid).toBe(true);
    editor.fields.at(1).patchValue({ name: 'reference', value: 'autre' });
    fixture.detectChanges();
    expect(control.errors?.['templateData']).toContain('plusieurs fois');
    expect(JSON.parse(control.value)).toEqual({ reference: 'budget 2026' });
    editor.fields.at(1).controls['name'].setValue('date_limite');
    expect(control.valid).toBe(true);
    expect(JSON.parse(control.value)).toEqual({
      reference: 'budget 2026',
      date_limite: 'autre',
    });
    editor.fields.at(1).controls['name'].setValue('');
    editor.removeField(1);
    expect(control.valid).toBe(true);
    expect(JSON.parse(control.value)).toEqual({ reference: 'budget 2026' });
  });

  it('keeps nested legacy objects and lists in advanced mode without rewriting them', () => {
    const original =
      '{ "sender": {"name":"ASL"}, "days": [1,2], "member": {"first_name":"Alice"} }';
    const { fixture, editor, control } = setup(original);
    expect(editor.advanced).toBe(true);
    expect(control.valid).toBe(true);
    editor.toggleMode();
    fixture.detectChanges();
    expect(editor.advanced).toBe(true);
    expect(control.value).toBe(original);
    expect(
      fixture.nativeElement.querySelector('[role="status"]').textContent
    ).toContain('conservées');
    expect(JSON.parse(control.value).member.first_name).toBe('Alice');
  });

  it('validates advanced JSON, keeps invalid input editable and can return to guided fields', () => {
    const { fixture, editor, control } = setup();
    editor.toggleMode();
    fixture.detectChanges();
    const textarea = fixture.nativeElement.querySelector(
      'textarea'
    ) as HTMLTextAreaElement;
    textarea.value = '{"reference":';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(control.invalid).toBe(true);
    expect(control.value).toBe('{"reference":');
    textarea.value = '[]';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    expect(control.errors?.['templateData']).toContain('objet JSON');
    textarea.value = '{"reference":"test"}';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    expect(control.valid).toBe(true);
    editor.toggleMode();
    fixture.detectChanges();
    expect(editor.advanced).toBe(false);
    expect(editor.fields.at(0).controls['name'].value).toBe('reference');
    expect(control.value).toBe('{"reference":"test"}');
  });
});
