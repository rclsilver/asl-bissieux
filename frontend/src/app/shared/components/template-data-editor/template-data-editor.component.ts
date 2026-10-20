import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ElementRef,
  forwardRef,
  inject,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren,
  Input,
  OnChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  ControlValueAccessor,
  FormArray,
  FormBuilder,
  FormGroup,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';
import { validateTemplateValues } from './template-data-validation';

@Component({
  selector: 'app-template-data-editor',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './template-data-editor.component.html',
  styleUrls: ['./template-data-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TemplateDataEditorComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => TemplateDataEditorComponent),
      multi: true,
    },
  ],
})
export class TemplateDataEditorComponent
  implements ControlValueAccessor, Validator, OnDestroy, OnChanges
{
  private readonly builder = inject(FormBuilder);
  private readonly detector = inject(ChangeDetectorRef);
  @ViewChildren('fieldName', { read: ElementRef })
  private fieldNames!: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChild('addValue', { read: ElementRef })
  private addButton!: ElementRef<HTMLButtonElement>;
  private readonly destroyed$ = new Subject<void>();
  @Input() suggestedFields?: { name?: string; complex?: boolean }[] | null;
  @Input() preserveRoots: string[] = [];
  private preserved: Record<string, unknown> = {};
  private readonly pending = new Set<FormGroup>();
  private readonly suggestedRows = new Set<FormGroup>();
  private missingOnly = false;
  readonly fields = new FormArray<FormGroup>([]);
  readonly form = this.builder.group({ fields: this.fields });
  advanced = false;
  disabled = false;
  raw = '{}';
  error = '';
  notice = '';
  private change: (value: string) => void = () => {};
  private touched: () => void = () => {};
  private validatorChanged: () => void = () => {};

  constructor() {
    this.fields.valueChanges
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => this.emitFields());
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  ngOnChanges() {
    if (!this.advanced) {
      this.ensureSuggestions();
      this.checkMissing();
      this.validatorChanged();
    }
  }

  isSuggested(name: string) {
    return !!this.suggestedFields?.some((field) => field.name === name);
  }
  isSuggestedRow(field: FormGroup) {
    return this.suggestedRows.has(field);
  }
  labelFor(name: string) {
    const label = name.replace(/_/g, ' ');
    return label ? label[0].toLocaleUpperCase('fr') + label.slice(1) : 'Valeur';
  }
  private makeField(name: string, type: string, value: string) {
    const field = this.builder.group({ name, type, value });
    field.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe(() => {
      this.pending.delete(field);
    });
    if (this.disabled) field.disable({ emitEvent: false });
    return field;
  }
  private ensureSuggestions() {
    this.suggestedRows.clear();
    for (const field of this.suggestedFields ?? []) {
      if (!field.name) continue;
      const existing = this.fields.controls.find(
        (row) => row.controls['name'].value === field.name
      );
      if (existing) {
        this.suggestedRows.add(existing);
        continue;
      }
      const row = this.makeField(
        field.name,
        field.complex ? 'json' : 'text',
        ''
      );
      this.fields.push(row, { emitEvent: false });
      this.suggestedRows.add(row);
      this.pending.add(row);
    }
  }
  private checkMissing() {
    const missing = this.fields.controls.find(
      (row) => this.suggestedRows.has(row) && this.pending.has(row)
    );
    if (missing && (!this.error || this.missingOnly)) {
      this.error = `Renseigne « ${this.labelFor(missing.controls['name'].value)} » ou choisis explicitement une valeur vide.`;
      this.missingOnly = true;
    } else if (!missing && this.missingOnly) {
      this.error = '';
      this.missingOnly = false;
    }
  }

  writeValue(value: string | null) {
    this.raw = value ?? '{}';
    const parsed = this.parse();
    this.advanced = parsed === null || !this.loadFields(parsed);
    if (this.advanced && parsed)
      this.error =
        validateTemplateValues(this.raw, this.suggestedFields)?.[
          'templateData'
        ] ?? '';
    if (!this.advanced) this.checkMissing();
  }

  registerOnChange(fn: (value: string) => void) {
    this.change = fn;
  }
  registerOnTouched(fn: () => void) {
    this.touched = fn;
  }
  registerOnValidatorChange(fn: () => void) {
    this.validatorChanged = fn;
  }
  validate(_: AbstractControl): ValidationErrors | null {
    return this.error
      ? { templateData: this.error }
      : validateTemplateValues(this.raw, this.suggestedFields);
  }
  touch() {
    this.touched();
  }

  setDisabledState(disabled: boolean) {
    this.disabled = disabled;
    if (disabled) this.fields.disable({ emitEvent: false });
    else this.fields.enable({ emitEvent: false });
  }

  addField() {
    if (this.disabled || this.advanced) return;
    this.fields.push(this.makeField('', 'text', ''), { emitEvent: false });
    this.emitFields();
    this.touch();
    this.detector.detectChanges();
    this.fieldNames.last?.nativeElement.focus();
  }

  removeField(index: number) {
    if (this.disabled || index < 0 || index >= this.fields.length) return;
    if (this.isSuggestedRow(this.fields.at(index))) return;
    this.pending.delete(this.fields.at(index));
    this.fields.removeAt(index, { emitEvent: false });
    this.emitFields();
    this.touch();
    this.detector.detectChanges();
    const next = this.fieldNames.get(Math.min(index, this.fields.length - 1));
    (next?.nativeElement ?? this.addButton.nativeElement).focus();
  }

  toggleMode() {
    if (this.disabled) return;
    this.notice = '';
    if (this.advanced) {
      const parsed = this.parse();
      if (parsed === null) return;
      if (!this.loadFields(parsed)) {
        this.notice =
          'Ce paramétrage nécessite le mode avancé ; ses valeurs sont conservées.';
        return;
      }
      this.advanced = false;
      this.checkMissing();
    } else if (this.error && !this.missingOnly) {
      this.notice =
        'Corrige ou supprime la valeur incomplète avant de changer de mode.';
    } else {
      this.advanced = true;
      this.error =
        validateTemplateValues(this.raw, this.suggestedFields)?.[
          'templateData'
        ] ?? '';
      this.missingOnly = !!this.error;
    }
    this.touch();
    this.validatorChanged();
  }

  updateRaw(event: Event) {
    this.raw = (event.target as HTMLTextAreaElement).value;
    this.parse();
    if (!this.error)
      this.error =
        validateTemplateValues(this.raw, this.suggestedFields)?.[
          'templateData'
        ] ?? '';
    this.change(this.raw);
    this.validatorChanged();
  }

  private parse(): Record<string, unknown> | null {
    this.missingOnly = false;
    try {
      const value = JSON.parse(this.raw);
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        this.error =
          'Les valeurs doivent former un objet JSON, par exemple {}.';
        return null;
      }
      this.error = '';
      return value;
    } catch {
      this.error =
        'Le JSON n’est pas valide. Vérifie les guillemets et les virgules.';
      return null;
    }
  }

  private loadFields(data: Record<string, unknown>): boolean {
    if (
      Object.entries(data).some(
        ([name, value]) =>
          !this.preserveRoots.includes(name) &&
          (!name.trim() ||
            name !== name.trim() ||
            (value !== null &&
              typeof value === 'object' &&
              !this.isSuggested(name)))
      )
    )
      return false;
    this.fields.clear({ emitEvent: false });
    this.pending.clear();
    this.preserved = Object.fromEntries(
      Object.entries(data).filter(([name]) => this.preserveRoots.includes(name))
    );
    for (const [name, value] of Object.entries(data)) {
      if (this.preserveRoots.includes(name)) continue;
      this.fields.push(
        this.makeField(
          name,
          value === null
            ? 'null'
            : typeof value === 'object'
              ? 'json'
              : typeof value === 'string'
                ? 'text'
                : typeof value,
          value === null
            ? ''
            : typeof value === 'object'
              ? JSON.stringify(value, null, 2)
              : String(value)
        ),
        { emitEvent: false }
      );
    }
    this.ensureSuggestions();
    return true;
  }

  private emitFields() {
    const data: Record<string, unknown> = Object.assign(
      Object.create(null),
      this.preserved
    );
    this.error = '';
    this.missingOnly = false;
    this.notice = '';
    const names = new Set(Object.keys(this.preserved));
    for (const row of this.fields.controls) {
      const field = row.getRawValue();
      const name = String(field['name'] ?? '').trim();
      if (!name) {
        this.error = 'Donne un nom à chaque valeur.';
        break;
      }
      if (names.has(name)) {
        this.error = `Le nom « ${name} » est utilisé plusieurs fois.`;
        break;
      }
      names.add(name);
      const text = String(field['value'] ?? '');
      if (this.pending.has(row)) continue;
      switch (field['type']) {
        case 'json':
          try {
            data[name] = JSON.parse(text);
          } catch {
            this.error = `Saisis un JSON valide pour « ${name} ».`;
          }
          break;
        case 'text':
          data[name] = text;
          break;
        case 'null':
          data[name] = null;
          break;
        case 'boolean':
          if (text !== 'true' && text !== 'false')
            this.error = `Choisis Oui ou Non pour « ${name} ».`;
          else data[name] = text === 'true';
          break;
        case 'number': {
          const normalized = text.trim().replace(',', '.');
          if (
            !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized) ||
            !Number.isFinite(Number(normalized))
          )
            this.error = `Saisis un nombre pour « ${name} », par exemple 12,5.`;
          else data[name] = Number(normalized);
          break;
        }
        default:
          this.error = `Choisis un type pour « ${name} ».`;
      }
      if (this.error) break;
    }
    if (!this.error) this.raw = JSON.stringify(data, null, 2);
    this.checkMissing();
    this.change(this.raw);
    this.validatorChanged();
  }
}
