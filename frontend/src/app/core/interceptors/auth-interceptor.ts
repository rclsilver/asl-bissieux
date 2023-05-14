import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
} from '@angular/common/http';

import { Observable, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private readonly _auth: AuthService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return this._auth.token$.pipe(
      switchMap((token) => {
        if (token && token.length) {
          req = req.clone({
            headers: req.headers.set('Authorization', `Bearer ${token}`),
          });
        }

        return next.handle(req);
      })
    );
  }
}
