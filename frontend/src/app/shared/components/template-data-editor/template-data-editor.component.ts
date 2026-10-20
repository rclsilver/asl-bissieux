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
  implements ControlValueAccessor, Validator, OnDestroy
{
  private readonly builder = inject(FormBuilder);
  private readonly detector = inject(ChangeDetectorRef);
  @ViewChildren('fieldName', { read: ElementRef })
  private fieldNames!: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChild('addValue', { read: ElementRef })
  private addButton!: ElementRef<HTMLButtonElement>;
  private readonly destroyed$ = new Subject<void>();
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

  writeValue(value: string | null) {
    this.raw = value ?? '{}';
    const parsed = this.parse();
    this.advanced = parsed === null || !this.loadFields(parsed);
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
    return this.error ? { templateData: this.error } : null;
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
    this.fields.push(
      this.builder.group({ name: '', type: 'text', value: '' }),
      { emitEvent: false }
    );
    this.emitFields();
    this.touch();
    this.detector.detectChanges();
    this.fieldNames.last?.nativeElement.focus();
  }

  removeField(index: number) {
    if (this.disabled || index < 0 || index >= this.fields.length) return;
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
    } else if (this.error) {
      this.notice =
        'Corrige ou supprime la valeur incomplète avant de changer de mode.';
    } else {
      this.advanced = true;
    }
    this.touch();
  }

  updateRaw(event: Event) {
    this.raw = (event.target as HTMLTextAreaElement).value;
    this.parse();
    this.change(this.raw);
    this.validatorChanged();
  }

  private parse(): Record<string, unknown> | null {
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
          !name.trim() ||
          name !== name.trim() ||
          (value !== null && typeof value === 'object')
      )
    )
      return false;
    this.fields.clear({ emitEvent: false });
    for (const [name, value] of Object.entries(data)) {
      this.fields.push(
        this.builder.group({
          name,
          type:
            value === null
              ? 'null'
              : typeof value === 'string'
                ? 'text'
                : typeof value,
          value: value === null ? '' : String(value),
        }),
        { emitEvent: false }
      );
    }
    return true;
  }

  private emitFields() {
    const data: Record<string, unknown> = Object.create(null);
    this.error = '';
    this.notice = '';
    for (const field of this.fields.getRawValue()) {
      const name = String(field['name'] ?? '').trim();
      if (!name) {
        this.error = 'Donne un nom à chaque valeur.';
        break;
      }
      if (Object.hasOwn(data, name)) {
        this.error = `Le nom « ${name} » est utilisé plusieurs fois.`;
        break;
      }
      const text = String(field['value'] ?? '');
      switch (field['type']) {
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
    this.change(this.raw);
    this.validatorChanged();
  }
}
