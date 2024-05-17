import { NgModule } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';

import { PageComponent } from './components/page/page.component';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CoreRouterModule } from './core.routes';
import { SharedModule } from '../shared/shared.module';
import { WithGoogleAuthModule } from 'ngx-sign-in-with-google';

const material = [
  MatCardModule,
  MatListModule,
  MatSidenavModule,
  MatIconModule,
  MatToolbarModule,
  MatButtonModule,
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule,
    CoreRouterModule,
    WithGoogleAuthModule,
    ...material,
    SharedModule,
  ],
  declarations: [PageComponent],
  exports: [PageComponent],
})
export class CoreModule {}
