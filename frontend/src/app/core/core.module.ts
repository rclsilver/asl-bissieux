import {
  APP_INITIALIZER,
  ModuleWithProviders,
  NgModule,
  Optional,
  SkipSelf,
} from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import {
  AuthConfig,
  OAuthModule,
  OAuthModuleConfig,
  OAuthStorage,
} from 'angular-oauth2-oidc';
import { AuthService } from './auth.service';
import { authAppInitializerFactory } from './auth-app-initializer.factory';
import { authConfig } from './auth.config';
import { authModuleConfig } from './auth-module.config';
import { ApiService } from './api.service';

export function storageFactory(): OAuthStorage {
  return localStorage;
}

@NgModule({
  imports: [HttpClientModule, OAuthModule.forRoot()],
  providers: [AuthService, ApiService],
})
export class CoreModule {
  static forRoot(): ModuleWithProviders<CoreModule> {
    return {
      ngModule: CoreModule,
      providers: [
        {
          provide: APP_INITIALIZER,
          useFactory: authAppInitializerFactory,
          deps: [AuthService],
          multi: true,
        },
        { provide: AuthConfig, useValue: authConfig },
        { provide: OAuthModuleConfig, useValue: authModuleConfig },
        { provide: OAuthStorage, useFactory: storageFactory },
      ],
    };
  }

  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error(
        'CoreModule is already loaded. Import it in the AppModule only'
      );
    }
  }
}
