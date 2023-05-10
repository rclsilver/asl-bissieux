import { Injectable } from '@angular/core';
import { APIPaths, APIRequests, APIResponse, APISchemas } from './openapi';
import { Observable, catchError, filter, map, tap } from 'rxjs';
import { HttpParams, HttpRequest, HttpResponse } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  constructor(private _http: HttpClient) {}

  getCurrentUser() {
    return this.request('/api/auth/me', {
      method: 'get',
    });
  }

  listBudgets() {
    return this.request('/api/budget', {
      method: 'get',
    });
  }

  createBudget(payload: APISchemas['CreateBudgetInput']) {
    return this.request('/api/budget', {
      method: 'post',
      body: payload,
    });
  }

  getBudget(budgetId: string) {
    return this.request('/api/budget/{budget_id}', {
      method: 'get',
      urlParams: {
        budget_id: budgetId,
      },
    });
  }

  private request<
    Path extends APIPaths,
    Options extends APIRequests<Path>,
    Result extends APIResponse<Path, Options['method']>
  >(path: Path, options?: Options) {
    options = (options ?? {}) as Options;

    // build the uri from the path and the url params
    let uri: string = path;
    if ('urlParams' in options) {
      for (const [name, value] of Object.entries(options.urlParams)) {
        uri = uri.replace(`{${name}}`, value.toString());
      }
    }

    // build the query params
    let params = new HttpParams();
    if ('query' in options && options.query) {
      for (const [name, value] of Object.entries(options.query)) {
        params.set(
          name,
          typeof value === 'object'
            ? JSON.stringify(value)
            : (value as any).toString()
        );
      }
    }

    // build the request
    let request = new HttpRequest(
      (options['method'] ?? 'get').toUpperCase() as
        | 'DELETE'
        | 'GET'
        | 'HEAD'
        | 'JSONP'
        | 'OPTIONS',
      uri,
      {
        params,
      }
    );

    // execute the request and return the response
    return this._http.request<Result>(request).pipe(
      catchError((err) => {
        console.error(err);
        return new Observable<Result>();
      }),
      filter((event) => event instanceof HttpResponse),
      map((event) => (event as HttpResponse<Result>).body)
    );
  }
}

export class APIError extends Error {
  constructor(public data: object, public status: number) {
    super();
  }
}
