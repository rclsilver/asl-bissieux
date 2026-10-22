import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { SharedModule } from '../shared/shared.module';
import { isAuthenticated } from '../core/guards/auth.guard';
import { CollectionsChartComponent } from './collections-chart.component';
import { DashboardComponent } from './dashboard.component';

@NgModule({
  declarations: [DashboardComponent, CollectionsChartComponent],
  imports: [
    CommonModule,
    SharedModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    RouterModule.forChild([
      {
        path: '',
        component: DashboardComponent,
        canActivate: [isAuthenticated],
      },
    ]),
  ],
})
export class DashboardModule {}
