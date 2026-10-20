import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { APISchemas } from 'src/app/core/api/openapi';
import { ApiService } from 'src/app/core/services/api.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { validMoneyInput } from '../../money-input';

type Entry = APISchemas['ModelsFinancialEntry'];
type FinancialPayload = APISchemas['CreateFinancialEntryInput'];

@Component({
  selector: 'app-financial-history',
  standalone: false,
  templateUrl: './financial-history.component.html',
  styleUrls: ['./financial-history.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class FinancialHistoryComponent implements OnInit, OnDestroy {
  @Input({ required: true }) budgetId!: string;
  @Input({ required: true }) cotisationId!: string;
  @Output() changed = new EventEmitter<void>();
  @Output() addPayment = new EventEmitter<void>();
  private readonly api = inject(ApiService);
  private readonly document = inject(DOCUMENT);
  @ViewChild('effectTitle') set effectTitle(
    title: ElementRef<HTMLElement> | undefined
  ) {
    if (title)
      queueMicrotask(() => {
        if (this.alive) title.nativeElement.focus();
      });
  }
  @ViewChild('operationTitle') set operationTitle(
    title: ElementRef<HTMLElement> | undefined
  ) {
    if (title)
      queueMicrotask(() => {
        if (this.alive) title.nativeElement.focus();
      });
  }
  focusEntry(event: Event, id: string) {
    event.preventDefault();
    const row = this.document.getElementById('financial-entry-' + id);
    row?.focus();
    row?.scrollIntoView?.({ block: 'nearest' });
  }
  private readonly auth = inject(AuthService);
  private readonly loadCancel$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();
  private readonly builder = inject(FormBuilder);
  readonly canRefund$ = this.auth.allowed$('budget.CreateRefund');
  readonly canAdjust$ = this.auth.allowed$('budget.CreateAdjustment');
  readonly canPay$ = this.auth.allowed$('budget.CreatePayment');
  readonly form = this.builder.nonNullable.group({
    amount: [
      0,
      [
        (c: { value: unknown }) =>
          validMoneyInput(c.value) ? null : { money: true },
      ],
    ],
    direction: ['increase'],
    date: [this.today(), Validators.required],
    reason: ['', [Validators.required, Validators.maxLength(1000)]],
    reference: ['', Validators.maxLength(200)],
  });
  cotisation: APISchemas['ModelsCotisationResult'] | null = null;
  entries: Entry[] = [];
  loading = true;
  loadError = false;
  error = '';
  busy = false;
  kind: 'refund' | 'adjustment' | null = null;
  reversal: Entry | null = null;
  preview: APISchemas['ModelsFinancialPreview'] | null = null;
  private operationId = '';
  private payload: FinancialPayload | null = null;
  private alive = true;

  ngOnInit() {
    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.preview = null;
      this.payload = null;
      this.error = '';
    });
    this.load();
  }
  today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  amount(n?: number) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(n ?? 0);
  }
  members() {
    return (
      (this.cotisation?.unit?.members ?? [])
        .map((m) => `${m.first_name} ${m.last_name}`)
        .join(', ') || 'Aucun membre associé'
    );
  }
  reversed(entry: Entry) {
    return this.entries.some((e) => e.reverses_id === entry.id);
  }
  load() {
    if (!this.alive) return;
    this.loadCancel$.next();
    this.preview = null;
    this.payload = null;
    this.loading = true;
    this.loadError = false;
    forkJoin({
      rows: this.api.listCotisations(this.budgetId),
      entries: this.api.listFinancialEntries(this.budgetId, this.cotisationId),
    })
      .pipe(takeUntil(this.loadCancel$), takeUntil(this.destroy$))
      .subscribe({
        next: ({ rows, entries }) => {
          this.cotisation =
            rows.find((c) => c.id === this.cotisationId) ?? null;
          this.entries = entries;
          this.loading = false;
          this.loadError = !this.cotisation;
        },
        error: () => {
          this.loading = false;
          this.loadError = true;
        },
      });
  }
  start(kind: 'refund' | 'adjustment', entry: Entry | null = null) {
    if (this.busy || this.loading || this.loadError) return;
    this.kind = kind;
    this.reversal = entry;
    this.preview = null;
    this.payload = null;
    this.error = '';
    this.operationId = crypto.randomUUID();
    this.form.reset({
      amount: entry ? Math.abs(entry.amount ?? 0) : 0,
      direction: 'increase',
      date: this.today(),
      reason: '',
      reference: '',
    });
  }
  cancel() {
    if (!this.busy) {
      this.kind = null;
      this.preview = null;
      this.payload = null;
    }
  }
  review() {
    if (this.busy || !this.kind || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload: FinancialPayload = {
      id: this.operationId,
      kind: this.kind,
      amount:
        this.kind === 'adjustment' && v.direction === 'decrease'
          ? -v.amount
          : v.amount,
      date: v.date,
      reason: v.reason.trim(),
      reference: v.reference.trim(),
      reverses_id: this.reversal?.id,
    };
    if (!payload.reason) {
      this.error = 'Indique le motif de cette opération.';
      return;
    }
    this.busy = true;
    this.form.disable({ emitEvent: false });
    this.error = '';
    this.api
      .previewFinancialEntry(this.budgetId, this.cotisationId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (p) => {
          this.busy = false;
          this.form.enable({ emitEvent: false });
          this.preview = p;
          this.payload = { ...payload, version: p?.version };
        },
        error: (e) => {
          this.busy = false;
          this.form.enable({ emitEvent: false });
          this.error =
            e.data?.message ?? 'Impossible de prévisualiser. Réessaie.';
        },
      });
  }
  confirm() {
    if (this.busy || !this.preview || !this.payload) return;
    this.busy = true;
    this.form.disable({ emitEvent: false });
    this.error = '';
    this.api
      .createFinancialEntry(this.budgetId, this.cotisationId, this.payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.busy = false;
          this.form.enable({ emitEvent: false });
          this.cancel();
          this.load();
          this.changed.emit();
        },
        error: (e) => {
          this.busy = false;
          this.form.enable({ emitEvent: false });
          this.preview = null;
          this.payload = null;
          this.error =
            e.data?.message ??
            'La réponse n’a pas été reçue. Vérifie l’historique avant de réessayer.';
          this.load();
        },
      });
  }
  ngOnDestroy() {
    this.alive = false;
    this.destroy$.next();
    this.destroy$.complete();
  }
}
