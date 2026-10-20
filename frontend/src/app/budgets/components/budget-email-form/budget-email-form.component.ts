import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService, APIError } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';
import { PaymentState, paymentState } from '../../payment-state';

type Recipient = {
  member: APISchemas['ModelsMember'];
  name: string;
  lots: number[];
};

@Component({
  selector: 'app-budget-email-form',
  templateUrl: './budget-email-form.component.html',
  styleUrls: ['./budget-email-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class BudgetEmailFormComponent implements OnInit, OnDestroy {
  private readonly destroyed$ = new Subject<void>();
  private readonly notifications = inject(NotificationsService);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private cotisations: APISchemas['ModelsCotisationResult'][] = [];
  private revision = 0;
  private previewRevision = -1;
  templates: APISchemas['ModelsEmailTemplate'][] = [];
  recipients: Recipient[] = [];
  missingEmailCount = 0;
  ready = false;
  loading = false;
  loadError = '';
  error = '';
  previewing = false;
  creating = false;
  allowedToCreate = false;
  previewResult?: APISchemas['ModelsBuiltEmail'];
  previewRecipient?: Recipient;
  readonly form = new FormGroup({
    template: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        (control) =>
          this.templates.some((template) => template.id === control.value)
            ? null
            : { selection: true },
      ],
    }),
    data: new FormControl('{}', {
      nonNullable: true,
      validators: Validators.required,
    }),
    to_doing: new FormControl(false, { nonNullable: true }),
    to_paid: new FormControl(false, { nonNullable: true }),
    previewMember: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        (control) =>
          this.recipients.some(
            (recipient) => recipient.member.id === control.value
          )
            ? null
            : { selection: true },
      ],
    }),
  });

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: { budget: APISchemas['ModelsBudget'] },
    private readonly dialog: MatDialogRef<BudgetEmailFormComponent>
  ) {
    this.form.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe(() => {
      this.revision++;
      this.updateRecipients();
    });
    this.auth
      .allowed$('budget.SendEmail')
      .pipe(takeUntil(this.destroyed$))
      .subscribe((allowed) => (this.allowedToCreate = allowed));
  }

  ngOnInit() {
    this.load();
  }
  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  load() {
    if (this.loading || this.creating) return;
    if (this.ready && this.form.controls.data.invalid) {
      this.error =
        'Corrige les valeurs supplémentaires avant d’actualiser les destinataires.';
      return;
    }
    if (!this.data.budget.id) {
      this.loadError =
        'Le budget n’est plus disponible. Ferme cette fenêtre puis réessaie.';
      return;
    }
    this.loading = true;
    this.ready = false;
    this.loadError = '';
    this.error = '';
    this.revision++;
    forkJoin({
      templates: this.api.listEmailTemplates(),
      cotisations: this.api.listCotisations(this.data.budget.id),
    })
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: ({ templates, cotisations }) => {
          this.templates = templates;
          this.cotisations = cotisations;
          this.updateRecipients();
          this.form.controls.template.updateValueAndValidity({
            emitEvent: false,
          });
          this.loading = false;
          this.ready = true;
        },
        error: () => {
          this.loading = false;
          this.loadError =
            'Impossible de charger les modèles et les destinataires. Réessaie sans fermer cette fenêtre.';
        },
      });
  }

  get selectedRecipient() {
    return this.recipients.find(
      (recipient) =>
        recipient.member.id === this.form.controls.previewMember.value
    );
  }
  get canPreview() {
    return (
      this.ready &&
      this.form.valid &&
      this.recipients.length > 0 &&
      !this.previewing &&
      !this.creating
    );
  }
  get previewCurrent() {
    return !!this.previewResult && this.previewRevision === this.revision;
  }
  get canPrepare() {
    return this.allowedToCreate && this.canPreview && this.previewCurrent;
  }

  private updateRecipients() {
    const members = new Map<string, Recipient>();
    for (const cotisation of this.cotisations) {
      const state = paymentState(cotisation);
      if (state === PaymentState.Doing && !this.form.controls.to_doing.value)
        continue;
      if (
        (state === PaymentState.Done || state === PaymentState.Overpaid) &&
        !this.form.controls.to_paid.value
      )
        continue;
      for (const member of cotisation.unit?.members ?? []) {
        if (!member.id) continue;
        let recipient = members.get(member.id);
        if (!recipient) {
          recipient = {
            member,
            name:
              [member.first_name, member.last_name].filter(Boolean).join(' ') ||
              member.email ||
              'Membre',
            lots: [],
          };
          members.set(member.id, recipient);
        }
        const number = cotisation.unit?.number;
        if (number !== undefined && !recipient.lots.includes(number))
          recipient.lots.push(number);
      }
    }
    this.missingEmailCount = [...members.values()].filter(
      (recipient) => !recipient.member.email
    ).length;
    this.recipients = [...members.values()]
      .filter((recipient) => !!recipient.member.email)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    this.recipients.forEach((recipient) =>
      recipient.lots.sort((a, b) => a - b)
    );
    if (!this.selectedRecipient)
      this.form.controls.previewMember.setValue(
        this.recipients[0]?.member.id ?? '',
        { emitEvent: false }
      );
    this.form.controls.previewMember.updateValueAndValidity({
      emitEvent: false,
    });
  }

  private payload() {
    const values = this.form.getRawValue();
    const data = JSON.parse(values.data);
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error('invalid data');
    return {
      template_id: values.template,
      data,
      send_to_doing: values.to_doing,
      send_to_paid: values.to_paid,
    };
  }

  preview() {
    if (!this.canPreview) {
      this.form.markAllAsTouched();
      return;
    }
    let payload;
    try {
      payload = {
        ...this.payload(),
        member_id: this.form.controls.previewMember.value,
      };
    } catch {
      this.error =
        'Corrige les valeurs supplémentaires avant de prévisualiser le message.';
      return;
    }
    const revision = this.revision;
    this.previewRevision = -1;
    this.previewing = true;
    this.error = '';
    this.api
      .previewBudgetEmail(this.data.budget.id!, payload)
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (result) => {
          this.previewing = false;
          if (revision !== this.revision) {
            this.error =
              'Les informations ont changé pendant le calcul. Relance l’aperçu.';
            return;
          }
          if (
            typeof result?.subject !== 'string' ||
            typeof result?.message !== 'string'
          ) {
            this.error = 'L’aperçu est incomplet. Réessaie.';
            return;
          }
          this.previewResult = result;
          this.previewRecipient = this.selectedRecipient;
          this.previewRevision = revision;
        },
        error: (error) => {
          this.previewing = false;
          this.error = this.describeError(error, 'prévisualiser le message');
        },
      });
  }

  submit() {
    if (!this.canPrepare) return;
    let payload;
    try {
      payload = this.payload();
    } catch {
      this.error =
        'Corrige les valeurs supplémentaires avant de créer les e-mails.';
      return;
    }
    this.creating = true;
    this.form.disable({ emitEvent: false });
    this.error = '';
    this.api
      .sendBudgetEmail(this.data.budget.id!, payload)
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: () => {
          this.creating = false;
          this.dialog.close(true);
          this.notifications.showDialog({
            title: 'Préparation terminée',
            message:
              'Retrouve les e-mails dans E-mails > Campagnes pour les vérifier et les envoyer.',
            level: NotificationDialogLevel.Info,
          });
        },
        error: (error) => {
          this.form.enable({ emitEvent: false });
          this.creating = false;
          this.error = this.describeError(error, 'créer les e-mails');
        },
      });
  }

  private describeError(error: APIError, operation: string) {
    if (operation === 'créer les e-mails' && error.status === 0)
      return 'La réponse n’a pas été reçue. Tes valeurs sont conservées. Vérifie E-mails > Campagnes avant de relancer la création.';
    if (error.status === 401)
      return 'Ta session a expiré. Ferme cette fenêtre puis reconnecte-toi.';
    if (error.status === 403)
      return 'Tes droits ne permettent pas cette opération.';
    if (error.status === 404)
      return 'Le budget, le modèle ou le membre n’est plus disponible. Ferme puis rouvre cette fenêtre.';
    const message =
      typeof error.data?.message === 'string' ? error.data.message : '';
    if (
      message.includes('ne fait pas partie des destinataires sélectionnés') ||
      message.includes('n’a pas d’adresse e-mail')
    )
      return 'Ce membre ne fait plus partie des destinataires disponibles. Actualise les destinataires puis relance l’aperçu.';
    const missing = /map has no entry for key "([^"]+)"/.exec(message);
    if (missing)
      return `Le modèle attend la valeur « ${missing[1]} ». Vérifie les valeurs supplémentaires et le modèle, puis réessaie.`;
    return error.status === 400
      ? `Impossible de ${operation}. Vérifie le modèle et ses valeurs, puis réessaie.`
      : `Impossible de ${operation} pour le moment. Tes valeurs sont conservées ; réessaie.`;
  }

  cancel() {
    if (!this.creating) this.dialog.close(false);
  }
}
