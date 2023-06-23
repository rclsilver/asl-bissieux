import { Injectable, inject } from '@angular/core';
import { APIPaths, APIRequests, APIResponse, APISchemas } from '../api/openapi';
import { catchError, filter, map, tap, throwError } from 'rxjs';
import {
  HttpErrorResponse,
  HttpParams,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { NotificationDialogLevel } from 'src/app/shared/components/notification-dialog/notification-dialog.component';
import { NotificationsService } from 'src/app/shared/services/notifications.service';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly _notifications = inject(NotificationsService);
  private readonly _http = inject(HttpClient);

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

  previewBudgetEmail(
    budgetId: string,
    payload: APISchemas['PreviewBudgetEmailInput']
  ) {
    return this.request('/api/budget/{budget_id}/email-preview', {
      method: 'post',
      urlParams: {
        budget_id: budgetId,
      },
      body: payload,
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

  listEmailTemplates() {
    return this.request('/api/email/templates', {
      method: 'get',
    }).pipe(map((r) => r ?? []));
  }

  getEmailTemplate(templateId: string) {
    return this.request('/api/email/templates/{template_id}', {
      method: 'get',
      urlParams: {
        template_id: templateId,
      },
    });
  }

  createEmailTemplate(payload: APISchemas['CreateEmailTemplateInput']) {
    return this.request('/api/email/templates', {
      method: 'post',
      body: payload,
    });
  }

  updateEmailTemplate(
    templateId: string,
    payload: APISchemas['UpdateEmailTemplateInput']
  ) {
    return this.request('/api/email/templates/{template_id}', {
      method: 'put',
      urlParams: {
        template_id: templateId,
      },
      body: payload,
    });
  }

  deleteEmailTemplate(templateId: string) {
    return this.request('/api/email/templates/{template_id}', {
      method: 'delete',
      urlParams: {
        template_id: templateId,
      },
    });
  }

  listEmailAttachments(templateId: string) {
    return this.request('/api/email/templates/{template_id}/attachments', {
      method: 'get',
      urlParams: {
        template_id: templateId,
      },
    }).pipe(map((r) => r ?? []));
  }

  createEmailAttachment(
    templateId: string,
    name: string,
    inline: boolean,
    file: File
  ) {
    const data = new FormData();
    data.append('name', name);
    data.append('inline', inline ? 'true' : 'false');
    data.append('content_type', file.type);
    data.append('content', file);

    const uri = this.buildURI(
      '/api/email/templates/{template_id}/attachments',
      { template_id: templateId }
    );

    return this._http
      .post<APISchemas['ModelsAttachment']>(uri, data)
      .pipe(
        catchError((err: HttpErrorResponse) =>
          throwError(
            () => new APIError(err.error, err.status, err.statusText, err)
          )
        )
      );
  }

  getEmailAttachment(templateId: string, attachmentId: string) {
    const uri = this.buildURI(
      '/api/email/templates/{template_id}/attachments/{attachment_id}',
      {
        template_id: templateId,
        attachment_id: attachmentId,
      }
    );

    return this._http
      .get(uri, {
        responseType: 'arraybuffer',
      })
      .pipe(
        catchError((err: HttpErrorResponse) =>
          throwError(
            () => new APIError(err.error, err.status, err.statusText, err)
          )
        )
      );
  }

  deleteEmailAttachment(templateId: string, attachmentId: string) {
    return this.request(
      '/api/email/templates/{template_id}/attachments/{attachment_id}',
      {
        method: 'delete',
        urlParams: {
          template_id: templateId,
          attachment_id: attachmentId,
        },
      }
    );
  }

  previewEmailTemplate(templateId: string, data: any) {
    return this.request('/api/email/templates/{template_id}/preview', {
      method: 'post',
      urlParams: {
        template_id: templateId,
      },
      body: data,
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

  emailSetError(emailId: string) {
    return this.request('/api/email/{email_id}/set-error', {
      method: 'post',
      urlParams: {
        email_id: emailId,
      },
    });
  }

  handleError(message: string) {
    return (error: APIError) =>
      this._notifications.showDialog({
        title: 'Error',
        message: `${message}: HTTP ${error.status} ${error.statusText}`,
        level: NotificationDialogLevel.Error,
      });
  }

  private buildURI(path: string, params: object) {
    let uri: string = path;

    for (const [name, value] of Object.entries(params)) {
      uri = uri.replace(`{${name}}`, value.toString());
    }

    return uri;
  }

  private buildParams<Path extends APIPaths, Options extends APIRequests<Path>>(
    options: Options
  ) {
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

    return params;
  }

  private buildRequest<Result>(
    method: string,
    uri: string,
    params?: HttpParams,
    body?: any,
    responseType?: 'arraybuffer' | 'blob' | 'json' | 'text'
  ) {
    const init = {
      params: params ?? new HttpParams(),
      reponseType: responseType ?? 'json',
    };

    return new HttpRequest<Result>(
      (method ?? 'get').toUpperCase() as
        | 'DELETE'
        | 'GET'
        | 'HEAD'
        | 'JSONP'
        | 'OPTIONS',
      uri,
      body,
      init
    );
  }

  private request<
    Path extends APIPaths,
    Options extends APIRequests<Path>,
    Result extends APIResponse<Path, Options['method']>
  >(path: Path, options?: Options) {
    options = (options ?? {}) as Options;

    // build the uri from the path and the url params
    const uri = this.buildURI(
      path,
      'urlParams' in options ? options['urlParams'] : {}
    );

    // build the query params
    const params = this.buildParams(options);

    // build the request
    const request = this.buildRequest<Result>(
      options['method'] ?? 'get',
      uri,
      params,
      'body' in options ? options['body'] : undefined
    );

    // execute the request and return the response
    return this._http.request<Result>(request).pipe(
      catchError((err: HttpErrorResponse) =>
        throwError(
          () => new APIError(err.error, err.status, err.statusText, err)
        )
      ),
      filter((event) => event instanceof HttpResponse),
      map((event) => (event as HttpResponse<Result>).body)
    );
  }
}

export class APIError extends Error {
  constructor(
    public readonly data: any,
    public readonly status: number,
    public readonly statusText: string,
    public readonly origin: Error
  ) {
    super();
  }
}
