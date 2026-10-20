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
  template:
    '<app-template-data-editor [formControl]="data" [suggestedFields]="suggestedFields" [preserveRoots]="preserveRoots" />',
})
class DataHarness {
  data = new FormControl('{}', { nonNullable: true });
  suggestedFields: { name: string; complex?: boolean }[] = [];
  preserveRoots: string[] = [];
}

describe('Template data editor', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataHarness, NoopAnimationsModule],
      providers: [provideZoneChangeDetection()],
    }).compileComponents();
  });
  function setup(
    value = '{}',
    suggestedFields: { name: string; complex?: boolean }[] = [],
    preserveRoots: string[] = []
  ) {
    const fixture = TestBed.createComponent(DataHarness);
    fixture.componentInstance.data.setValue(value);
    fixture.componentInstance.suggestedFields = suggestedFields;
    fixture.componentInstance.preserveRoots = preserveRoots;
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

  it('presents detected custom names without typing them and requires an explicit value for each', () => {
    const { fixture, editor, control } = setup('{}', [
      { name: 'date_limite' },
      { name: 'reduction' },
    ]);
    expect(editor.fields.length).toBe(2);
    expect(control.invalid).toBe(true);
    expect(
      fixture.nativeElement.querySelector('input[formControlName="name"]')
        .readOnly
    ).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Date limite');
    editor.removeField(0);
    expect(editor.fields.length).toBe(2);
    editor.fields.at(0).controls['value'].setValue('31 décembre');
    expect(control.invalid).toBe(true);
    expect(JSON.parse(control.value)).toEqual({ date_limite: '31 décembre' });
    editor.fields.at(1).controls['type'].setValue('null');
    expect(control.valid).toBe(true);
    expect(JSON.parse(control.value)).toEqual({
      date_limite: '31 décembre',
      reduction: null,
    });
  });

  it('keeps automatic preview context intact while editing only detected custom fields', () => {
    const original = {
      member: { first_name: 'Camille' },
      amount: 250,
      cotisations: [{ amount: 250 }],
    };
    const { editor, control } = setup(
      JSON.stringify(original),
      [{ name: 'date_limite' }],
      ['member', 'amount', 'cotisations']
    );
    expect(editor.advanced).toBe(false);
    expect(editor.fields.length).toBe(1);
    editor.fields.at(0).controls['value'].setValue('Demain');
    expect(control.valid).toBe(true);
    expect(JSON.parse(control.value)).toEqual({
      ...original,
      date_limite: 'Demain',
    });
    editor.toggleMode();
    editor.toggleMode();
    expect(control.valid).toBe(true);
    expect(editor.fields.at(0).controls['value'].value).toBe('Demain');
  });

  it('edits detected nested values as JSON and preserves existing scalar types', () => {
    const { editor, control } = setup(
      '{"sender":{"name":"ASL"},"active":false}',
      [{ name: 'sender', complex: true }, { name: 'active' }]
    );
    expect(editor.advanced).toBe(false);
    expect(editor.fields.at(0).controls['type'].value).toBe('json');
    expect(editor.fields.at(1).controls['type'].value).toBe('boolean');
    editor.fields.at(0).controls['value'].setValue('{bad');
    expect(control.invalid).toBe(true);
    expect(JSON.parse(control.value).sender).toEqual({ name: 'ASL' });
    editor.fields
      .at(0)
      .controls['value'].setValue('{"name":"Autre","values":[1,2]}');
    expect(control.valid).toBe(true);
    expect(JSON.parse(control.value)).toEqual({
      sender: { name: 'Autre', values: [1, 2] },
      active: false,
    });
  });

  it('keeps even invalid row input when a model changes and makes previous fields removable', () => {
    const { fixture, editor, control } = setup('{}', [{ name: 'montant' }]);
    editor.fields.at(0).patchValue({ type: 'number', value: 'pas un nombre' });
    fixture.componentInstance.suggestedFields = [{ name: 'reference' }];
    fixture.detectChanges();
    expect(editor.fields.at(0).controls['value'].value).toBe('pas un nombre');
    expect(editor.fields.at(1).controls['name'].value).toBe('reference');
    editor.removeField(0);
    editor.fields.at(0).controls['value'].setValue('Essai');
    expect(control.valid).toBe(true);
    expect(JSON.parse(control.value)).toEqual({ reference: 'Essai' });
  });

  it('can use the advanced editor before filling detected fields without losing supplied values', () => {
    const { editor, control } = setup('{"reference":"Essai"}', [
      { name: 'reference' },
      { name: 'date_limite' },
    ]);
    expect(control.invalid).toBe(true);
    editor.toggleMode();
    expect(editor.advanced).toBe(true);
    expect(control.invalid).toBe(true);
    expect(JSON.parse(control.value)).toEqual({ reference: 'Essai' });
    editor.toggleMode();
    expect(editor.advanced).toBe(false);
    expect(control.invalid).toBe(true);
    expect(editor.fields.at(0).controls['value'].value).toBe('Essai');
  });

  it('lets a manually added duplicate be renamed or removed without locking the invalid row', () => {
    const { fixture, editor, control } = setup('{"reference":"Essai"}', [
      { name: 'reference' },
    ]);
    editor.addField();
    editor.fields.at(1).patchValue({ name: 'reference', value: 'Autre' });
    fixture.detectChanges();
    expect(control.invalid).toBe(true);
    expect(editor.isSuggestedRow(editor.fields.at(1))).toBe(false);
    expect(
      fixture.nativeElement.querySelectorAll('input[formControlName="name"]')[1]
        .readOnly
    ).toBe(false);
    editor.removeField(1);
    expect(control.valid).toBe(true);
    expect(JSON.parse(control.value)).toEqual({ reference: 'Essai' });
  });

  it('retains a manual duplicate of a pending field and never hides its input during a mode change', () => {
    const { editor, control } = setup('{}', [{ name: 'reference' }]);
    editor.addField();
    editor.fields.at(1).patchValue({ name: 'reference', value: 'Autre' });
    expect(control.errors?.['templateData']).toContain('plusieurs fois');
    editor.toggleMode();
    expect(editor.advanced).toBe(false);
    expect(editor.fields.at(1).controls['value'].value).toBe('Autre');
  });

  it('serializes the remaining manual row after changing model and removing its pending namesake', () => {
    const { fixture, editor, control } = setup('{}', [{ name: 'reference' }]);
    editor.addField();
    editor.fields.at(1).patchValue({ name: 'reference', value: 'Autre' });
    fixture.componentInstance.suggestedFields = [];
    fixture.detectChanges();
    editor.removeField(0);
    expect(control.valid).toBe(true);
    expect(JSON.parse(control.value)).toEqual({ reference: 'Autre' });
    editor.toggleMode();
    expect(editor.advanced).toBe(true);
    expect(JSON.parse(control.value)).toEqual({ reference: 'Autre' });
  });

  it('keeps keyboard focus in the editor when adding or deleting values', () => {
    const { fixture, editor } = setup('{"reference":"budget 2026"}');
    const add = fixture.nativeElement.querySelector(
      'button[aria-label="Ajouter une valeur"]'
    ) as HTMLButtonElement;
    add.focus();
    add.click();
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelectorAll('input[formControlName="name"]')[1]
    );
    editor.removeField(1);
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('input[formControlName="name"]')
    );
    editor.removeField(0);
    expect(document.activeElement).toBe(add);
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
