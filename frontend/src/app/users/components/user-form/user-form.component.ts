import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, takeUntil } from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import {
  accessLabels,
  accessState,
  permissionGroup,
  permissionLabel,
  providerLabel,
} from '../../user-labels';

@Component({
  selector: 'app-user-form',
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class UserFormComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly builder = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();
  readonly form: FormGroup;
  readonly permissionLabel = permissionLabel;
  readonly providerLabel = providerLabel;
  readonly accessLabels = accessLabels;
  readonly accessState = accessState;
  groups: { label: string; actions: string[] }[] = [];
  loadingActions = true;
  actionsError = false;
  saving = false;
  error = '';
  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: { user?: APISchemas['AuthUser'] },
    private readonly dialog: MatDialogRef<UserFormComponent>
  ) {
    this.form = this.builder.group({
      username: [
        data.user?.username ?? '',
        [Validators.required, Validators.maxLength(320)],
      ],
      admin: [!!data.user?.admin],
      actions: [data.user?.actions ?? []],
    });
  }
  ngOnInit() {
    this.loadActions();
  }
  loadActions() {
    if (this.saving) return;
    this.loadingActions = true;
    this.actionsError = false;
    this.api
      .listActions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (actions) => {
          const all = [
            ...new Set([...actions, ...(this.data.user?.actions ?? [])]),
          ];
          const groups = new Map<string, string[]>();
          for (const action of all) {
            const group = permissionGroup(action);
            groups.set(group, [...(groups.get(group) ?? []), action]);
          }
          this.groups = [...groups].map(([label, actions]) => ({
            label,
            actions: actions.sort((a, b) =>
              permissionLabel(a).localeCompare(permissionLabel(b), 'fr')
            ),
          }));
          this.loadingActions = false;
        },
        error: () => {
          this.loadingActions = false;
          this.actionsError = true;
        },
      });
  }
  cancel() {
    if (!this.saving) this.dialog.close(false);
  }
  submit() {
    if (this.saving || this.loadingActions || this.actionsError) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: APISchemas['UpdateUserInput'] = {
      username: v.username.trim(),
      enabled: this.data.user?.enabled ?? false,
      admin: v.admin,
      actions: v.actions,
      expected_updated_at: this.data.user?.updated_at,
    };
    if (!body.username) {
      this.form.controls['username'].setErrors({ required: true });
      return;
    }
    this.saving = true;
    this.error = '';
    this.form.disable();
    const request = this.data.user?.id
      ? this.api.updateUser(this.data.user.id, body)
      : this.api.createUser(body);
    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.dialog.close(true),
      error: (e) => {
        this.saving = false;
        this.form.enable();
        this.error =
          e.data?.message ??
          'Impossible d’enregistrer les droits. La saisie est conservée.';
      },
    });
  }
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
