import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { UnitsRouterModule } from './units.routes';
import { UnitListComponent } from './components/unit-list/unit-list.component';
import { UnitFormComponent } from './components/unit-form/unit-form.component';

const material = [
  MatButtonModule,
  MatDialogModule,
  MatFormFieldModule,
  MatInputModule,
  MatTableModule,
];

@NgModule({
  declarations: [UnitListComponent, UnitFormComponent],
  imports: [
    CommonModule,
    SharedModule,
    ReactiveFormsModule,
    ...material,
    UnitsRouterModule,
  ],
})
export class UnitsModule {}
