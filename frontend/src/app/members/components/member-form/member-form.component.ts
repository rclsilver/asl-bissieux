import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  BehaviorSubject,
  Observable,
  finalize,
  forkJoin,
  of,
  switchMap,
} from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';

@Component({
  selector: 'app-member-form',
  templateUrl: './member-form.component.html',
  styleUrls: ['./member-form.component.scss'],
})
export class MemberFormComponent {
  private readonly _notifications = inject(NotificationsService);
  private readonly _builder = inject(FormBuilder);
  private readonly _api = inject(ApiService);

  private _saving$ = new BehaviorSubject(false);
  readonly saving$ = this._saving$.asObservable();

  readonly form: FormGroup;

  // units
  readonly units$ = this._api.listUnits();
  selectedUnits: APISchemas['ModelsUnit'][];

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: {
      member?: APISchemas['ModelsMember'];
    },
    private readonly _dialogRef: MatDialogRef<MemberFormComponent>
  ) {
    this.form = this._builder.group({
      first_name: [this.data.member?.first_name, [Validators.required]],
      last_name: [this.data.member?.last_name, [Validators.required]],
      email: [this.data.member?.email, [Validators.required]],
      phone_number: [this.data.member?.phone_number],
      address: [this.data.member?.address],
    });

    this.selectedUnits = this.data.member?.units ?? [];

    if (this.data.member) {
      this.form.markAllAsTouched();
    }
  }

  displayUnit(unit: APISchemas['ModelsUnit']) {
    return `Unit ${unit.number} (${unit.address})`;
  }

  displaySelectedUnit(unit: APISchemas['ModelsUnit']) {
    return `Unit ${unit.number}`;
  }

  filterUnit(filter: string, unit: APISchemas['ModelsUnit']) {
    if (!filter.length) {
      return true;
    }

    if (('' + (unit.number ?? 0)).indexOf(filter) !== -1) {
      return true;
    }

    if ((unit.address ?? '').indexOf(filter) !== -1) {
      return true;
    }

    return false;
  }

  cancel() {
    this._dialogRef.close(false);
  }

  submit() {
    this._saving$.next(true);

    const payload: Partial<APISchemas['ModelsMember']> = {
      first_name: this.form.value.first_name,
      last_name: this.form.value.last_name,
      email: this.form.value.email,
      phone_number: this.form.value.phone_number,
      address: this.form.value.address,
    };

    const result$ = !this.data.member?.id
      ? this._api.createMember(payload)
      : this._api.updateMember(this.data.member.id, payload);

    result$
      .pipe(
        finalize(() => this._saving$.next(false)),
        switchMap((member) => this._api.getMember(member?.id!)),
        switchMap((member) => {
          const operations: Observable<null>[] = [];

          for (let unit of member?.units ?? []) {
            if (!this.selectedUnits.filter((u) => u.id === unit.id).length) {
              operations.push(
                this._api.removeMemberUnit(member?.id!, unit.id!)
              );
            }
          }

          for (let unit of this.selectedUnits) {
            if (!(member?.units ?? []).filter((u) => u.id === unit.id).length) {
              operations.push(this._api.addMemberUnit(member?.id!, unit.id!));
            }
          }

          if (operations.length) {
            return forkJoin(operations).pipe(
              switchMap((_) => this._api.getMember(member?.id!))
            );
          } else {
            return of(member);
          }
        })
      )
      .subscribe({
        next: (member) => {
          this._notifications
            .showDialog({
              title: 'Success',
              message: this.data.member?.id
                ? `Member ${member?.first_name} ${member?.last_name} has been updated`
                : `Member ${member?.first_name} ${member?.last_name} has been created`,
              level: NotificationDialogLevel.Info,
            })
            .afterClosed()
            .subscribe(() => this._dialogRef.close(true));
        },
        error: this._api.handleError(
          this.data.member?.id
            ? 'Unable to update member'
            : 'Unable to create member'
        ),
      });
  }
}
