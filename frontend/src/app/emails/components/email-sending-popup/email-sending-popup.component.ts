import { AfterViewInit, Component, Inject, inject } from '@angular/core';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  BehaviorSubject,
  Subject,
  combineLatest,
  concatAll,
  delay,
  map,
  of,
  takeUntil,
} from 'rxjs';
import { NotificationsService } from 'src/app/shared/services/notifications.service';

@Component({
  selector: 'app-email-sending-popup',
  templateUrl: './email-sending-popup.component.html',
  styleUrls: ['./email-sending-popup.component.scss'],
})
export class EmailSendingPopupComponent implements AfterViewInit {
  private readonly _api = inject(ApiService);
  private readonly _notifications = inject(NotificationsService);

  private _cancel$ = new Subject<void>();

  private _current$ = new BehaviorSubject(0);
  readonly current$ = this._current$.asObservable();

  private _sent$ = new BehaviorSubject(0);
  readonly sent$ = this._sent$.asObservable();

  private _errors$ = new BehaviorSubject(0);
  readonly errors$ = this._errors$.asObservable();

  private _total$ = new BehaviorSubject(this.data.emails.length);
  readonly total$ = this._total$.asObservable();

  readonly remaining$ = combineLatest([this.current$, this.total$]).pipe(
    map(([current, total]) => total - current)
  );

  readonly sending$ = this.remaining$.pipe(map((remaining) => remaining > 0));

  readonly progress$ = combineLatest([this.current$, this.total$]).pipe(
    map(([current, total]) =>
      Math.round(((current * 1.0) / (total * 1.0)) * 100.0)
    )
  );

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public readonly data: {
      emails: APISchemas['ModelsEmail'][];
    },
    private readonly _dialogRef: MatDialogRef<EmailSendingPopupComponent>
  ) {}

  ngAfterViewInit() {
    of(...this.data.emails)
      .pipe(
        map((email) => of(email).pipe(delay(500))),
        concatAll(),
        takeUntil(this._cancel$)
      )
      .subscribe((email) => {
        this._current$.next(this._current$.value + 1);

        this._api
          .sendEmail(email.id!, { wait: true })
          .pipe(takeUntil(this._cancel$))
          .subscribe({
            next: () => {
              this._sent$.next(this._sent$.value + 1);
            },
            error: () => {
              this._errors$.next(this._errors$.value + 1);
            },
          });
      });
  }

  abort() {
    this._notifications
      .showConfirm({
        title: 'Abort',
        message: 'Are you sure you want to stop the email sending?',
        class: 'warn',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this._cancel$.next();
          this._cancel$.complete();
          this.close();
        }
      });
  }

  close() {
    this._dialogRef.close(false);
  }
}
