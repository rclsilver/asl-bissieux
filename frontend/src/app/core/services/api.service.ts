import { Injectable } from '@angular/core';
import { APIPaths, APIRequests, APIResponse, APISchemas } from '../api/openapi';
import {
  EMPTY,
  Observable,
  catchError,
  empty,
  filter,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
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
    }).pipe(map((r) => r ?? []));
  }

  getBudget(budgetId: string) {
    return this.request('/api/budget/{budget_id}', {
      method: 'get',
      urlParams: {
        budget_id: budgetId,
      },
    });
  }

  createBudget(payload: APISchemas['CreateBudgetInput']) {
    return this.request('/api/budget', {
      method: 'post',
      body: payload,
    });
  }

  updateBudget(budgetId: string, payload: APISchemas['UpdateBudgetInput']) {
    return this.request('/api/budget/{budget_id}', {
      method: 'put',
      urlParams: {
        budget_id: budgetId,
      },
      body: payload,
    });
  }

  publishBudget(budgetId: string) {
    return this.request('/api/budget/{budget_id}/publish', {
      method: 'post',
      urlParams: {
        budget_id: budgetId,
      },
    });
  }

  deleteBudget(budgetId: string) {
    return this.request('/api/budget/{budget_id}', {
      method: 'delete',
      urlParams: {
        budget_id: budgetId,
      },
    });
  }

  listExpenses(budgetId: string) {
    return this.request('/api/budget/{budget_id}/expenses', {
      method: 'get',
      urlParams: {
        budget_id: budgetId,
      },
    }).pipe(map((r) => r ?? []));
  }

  createExpense(budgetId: string, payload: APISchemas['CreateExpenseInput']) {
    return this.request('/api/budget/{budget_id}/expenses', {
      method: 'post',
      urlParams: {
        budget_id: budgetId,
      },
      body: payload,
    });
  }

  updateExpense(
    budgetId: string,
    expenseId: string,
    payload: APISchemas['UpdateExpenseInput']
  ) {
    return this.request('/api/budget/{budget_id}/expenses/{expense_id}', {
      method: 'put',
      urlParams: {
        budget_id: budgetId,
        expense_id: expenseId,
      },
      body: payload,
    });
  }

  deleteExpense(budgetId: string, expenseId: string) {
    return this.request('/api/budget/{budget_id}/expenses/{expense_id}', {
      method: 'delete',
      urlParams: {
        budget_id: budgetId,
        expense_id: expenseId,
      },
    });
  }

  listCotisations(budgetId: string) {
    return this.request('/api/budget/{budget_id}/cotisations', {
      method: 'get',
      urlParams: {
        budget_id: budgetId,
      },
    }).pipe(map((r) => r ?? []));
  }

  listPayments(budgetId: string, cotisationId: string) {
    return this.request(
      '/api/budget/{budget_id}/cotisations/{cotisation_id}/payments',
      {
        method: 'get',
        urlParams: {
          budget_id: budgetId,
          cotisation_id: cotisationId,
        },
      }
    ).pipe(map((r) => r ?? []));
  }

  createPayment(
    budgetId: string,
    cotisationId: string,
    payload: APISchemas['CreatePaymentInput']
  ) {
    return this.request(
      '/api/budget/{budget_id}/cotisations/{cotisation_id}/payments',
      {
        method: 'post',
        urlParams: {
          budget_id: budgetId,
          cotisation_id: cotisationId,
        },
        body: payload,
      }
    );
  }

  updatePayment(
    budgetId: string,
    cotisationId: string,
    paymentId: string,
    payload: APISchemas['UpdatePaymentInput']
  ) {
    return this.request(
      '/api/budget/{budget_id}/cotisations/{cotisation_id}/payments/{payment_id}',
      {
        method: 'put',
        urlParams: {
          budget_id: budgetId,
          cotisation_id: cotisationId,
          payment_id: paymentId,
        },
        body: payload,
      }
    );
  }

  deletePayment(budgetId: string, cotisationId: string, paymentId: string) {
    return this.request(
      '/api/budget/{budget_id}/cotisations/{cotisation_id}/payments/{payment_id}',
      {
        method: 'delete',
        urlParams: {
          budget_id: budgetId,
          cotisation_id: cotisationId,
          payment_id: paymentId,
        },
      }
    );
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
      'body' in options ? options['body'] : undefined,
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
