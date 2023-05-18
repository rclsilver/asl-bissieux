import { Component, Inject, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BehaviorSubject, finalize } from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';

@Component({
  selector: 'app-user-form',
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.scss'],
})
export class UserFormComponent implements OnInit {
  private readonly _notifications = inject(NotificationsService);
  private readonly _builder = inject(FormBuilder);
  private readonly _api = inject(ApiService);

  private _saving$ = new BehaviorSubject(false);
  readonly saving$ = this._saving$.asObservable();

  private _actions$ = new BehaviorSubject<string[]>([]);
  readonly actions$ = this._actions$.asObservable();

  readonly form: FormGroup;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: {
      user?: APISchemas['AuthUser'];
    },
    private readonly _dialogRef: MatDialogRef<UserFormComponent>
  ) {
    this.form = this._builder.group({
      username: [this.data.user?.username, [Validators.required]],
      enabled: [this.data.user?.enabled],
      admin: [this.data.user?.admin],
      actions: [this.data.user?.actions],
    });

    if (this.data.user) {
      this.form.markAllAsTouched();
    }
  }

  ngOnInit() {
    this.loadActions();
  }

  loadActions() {
    this._api
      .listActions()
      .subscribe((actions) => this._actions$.next(actions));
  }

  cancel() {
    this._dialogRef.close(false);
  }

  submit() {
    this._saving$.next(true);

    const payload: Partial<APISchemas['AuthUser']> = {
      username: this.form.value.username,
      enabled: this.form.value.enabled,
      admin: this.form.value.admin,
      actions: this.form.value.actions,
    };

    const result$ = !this.data.user?.id
      ? this._api.createUser(payload)
      : this._api.updateUser(this.data.user.id, payload);

    result$.pipe(finalize(() => this._saving$.next(false))).subscribe({
      next: (user) => {
        this._notifications
          .showDialog({
            title: 'Success',
            message: this.data.user?.id
              ? `User ${user?.username} has been updated`
              : `User ${user?.username} has been created`,
            level: NotificationDialogLevel.Info,
          })
          .afterClosed()
          .subscribe(() => this._dialogRef.close(true));
      },
      error: (error) => {
        /*
      if (error.fields) {
        error.fields.forEach((field) =>
          this.form.controls[field.name].setErrors({ server: field.message })
        );
      } else {
        */
        this._notifications.showDialog({
          title: 'Error',
          message: this.data.user?.id
            ? `Unable to update user: ${error}`
            : `Unable to create user: ${error}`,
          level: NotificationDialogLevel.Error,
        });
        /*
      }
      */
      },
    });
  }
}
