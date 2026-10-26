import {
  Component,
  Inject,
  inject,
  ChangeDetectionStrategy,
  OnDestroy,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, takeUntil } from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService, APIError } from 'src/app/core/services/api.service';
import {
  templateSampleData,
  automaticTemplateRoots,
} from '../../template-variables';
import { validateTemplateValues } from 'src/app/shared/components/template-data-editor/template-data-validation';

@Component({
  selector: 'app-email-template-preview-form',
  templateUrl: './email-template-preview-form.component.html',
  styleUrls: ['./email-template-preview-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class EmailTemplatePreviewFormComponent implements OnDestroy {
  readonly automaticRoots = [...automaticTemplateRoots];
  private readonly api = inject(ApiService);
  private readonly destroyed$ = new Subject<void>();
  private revision = 0;
  private previewRevision = -1;
  readonly form = new FormGroup({
    source: new FormControl<'sample' | 'custom'>('sample', {
      nonNullable: true,
    }),
    sampleData: new FormControl(JSON.stringify(templateSampleData, null, 2), {
      nonNullable: true,
      validators: Validators.required,
    }),
    customData: new FormControl('{}', {
      nonNullable: true,
      validators: Validators.required,
    }),
  });
  previewing = false;
  error = '';
  result?: APISchemas['ModelsBuiltEmail'];
  resultSource = '';

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: { template: APISchemas['ModelsEmailTemplate'] },
    private readonly dialog: MatDialogRef<EmailTemplatePreviewFormComponent>
  ) {
    for (const control of [
      this.form.controls.sampleData,
      this.form.controls.customData,
    ]) {
      control.addValidators((value) =>
        validateTemplateValues(value.value, data.template.custom_fields?.fields)
      );
      control.updateValueAndValidity({ emitEvent: false });
    }
    this.form.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe(() => {
      this.revision++;
      if (this.activeData.invalid)
        this.form.controls.source.disable({ emitEvent: false });
      else this.form.controls.source.enable({ emitEvent: false });
    });
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }
  get activeData() {
    return this.form.controls.source.value === 'sample'
      ? this.form.controls.sampleData
      : this.form.controls.customData;
  }
  get canPreview() {
    return !!this.data.template.id && this.activeData.valid && !this.previewing;
  }
  get previewCurrent() {
    return !!this.result && this.previewRevision === this.revision;
  }
  close() {
    this.dialog.close(false);
  }

  submit() {
    if (!this.canPreview) {
      this.activeData.markAsTouched();
      return;
    }
    let data;
    try {
      data = JSON.parse(this.activeData.value);
      if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new Error('invalid data');
    } catch {
      this.error =
        'Corrige les données d’essai : elles doivent former un objet JSON valide.';
      return;
    }
    const revision = this.revision;
    const source =
      this.form.controls.source.value === 'sample'
        ? 'Exemple fictif, éventuellement adapté'
        : 'Données fournies pour cet essai';
    this.previewing = true;
    this.previewRevision = -1;
    this.error = '';
    this.api
      .previewEmailTemplate(this.data.template.id!, { data })
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (result) => {
          this.previewing = false;
          if (revision !== this.revision) {
            this.error =
              'Les données ont changé pendant le calcul. Relance l’aperçu.';
            return;
          }
          if (
            typeof result?.subject !== 'string' ||
            typeof result?.message !== 'string'
          ) {
            this.error = 'L’aperçu est incomplet. Réessaie.';
            return;
          }
          this.result = result;
          this.resultSource = source;
          this.previewRevision = revision;
        },
        error: (error: APIError) => {
          this.previewing = false;
          const message =
            typeof error.data?.message === 'string' ? error.data.message : '';
          const missing = /map has no entry for key "([^"]+)"/.exec(message);
          this.error =
            error.status === 401
              ? 'Ta session a expiré. Reconnecte-toi pour réessayer.'
              : error.status === 403
                ? 'Tes droits ne permettent pas cet aperçu.'
                : error.status === 404
                  ? 'Ce modèle n’est plus disponible. Ferme puis actualise la liste des modèles.'
                  : missing
                    ? `Le modèle attend la valeur « ${missing[1]} ». Ajoute-la aux données d’essai, puis relance l’aperçu.`
                    : error.status === 400
                      ? 'Le modèle ne peut pas être rendu avec ces données. Vérifie ses expressions et les données d’essai.'
                      : 'Impossible de calculer l’aperçu pour le moment. Tes données sont conservées ; réessaie.';
        },
      });
  }
}
