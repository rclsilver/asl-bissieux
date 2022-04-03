import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CandidatViewComponent } from './candidat/candidat-view/candidat-view.component';
import { CandidatListComponent } from './candidat/candidat-list/candidat-list.component';
import { HomeComponent } from './pages/home/home.component';

@NgModule({
  declarations: [AppComponent, CandidatViewComponent, CandidatListComponent, HomeComponent],
  imports: [BrowserModule, AppRoutingModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
