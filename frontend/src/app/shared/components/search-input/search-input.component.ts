import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { BehaviorSubject, fromEvent, merge, Subject } from 'rxjs';
import { takeUntil, map, distinctUntilChanged } from 'rxjs/operators';
import { Column } from '../../models/column.model';

@Component({
  selector: 'app-search-input',
  templateUrl: './search-input.component.html',
  styleUrls: ['./search-input.component.scss'],
})
export class SearchInputComponent implements OnDestroy {
  private _destroyed$ = new Subject<void>();
  private _clear$ = new Subject<void>();
  private _pattern: string = '';
  private _input?: ElementRef;
  private _folded$ = new BehaviorSubject<boolean>(true);
  private _columns = new BehaviorSubject<Column[]>([]);

  readonly folded$ = this._folded$.asObservable();
  readonly columns$ = this._columns.asObservable();
  readonly label$ = this.columns$.pipe(
    map((columns) => columns.map((c) => c.label).join(' / '))
  );

  @Input() set columns(columns: Column[] | null) {
    this._columns.next(!columns ? [] : columns);
  }

  @Output() onPatternChange = new EventEmitter<string>();

  @ViewChild('input', { static: false }) set input(
    input: ElementRef | undefined
  ) {
    this._input = input;

    if (input) {
      // Looking for keyup & change on search input
      merge(fromEvent(input.nativeElement, 'input'), this._clear$)
        .pipe(
          takeUntil(this._destroyed$),
          map(() => input.nativeElement.value),
          distinctUntilChanged()
        )
        .subscribe((pattern: string) => {
          this._pattern = pattern;
          this.onPatternChange.emit(pattern);
        });
    }
  }

  ngOnDestroy(): void {
    this._destroyed$.next();
    this._destroyed$.complete();
    this._clear$.complete();
    this._folded$.complete();
  }

  show(): void {
    this._folded$.next(false);
    setTimeout(() => this._input!.nativeElement.focus());
  }

  clear($event: UIEvent): void {
    $event.stopPropagation();
    this._input!.nativeElement.value = '';
    this._clear$.next();
    this._folded$.next(true);
  }

  get pattern(): string {
    return this._pattern;
  }
}
