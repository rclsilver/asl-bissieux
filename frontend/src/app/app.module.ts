import { NgModule } from '@angular/core';
import { AppRoutingModule } from './app-routing.module';
import { CoreModule } from './core/core.module';
import { UsersModule } from './users/users.module';
import { AppComponent } from './app.component';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { AuthInterceptor } from './core/interceptors/auth-interceptor';
import { ApiService } from './core/services/api.service';
import { AuthService } from './core/services/auth.service';
import { MatDialogModule } from '@angular/material/dialog';
import {
  WithGoogleAuthConfig,
  WithGoogleAuthModule,
} from 'ngx-sign-in-with-google';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    WithGoogleAuthModule,
    CoreModule,
    AppRoutingModule,
    UsersModule,
    MatDialogModule,
  ],
  providers: [
    AuthService,
    ApiService,
    {
      provide: 'WithGoogleAuthConfig',
      useValue: {
        clientId: environment.auth.clientId,
        scopes: 'openid profile email',
        prompt: 'none',
        enableOneTap: false,
        buttonConfig: {
          type: 'standard',
          theme: 'outline',
          size: 'medium',
          text: 'continue_with',
          logo_alignment: 'left',
        },
        interceptUrlPrefixes: [],
      } as unknown as WithGoogleAuthConfig,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
