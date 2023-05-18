import { COMMA, ENTER } from '@angular/cdk/keycodes';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import {
  BehaviorSubject,
  Subject,
  combineLatest,
  map,
  startWith,
  takeUntil,
} from 'rxjs';

export type DisplayFunction<T> = (option: T) => string;
export type FilterFunction<T> = (filter: string, option: T) => boolean;

@Component({
  selector: 'app-multi-select',
  templateUrl: './multi-select.component.html',
  styleUrls: ['./multi-select.component.scss'],
})
export class MultiSelectComponent<T> implements OnInit, OnDestroy {
  private _destroyed$ = new Subject<void>();

  // value attribute
  private _value$ = new BehaviorSubject<string>('id');

  @Input() set value(value: string) {
    this._value$.next(value);
  }

  // display attribute / function
  private _display$ = new BehaviorSubject<DisplayFunction<T> | undefined>(
    undefined
  );

  @Input() set display(display: string | DisplayFunction<T>) {
    if (typeof display === 'string') {
      this._display$.next((option: T) => (option as any)[display]);
    } else {
      this._display$.next(display);
    }
  }

  private _selectedDisplay$ = new BehaviorSubject<
    DisplayFunction<T> | undefined
  >(undefined);

  @Input() set selectedDisplay(display: string | DisplayFunction<T>) {
    if (typeof display === 'string') {
      this._selectedDisplay$.next((option: T) => (option as any)[display]);
    } else {
      this._selectedDisplay$.next(display);
    }
  }

  // filter function
  private _filterFunction$ = new BehaviorSubject<FilterFunction<T>>(
    (filter: string, option: T) => {
      const value = '' + (option as any)[this._value$.value];

      if (value && ('' + value).indexOf(filter) !== -1) {
        return true;
      }

      if (this._display$.value) {
        const display = this._display$.value(option);

        if (display && ('' + display).indexOf(filter) !== -1) {
          return true;
        }
      }

      return false;
    }
  );

  @Input() set filterFunction(f: FilterFunction<T>) {
    this._filterFunction$.next(f);
  }

  // selected options
  private _selected$ = new BehaviorSubject<T[]>([]);
  readonly selected$ = combineLatest([
    this._value$,
    this._display$,
    this._selectedDisplay$,
    this._selected$,
  ]).pipe(
    map(([value, display, selectedDisplay, selected]) => {
      if (!value || (!display && !selectedDisplay)) {
        return [];
      }
      return selected.map((option: T) => ({
        value: (option as any)[value],
        display: (selectedDisplay ?? display)!(option),
      }));
    })
  );

  @Input() set selected(selected: T[]) {
    this._selected$.next(selected);
  }

  @Output() selectedChange = new EventEmitter<T[]>();

  // auto-complete input
  readonly separatorKeysCodes: number[] = [ENTER, COMMA];
  readonly filterInputCtrl = new FormControl('');

  @ViewChild('filterInput') filterInput!: ElementRef<HTMLInputElement>;

  // available options
  private _options$ = new BehaviorSubject<T[]>([]);
  readonly options$ = combineLatest([
    this._value$,
    this._display$,
    this._options$,
    this._selected$,
    this._filterFunction$,
    this.filterInputCtrl.valueChanges.pipe(startWith(null)),
  ]).pipe(
    map(([value, display, options, selected, filterFunction, filter]) => {
      if (!value || !display) {
        return [];
      }

      return options
        .filter(
          (option: T) =>
            selected.filter(
              (selected) => (selected as any)[value] === (option as any)[value]
            ).length === 0
        )
        .filter(
          (option: T) => filter === null || filterFunction(filter, option)
        )
        .map((option: T) => ({
          value: (option as any)[value],
          display: display(option),
        }));
    })
  );

  @Input() set options(options: T[] | null) {
    this._options$.next(options ?? []);
  }

  // common
  @Input() label = '';

  ngOnInit(): void {
    this._selected$
      .pipe(takeUntil(this._destroyed$))
      .subscribe((selected) => this.selectedChange.emit(selected));
  }

  ngOnDestroy(): void {
    this._destroyed$.next();
    this._destroyed$.complete();
  }

  add(event: MatAutocompleteSelectedEvent) {
    const option = this._options$.value.filter(
      (option) => (option as any)[this._value$.value] === event.option.value
    )[0];

    if (option !== undefined) {
      this._selected$.next([...this._selected$.value, option]);
    }

    this.filterInputCtrl.setValue('');
    this.filterInput.nativeElement.value = '';
  }

  remove(value: any) {
    this._selected$.next(
      this._selected$.value.filter(
        (option) => (option as any)[this._value$.value] !== value
      )
    );
  }
}
