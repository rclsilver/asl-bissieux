import { Injectable } from '@angular/core';
import { APIPaths, APIRequests, APIResponse, APISchemas } from '../api/openapi';
import { Observable, catchError, filter, map } from 'rxjs';
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

  sendBudgetEmail(
    budgetId: string,
    payload: APISchemas['SendBudgetEmailInput']
  ) {
    return this.request('/api/budget/{budget_id}/email', {
      method: 'post',
      urlParams: {
        budget_id: budgetId,
      },
      body: payload,
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

  listUnits() {
    return this.request('/api/unit', {
      method: 'get',
    }).pipe(map((r) => r ?? []));
  }

  getUnit(unitId: string) {
    return this.request('/api/unit/{unit_id}', {
      method: 'get',
      urlParams: {
        unit_id: unitId,
      },
    });
  }

  createUnit(payload: APISchemas['CreateUnitInput']) {
    return this.request('/api/unit', {
      method: 'post',
      body: payload,
    });
  }

  updateUnit(unitId: string, payload: APISchemas['UpdateUnitInput']) {
    return this.request('/api/unit/{unit_id}', {
      method: 'put',
      urlParams: {
        unit_id: unitId,
      },
      body: payload,
    });
  }

  deleteUnit(unitId: string) {
    return this.request('/api/unit/{unit_id}', {
      method: 'delete',
      urlParams: {
        unit_id: unitId,
      },
    });
  }

  listUnitMembers(unitId: string) {
    return this.request('/api/unit/{unit_id}/members', {
      method: 'get',
      urlParams: {
        unit_id: unitId,
      },
    }).pipe(map((r) => r ?? []));
  }

  listMembers() {
    return this.request('/api/member', {
      method: 'get',
    }).pipe(map((r) => r ?? []));
  }

  getMember(memberId: string) {
    return this.request('/api/member/{member_id}', {
      method: 'get',
      urlParams: {
        member_id: memberId,
      },
    });
  }

  createMember(payload: APISchemas['CreateMemberInput']) {
    return this.request('/api/member', {
      method: 'post',
      body: payload,
    });
  }

  updateMember(memberId: string, payload: APISchemas['UpdateMemberInput']) {
    return this.request('/api/member/{member_id}', {
      method: 'put',
      urlParams: {
        member_id: memberId,
      },
      body: payload,
    });
  }

  deleteMember(memberId: string) {
    return this.request('/api/member/{member_id}', {
      method: 'delete',
      urlParams: {
        member_id: memberId,
      },
    });
  }

  addMemberUnit(memberId: string, unitId: string) {
    return this.request('/api/member/{member_id}/units', {
      method: 'post',
      urlParams: {
        member_id: memberId,
      },
      body: {
        unit_id: unitId,
      },
    });
  }

  removeMemberUnit(memberId: string, unitId: string) {
    return this.request('/api/member/{member_id}/units/{unit_id}', {
      method: 'delete',
      urlParams: {
        member_id: memberId,
        unit_id: unitId,
      },
    });
  }

  listActions() {
    return this.request('/api/auth/actions', {
      method: 'get',
    }).pipe(map((r) => r ?? []));
  }

  listUsers() {
    return this.request('/api/auth/users', {
      method: 'get',
    }).pipe(map((r) => r ?? []));
  }

  getUser(userId: string) {
    return this.request('/api/auth/users/{user_id}', {
      method: 'get',
      urlParams: {
        user_id: userId,
      },
    });
  }

  createUser(payload: APISchemas['CreateUserInput']) {
    return this.request('/api/auth/users', {
      method: 'post',
      body: payload,
    });
  }

  updateUser(userId: string, payload: APISchemas['UpdateUserInput']) {
    return this.request('/api/auth/users/{user_id}', {
      method: 'put',
      urlParams: {
        user_id: userId,
      },
      body: payload,
    });
  }

  deleteUser(userId: string) {
    return this.request('/api/auth/users/{user_id}', {
      method: 'delete',
      urlParams: {
        user_id: userId,
      },
    });
  }

  listEmails() {
    return this.request('/api/email', {
      method: 'get',
    }).pipe(map((r) => r ?? []));
  }

  getEmail(emailId: string) {
    return this.request('/api/email/{email_id}', {
      method: 'get',
      urlParams: {
        email_id: emailId,
      },
    });
  }

  deleteEmail(emailId: string) {
    return this.request('/api/email/{email_id}', {
      method: 'delete',
      urlParams: {
        email_id: emailId,
      },
    });
  }

  sendEmail(emailId: string, payload: APISchemas['SendEmailInput']) {
    return this.request('/api/email/{email_id}/send', {
      method: 'post',
      urlParams: {
        email_id: emailId,
      },
      body: payload,
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
