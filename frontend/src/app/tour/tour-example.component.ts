import { CommonModule } from '@angular/common';
import {
  Component,
  ChangeDetectionStrategy,
  Input,
  OnDestroy,
  TemplateRef,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { SharedModule } from '../shared/shared.module';
import { TourStep } from './tour.service';

// Deliberately has no API service, datasource, real IDs or business forms.
@Component({
  selector: 'app-tour-example',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    SharedModule,
  ],
  templateUrl: './tour-example.component.html',
  styleUrls: ['./tour-example.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class TourExampleComponent implements OnDestroy {
  @Input({ required: true }) step!: TourStep;
  @ViewChild('memberDetails', { static: true })
  private memberDetails!: TemplateRef<unknown>;
  private readonly dialogs = inject(MatDialog);
  private dialog?: MatDialogRef<unknown>;
  readonly members = [
    { name: 'Camille Martin', email: 'camille@example.invalid', lots: [1, 24] },
    { name: 'Noé Laurent', email: 'noe@example.invalid', lots: [1] },
    { name: 'Louise Petit', email: 'louise@example.invalid', lots: [12] },
  ];
  readonly mapClasses = Object.fromEntries(
    Array.from({ length: 42 }, (_, i) => [
      i + 1,
      [
        'dashboard-settled',
        'dashboard-partial',
        'dashboard-unpaid',
        'dashboard-overpaid',
        'dashboard-no-call',
      ][i % 5],
    ])
  );
  query = '';
  selected = 1;
  year = '2027';
  published = false;
  amount = '50,00';
  paid = 0;
  exampleError = '';
  message = '';
  emailState = 'WAITING';
  accessApproved = false;
  mailingsPreview = false;
  mailingsApplied = false;
  allowed(action: string) {
    return (this.step.capabilities ?? []).includes(action);
  }
  money(cents: number) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }
  get matches() {
    const normalize = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('fr')
        .trim();
    const query = normalize(this.query).replace(/^lot\s+/, '');
    return this.members.filter((m) =>
      normalize(m.name + ' ' + m.email + ' ' + m.lots.join(' ')).includes(query)
    );
  }
  get selectedMembers() {
    return this.members.filter((m) => m.lots.includes(this.selected));
  }
  openLot(number: number, event?: MouseEvent | KeyboardEvent) {
    this.selected = number;
    if (event?.currentTarget instanceof SVGElement)
      (event.currentTarget as SVGGElement).focus();
    this.dialog = this.dialogs.open(this.memberDetails, {
      width: '32rem',
      maxWidth: 'calc(100vw - 2rem)',
      autoFocus: 'first-heading',
    });
  }
  simulatePayment() {
    this.exampleError = '';
    if (!/^\d+(?:[,.]\d{1,2})?$/.test(this.amount.trim())) {
      this.exampleError =
        'Indique un montant positif avec deux décimales au maximum.';
      return;
    }
    const cents = Math.round(Number(this.amount.replace(',', '.')) * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 1000000) {
      this.exampleError =
        'Choisis un montant entre 0,01 € et 10 000 € pour cet exemple.';
      return;
    }
    this.paid = cents;
    this.message =
      'Paiement simulé. Dans le site, la date et le commentaire permettent de retrouver le règlement.';
  }
  ngOnDestroy() {
    this.dialog?.close();
  }
}
