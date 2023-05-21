import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { CrudTableComponent } from './components/crud-table/crud-table.component';
import { NotificationDialogComponent } from './components/notification-dialog/notification-dialog.component';
import { MultiSelectComponent } from './components/multi-select/multi-select.component';
import { SearchInputComponent } from './components/search-input/search-input.component';

const material = [
  MatAutocompleteModule,
  MatButtonModule,
  MatCheckboxModule,
  MatChipsModule,
  MatDialogModule,
  MatFormFieldModule,
  MatIconModule,
  MatInputModule,
  MatMenuModule,
  MatProgressSpinnerModule,
  MatSortModule,
  MatTableModule,
  MatToolbarModule,
  MatTooltipModule,
];

@NgModule({
  declarations: [
    ConfirmDialogComponent,
    CrudTableComponent,
    NotificationDialogComponent,
    MultiSelectComponent,
    SearchInputComponent,
  ],
  exports: [CrudTableComponent, MultiSelectComponent],
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ...material],
})
export class SharedModule {}
