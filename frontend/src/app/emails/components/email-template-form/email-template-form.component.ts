import {
  Component,
  Inject,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
  OnDestroy,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, takeUntil } from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService, APIError } from 'src/app/core/services/api.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import {
  automaticTemplateRoots,
  templateVariableGroups,
} from '../../template-variables';

type Target = 'subject' | 'message';
type Selection = { start: number; end: number };

@Component({
  selector: 'app-email-template-form',
  templateUrl: './email-template-form.component.html',
  styleUrls: ['./email-template-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class EmailTemplateFormComponent implements OnDestroy {
  private readonly notifications = inject(NotificationsService);
  private readonly api = inject(ApiService);
  private readonly detector = inject(ChangeDetectorRef);
  private readonly destroyed$ = new Subject<void>();
  @ViewChild('subjectInput')
  private subjectInput!: ElementRef<HTMLInputElement>;
  @ViewChild('messageInput')
  private messageInput!: ElementRef<HTMLTextAreaElement>;
  private readonly selections: Partial<Record<Target, Selection>> = {};
  readonly variableGroups = templateVariableGroups;
  readonly variable = new FormControl('', { nonNullable: true });
  readonly target = new FormControl<Target>('message', { nonNullable: true });
  readonly customName = new FormControl('date_limite', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.pattern(/^[A-Za-z_][A-Za-z0-9_]*$/),
      (control) =>
        automaticTemplateRoots.has(control.value) ? { reserved: true } : null,
    ],
  });
  readonly form: FormGroup<{
    label: FormControl<string>;
    subject: FormControl<string>;
    message: FormControl<string>;
  }>;
  saving = false;
  error = '';
  insertionStatus = '';

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: { template?: APISchemas['ModelsEmailTemplate'] },
    private readonly dialog: MatDialogRef<EmailTemplateFormComponent>
  ) {
    this.form = new FormGroup({
      label: new FormControl(data.template?.label ?? '', {
        nonNullable: true,
        validators: Validators.required,
      }),
      subject: new FormControl(data.template?.subject ?? '', {
        nonNullable: true,
        validators: Validators.required,
      }),
      message: new FormControl(data.template?.message ?? '', {
        nonNullable: true,
        validators: Validators.required,
      }),
    });
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  get selectedVariable() {
    return this.variableGroups
      .flatMap((group) => group.variables)
      .find((variable) => variable.id === this.variable.value);
  }
  get canInsert() {
    return (
      !this.saving &&
      !(
        this.selectedVariable?.snippet.includes('\n') &&
        this.target.value === 'subject'
      ) &&
      (this.variable.value === 'custom'
        ? this.customName.valid
        : !!this.selectedVariable)
    );
  }
  get canSave() {
    return this.form.valid && this.form.dirty && !this.saving;
  }

  activateField(field: Target) {
    this.target.setValue(field);
    this.rememberSelection(field);
  }
  rememberSelection(field: Target) {
    const input = this.input(field);
    if (input.selectionStart !== null && input.selectionEnd !== null)
      this.selections[field] = {
        start: input.selectionStart,
        end: input.selectionEnd,
      };
  }
  private input(field: Target) {
    return field === 'subject'
      ? this.subjectInput.nativeElement
      : this.messageInput.nativeElement;
  }

  insertVariable() {
    if (!this.canInsert) {
      this.customName.markAsTouched();
      return;
    }
    const snippet =
      this.variable.value === 'custom'
        ? `{{.${this.customName.value}}}`
        : this.selectedVariable!.snippet;
    const field = this.target.value;
    const control = this.form.controls[field];
    const value = control.value;
    const selection = this.selections[field] ?? {
      start: value.length,
      end: value.length,
    };
    const start = Math.min(selection.start, value.length);
    const end = Math.min(selection.end, value.length);
    control.setValue(value.slice(0, start) + snippet + value.slice(end));
    control.markAsDirty();
    control.markAsTouched();
    const cursor = start + snippet.length;
    this.selections[field] = { start: cursor, end: cursor };
    this.insertionStatus = `Variable insérée dans ${field === 'subject' ? 'l’objet' : 'le corps du message'}.`;
    this.detector.detectChanges();
    const input = this.input(field);
    input.focus();
    input.setSelectionRange(cursor, cursor);
    this.selections[field] = { start: cursor, end: cursor };
  }

  cancel() {
    if (!this.saving) this.dialog.close(false);
  }
  submit() {
    if (!this.canSave) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.form.getRawValue();
    this.saving = true;
    this.error = '';
    this.form.disable({ emitEvent: false });
    for (const control of [this.variable, this.target, this.customName])
      control.disable({ emitEvent: false });
    const result$ = this.data.template?.id
      ? this.api.updateEmailTemplate(this.data.template.id, payload)
      : this.api.createEmailTemplate(payload);
    result$.pipe(takeUntil(this.destroyed$)).subscribe({
      next: () => {
        this.saving = false;
        this.dialog.close(true);
        this.notifications.showDialog({
          title: 'Modèle enregistré',
          message:
            'Tu peux maintenant le prévisualiser depuis E-mails > Modèles, puis le choisir pour préparer les e-mails d’un budget.',
          level: NotificationDialogLevel.Info,
        });
      },
      error: (error: APIError) => {
        this.saving = false;
        this.form.enable({ emitEvent: false });
        for (const control of [this.variable, this.target, this.customName])
          control.enable({ emitEvent: false });
        this.error =
          error.status === 401
            ? 'Ta session a expiré. Reconnecte-toi avant de réessayer.'
            : error.status === 403
              ? 'Tes droits ne permettent pas d’enregistrer ce modèle.'
              : error.status === 0
                ? 'La réponse n’a pas été reçue. Ta saisie est conservée. Vérifie la liste des modèles avant de relancer l’enregistrement.'
                : 'Impossible d’enregistrer le modèle. Ta saisie est conservée ; réessaie.';
      },
    });
  }
}
