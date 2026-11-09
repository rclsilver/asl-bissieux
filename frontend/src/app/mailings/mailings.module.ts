import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { isAdministrator } from '../core/guards/auth.guard';
import { MailingsComponent } from './mailings.component';
@NgModule({
  declarations: [MailingsComponent],
  imports: [
    CommonModule,
    MatButtonModule,
    RouterModule.forChild([
      {
        path: '',
        component: MailingsComponent,
        canActivate: [isAdministrator],
      },
    ]),
  ],
})
export class MailingsModule {}
