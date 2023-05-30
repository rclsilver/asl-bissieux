import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {
  BehaviorSubject,
  Subject,
  distinctUntilChanged,
  map,
  startWith,
  takeUntil,
} from 'rxjs';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss'],
})
export class FileUploadComponent implements OnInit, OnDestroy {
  private _destroyed$ = new Subject<void>();

  private _file$ = new BehaviorSubject<File | undefined>(undefined);
  readonly filename$ = this._file$.pipe(map((f) => f?.name));

  @Output() selected = new EventEmitter<File | undefined>();

  ngOnInit() {
    this._file$
      .pipe(takeUntil(this._destroyed$), distinctUntilChanged())
      .subscribe((f) => this.selected.emit(f));
  }

  ngOnDestroy() {
    this._destroyed$.next();
    this._destroyed$.complete();
  }

  onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files ? target.files[0] : null;

    if (file) {
      this._file$.next(file);
    } else {
      this._file$.next(undefined);
    }
  }
}
