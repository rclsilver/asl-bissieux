import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { SharedModule } from '../shared/shared.module';
import { MembersRouterModule } from './members.routes';
import { MemberListComponent } from './components/member-list/member-list.component';
import { MemberListDialogComponent } from './components/member-list-dialog/member-list-dialog.component';
import { MemberFormComponent } from './components/member-form/member-form.component';

const material = [
  MatButtonModule,
  MatDialogModule,
  MatFormFieldModule,
  MatInputModule,
  MatTableModule,
];

@NgModule({
  declarations: [
    MemberListComponent,
    MemberListDialogComponent,
    MemberFormComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    ReactiveFormsModule,
    ...material,
    MembersRouterModule,
  ],
})
export class MembersModule {}
