export type APISchemas = {
  AddAttachmentInput: {
    /* Format: byte */
    Content?: string;
    ContentType?: string;
    Inline?: boolean;
    Name?: string;
  };
  AddMemberUnitInput: { unit_id?: string };
  AuthAccessRequestSummary: {
    /* Format: int64 */
    pending?: number;
  };
  AuthPublicAuthConfig: { label?: string; login_url?: string; mode?: string };
  AuthUser: {
    access_status?: string;
    actions?: Array<string>;
    admin?: boolean;
    /* Format: date-time */
    created_at?: string;
    enabled?: boolean;
    id?: string;
    identities?: Array<APISchemas['AuthUserIdentity']>;
    /* Format: date-time */
    updated_at?: string;
    username?: string;
  };
  AuthUserIdentity: { issuer?: string; subject?: string };
  CreateBudgetInput: { label?: string };
  CreateEmailCampaignInput: {
    data?: { [key: string]: unknown };
    template?: string;
    title?: string;
  };
  CreateEmailTemplateInput: {
    label?: string;
    message?: string;
    subject?: string;
  };
  CreateExpenseInput: {
    /* Format: double */
    amount?: number;
    label?: string;
  };
  CreateFinancialEntryInput: {
    /* Format: double */
    amount?: number;
    date?: string;
    id?: string;
    kind?: string;
    reason?: string;
    reference?: string;
    reverses_id?: string;
    version?: string;
  };
  CreateMemberInput: {
    address?: string;
    bureau?: null | boolean;
    email?: string;
    first_name?: string;
    last_name?: string;
    phone_number?: string;
  };
  CreatePaymentInput: {
    /* Format: double */
    amount?: number;
    comment?: string;
    /* Format: date-time */
    date?: string;
  };
  CreateUnitInput: {
    address?: string;
    /* Format: int32 */
    number?: number;
    /* Format: int32 */
    share?: number;
  };
  CreateUserInput: {
    actions?: Array<string>;
    admin?: boolean;
    enabled?: boolean;
    username?: string;
  };
  MailingsInvalidMember: { id?: string; name?: string; reason?: string };
  MailingsListPlan: {
    add?: Array<string>;
    current?: Array<string>;
    expected?: Array<string>;
    group?: string;
    name?: string;
    pending_tasks?: Array<number>;
    remove?: Array<string>;
  };
  MailingsPlan: {
    can_apply?: boolean;
    configured?: boolean;
    domain?: string;
    invalid?: Array<APISchemas['MailingsInvalidMember']>;
    lists?: Array<APISchemas['MailingsListPlan']>;
    token?: string;
  };
  MailingsResult: {
    message?: string;
    partial?: boolean;
    plan?: APISchemas['MailingsPlan'];
    verified?: boolean;
  };
  ModelsAttachment: {
    content_type?: string;
    /* Format: date-time */
    created_at?: string;
    id?: string;
    inline?: boolean;
    name?: string;
    /* Format: int32 */
    size?: number;
    template?: APISchemas['ModelsEmailTemplate'];
    template_id?: string;
    /* Format: date-time */
    updated_at?: string;
  };
  ModelsBudget: {
    /* Format: date-time */
    created_at?: string;
    draft?: boolean;
    id?: string;
    label?: string;
    /* Format: date-time */
    updated_at?: string;
  };
  ModelsBudgetDashboard: {
    budget?: APISchemas['ModelsBudgetResult'];
    cotisations?: Array<APISchemas['ModelsCotisationResult']>;
    months?: Array<APISchemas['ModelsMonthlyCollection']>;
    recovery?: APISchemas['ModelsRecoverySummary'];
    timezone?: string;
    /* Format: int32 */
    year?: number;
    years?: Array<number>;
  };
  ModelsBudgetPreview: {
    /* Format: double */
    amount?: number;
    /* Format: double */
    annual_per_share?: number;
    message?: string;
    /* Format: double */
    monthly_per_share?: number;
    /* Format: int32 */
    months?: number;
    ready?: boolean;
    /* Format: int64 */
    total_shares?: number;
  };
  ModelsBudgetResult: {
    /* Format: double */
    adjustment?: number;
    /* Format: double */
    amount?: number;
    /* Format: double */
    called?: number;
    /* Format: date-time */
    created_at?: string;
    draft?: boolean;
    /* Format: double */
    gross_paid?: number;
    id?: string;
    label?: string;
    /* Format: double */
    paid?: number;
    preview?: APISchemas['ModelsBudgetPreview'];
    /* Format: double */
    refunded?: number;
    /* Format: date-time */
    updated_at?: string;
  };
  ModelsBuiltEmail: { message?: string; subject?: string };
  ModelsCotisation: {
    /* Format: double */
    amount?: number;
    budget?: APISchemas['ModelsBudget'];
    budget_id?: string;
    /* Format: date-time */
    created_at?: string;
    id?: string;
    unit?: APISchemas['ModelsUnit'];
    unit_id?: string;
    /* Format: date-time */
    updated_at?: string;
  };
  ModelsCotisationResult: {
    /* Format: double */
    adjustment?: number;
    /* Format: double */
    amount?: number;
    budget?: APISchemas['ModelsBudget'];
    budget_id?: string;
    /* Format: date-time */
    created_at?: string;
    /* Format: double */
    gross_paid?: number;
    id?: string;
    /* Format: double */
    initial_amount?: number;
    /* Format: double */
    paid?: number;
    /* Format: int32 */
    payment_state?: number;
    /* Format: double */
    refunded?: number;
    /* Format: double */
    remaining?: number;
    unit?: APISchemas['ModelsUnit'];
    unit_id?: string;
    /* Format: date-time */
    updated_at?: string;
  };
  ModelsDirectoryQuality: {
    /* Format: int64 */
    invalid_shares?: number;
    /* Format: int64 */
    missing_email?: number;
    /* Format: int64 */
    no_member?: number;
  };
  ModelsEmail: {
    campaign?: APISchemas['ModelsEmailCampaign'];
    campaign_id?: string;
    /* Format: date-time */
    created_at?: string;
    data?: { [key: string]: unknown };
    error?: string;
    id?: string;
    message?: string;
    state?: string;
    subject?: string;
    to?: string;
    /* Format: date-time */
    updated_at?: string;
  };
  ModelsEmailCampaign: {
    /* Format: date-time */
    created_at?: string;
    data?: { [key: string]: unknown };
    emails?: Array<APISchemas['ModelsEmail']>;
    id?: string;
    template?: APISchemas['ModelsEmailTemplate'];
    template_id?: string;
    title?: string;
    /* Format: date-time */
    updated_at?: string;
  };
  ModelsEmailCampaignPage: {
    items?: Array<APISchemas['ModelsEmailCampaignSummary']>;
    /* Format: int32 */
    page?: number;
    /* Format: int32 */
    page_size?: number;
    /* Format: int64 */
    total?: number;
  };
  ModelsEmailCampaignSummary: {
    counts?: APISchemas['ModelsEmailCounts'];
    /* Format: date-time */
    created_at?: string;
    id?: string;
    title?: string;
  };
  ModelsEmailCounts: {
    /* Format: int64 */
    error?: number;
    /* Format: int64 */
    sending?: number;
    /* Format: int64 */
    successful?: number;
    /* Format: int64 */
    total?: number;
    /* Format: int64 */
    unknown?: number;
    /* Format: int64 */
    waiting?: number;
  };
  ModelsEmailDashboard: {
    /* Format: int64 */
    campaigns?: number;
    counts?: APISchemas['ModelsEmailCounts'];
    recent?: Array<APISchemas['ModelsEmailCampaignSummary']>;
  };
  ModelsEmailPage: {
    items?: Array<APISchemas['ModelsEmailSummary']>;
    /* Format: int32 */
    page?: number;
    /* Format: int32 */
    page_size?: number;
    /* Format: int64 */
    total?: number;
  };
  ModelsEmailStatus: { error?: string; id?: string; state?: string };
  ModelsEmailSummary: {
    /* Format: date-time */
    created_at?: string;
    has_error?: boolean;
    id?: string;
    state?: string;
    subject?: string;
    to?: string;
  };
  ModelsEmailTemplate: {
    attachments?: Array<APISchemas['ModelsAttachment']>;
    campaigns?: Array<APISchemas['ModelsEmailCampaign']>;
    /* Format: date-time */
    created_at?: string;
    custom_fields?: APISchemas['TemplatesFieldDescription'];
    id?: string;
    label?: string;
    message?: string;
    subject?: string;
    /* Format: date-time */
    updated_at?: string;
  };
  ModelsExpense: {
    /* Format: double */
    amount?: number;
    budget?: APISchemas['ModelsBudget'];
    budget_id?: string;
    /* Format: date-time */
    created_at?: string;
    id?: string;
    label?: string;
    /* Format: date-time */
    updated_at?: string;
  };
  ModelsFinancialEntry: {
    /* Format: double */
    amount?: number;
    cotisation_id?: string;
    /* Format: date-time */
    created_at?: string;
    /* Format: date-time */
    date?: string;
    id?: string;
    kind?: string;
    reason?: string;
    reference?: string;
    reverses_id?: null | string;
    user?: APISchemas['AuthUser'];
    user_id?: string;
  };
  ModelsFinancialPreview: {
    /* Format: double */
    called_after?: number;
    /* Format: double */
    called_before?: number;
    /* Format: double */
    paid_after?: number;
    /* Format: double */
    paid_before?: number;
    /* Format: double */
    remaining_after?: number;
    version?: string;
  };
  ModelsMember: {
    address?: string;
    bureau?: boolean;
    /* Format: date-time */
    created_at?: string;
    email?: string;
    first_name?: string;
    id?: string;
    last_name?: string;
    phone_number?: string;
    units?: Array<APISchemas['ModelsUnit']>;
    /* Format: date-time */
    updated_at?: string;
  };
  ModelsMonthlyCollection: {
    /* Format: double */
    cumulative?: number;
    /* Format: int32 */
    month?: number;
    /* Format: double */
    net?: number;
    /* Format: double */
    payments?: number;
    /* Format: double */
    refunds?: number;
  };
  ModelsPayment: {
    /* Format: double */
    amount?: number;
    comment?: string;
    cotisation?: APISchemas['ModelsCotisation'];
    cotisation_id?: string;
    /* Format: date-time */
    created_at?: string;
    /* Format: date-time */
    date?: string;
    id?: string;
    /* Format: date-time */
    updated_at?: string;
    user?: APISchemas['AuthUser'];
    user_id?: string;
  };
  ModelsRecoverySummary: {
    /* Format: double */
    called?: number;
    /* Format: double */
    covered?: number;
    /* Format: int32 */
    lots?: number;
    /* Format: int32 */
    overpaid?: number;
    /* Format: double */
    paid?: number;
    /* Format: int32 */
    partial?: number;
    /* Format: double */
    rate?: null | number;
    /* Format: double */
    refunded?: number;
    /* Format: double */
    remaining?: number;
    /* Format: int32 */
    settled?: number;
    /* Format: double */
    surplus?: number;
    /* Format: int32 */
    unpaid?: number;
  };
  ModelsUnit: {
    address?: string;
    /* Format: date-time */
    created_at?: string;
    id?: string;
    members?: Array<APISchemas['ModelsMember']>;
    /* Format: int32 */
    number?: number;
    /* Format: int32 */
    share?: number;
    /* Format: date-time */
    updated_at?: string;
  };
  PreviewBudgetEmailInput: {
    data?: { [key: string]: unknown };
    member_id?: string;
    send_to_doing?: null | boolean;
    send_to_paid?: null | boolean;
    template_id?: string;
  };
  PreviewEmailTemplateInput: { data?: { [key: string]: unknown } };
  PreviewFinancialEntryInput: {
    /* Format: double */
    amount?: number;
    date?: string;
    id?: string;
    kind?: string;
    reason?: string;
    reference?: string;
    reverses_id?: string;
    version?: string;
  };
  SendBudgetEmailInput: {
    data?: { [key: string]: unknown };
    send_to_doing?: boolean;
    send_to_paid?: boolean;
    template_id?: string;
  };
  SendEmailInput: { wait?: boolean };
  ServerAPIError: {
    /*
     * The error message returned to the client.
     * @example internal server error
     */
    message?: string;
  };
  ServerLogoutResult: { redirect_url?: string };
  ServerPingOut: { message?: string; status?: string };
  SyncMailingListsInput: { token?: string };
  TemplatesCustomField: { complex?: boolean; name?: string };
  TemplatesFieldDescription: {
    advanced?: boolean;
    fields?: Array<APISchemas['TemplatesCustomField']>;
  };
  UpdateBudgetInput: { label?: string };
  UpdateEmailTemplateInput: {
    label?: string;
    message?: string;
    subject?: string;
  };
  UpdateExpenseInput: {
    /* Format: double */
    amount?: number;
    label?: string;
  };
  UpdateMemberInput: {
    address?: string;
    bureau?: null | boolean;
    email?: string;
    first_name?: string;
    last_name?: string;
    phone_number?: string;
  };
  UpdatePaymentInput: {
    /* Format: double */
    amount?: number;
    comment?: string;
    /* Format: date-time */
    date?: string;
  };
  UpdateUnitInput: {
    address?: string;
    /* Format: int32 */
    number?: number;
    /* Format: int32 */
    share?: number;
  };
  UpdateUserInput: {
    access_decision?: string;
    actions?: Array<string>;
    admin?: boolean;
    enabled?: boolean;
    /* Format: date-time */
    expected_updated_at?: null | string;
    username?: string;
  };
};

export type APIEndpoints = {
  '/api/auth/access-requests/summary': {
    responses: { get: APISchemas['AuthAccessRequestSummary'] };
    requests: { method?: 'get' };
  };
  '/api/auth/actions': {
    responses: { get: Array<string> };
    requests: { method?: 'get' };
  };
  '/api/auth/config': {
    responses: { get: APISchemas['AuthPublicAuthConfig'] };
    requests: { method?: 'get' };
  };
  '/api/auth/logout': {
    responses: { post: APISchemas['ServerLogoutResult'] };
    requests: { method: 'post' };
  };
  '/api/auth/me': {
    responses: { get: APISchemas['AuthUser'] };
    requests: { method?: 'get' };
  };
  '/api/auth/users': {
    responses: {
      get: Array<APISchemas['AuthUser']>;
      post: APISchemas['AuthUser'];
    };
    requests:
      | { method?: 'get'; query?: { status?: string } }
      | { method: 'post'; body: APISchemas['CreateUserInput'] };
  };
  '/api/auth/users/{user_id}': {
    responses: {
      get: APISchemas['AuthUser'];
      put: APISchemas['AuthUser'];
      delete: null;
    };
    requests:
      | { method?: 'get'; urlParams: { user_id: string } }
      | {
          method: 'put';
          urlParams: { user_id: string };
          body: APISchemas['UpdateUserInput'];
        }
      | { method: 'delete'; urlParams: { user_id: string } };
  };
  '/api/budget': {
    responses: {
      get: Array<APISchemas['ModelsBudgetResult']>;
      post: APISchemas['ModelsBudget'];
    };
    requests:
      | { method?: 'get' }
      | { method: 'post'; body: APISchemas['CreateBudgetInput'] };
  };
  '/api/budget/{budget_id}': {
    responses: {
      get: APISchemas['ModelsBudgetResult'];
      put: APISchemas['ModelsBudgetResult'];
      delete: null;
    };
    requests:
      | { method?: 'get'; urlParams: { budget_id: string } }
      | {
          method: 'put';
          urlParams: { budget_id: string };
          body: APISchemas['UpdateBudgetInput'];
        }
      | { method: 'delete'; urlParams: { budget_id: string } };
  };
  '/api/budget/{budget_id}/cotisations': {
    responses: { get: Array<APISchemas['ModelsCotisationResult']> };
    requests: { method?: 'get'; urlParams: { budget_id: string } };
  };
  '/api/budget/{budget_id}/cotisations/{cotisation_id}/entries': {
    responses: {
      get: Array<APISchemas['ModelsFinancialEntry']>;
      post: APISchemas['ModelsFinancialEntry'];
    };
    requests:
      | {
          method?: 'get';
          urlParams: { budget_id: string; cotisation_id: string };
        }
      | {
          method: 'post';
          urlParams: { budget_id: string; cotisation_id: string };
          body: APISchemas['CreateFinancialEntryInput'];
        };
  };
  '/api/budget/{budget_id}/cotisations/{cotisation_id}/entries/preview': {
    responses: { post: APISchemas['ModelsFinancialPreview'] };
    requests: {
      method: 'post';
      urlParams: { budget_id: string; cotisation_id: string };
      body: APISchemas['PreviewFinancialEntryInput'];
    };
  };
  '/api/budget/{budget_id}/cotisations/{cotisation_id}/payments': {
    responses: {
      get: Array<APISchemas['ModelsPayment']>;
      post: APISchemas['ModelsPayment'];
    };
    requests:
      | {
          method?: 'get';
          urlParams: { budget_id: string; cotisation_id: string };
        }
      | {
          method: 'post';
          urlParams: { budget_id: string; cotisation_id: string };
          body: APISchemas['CreatePaymentInput'];
        };
  };
  '/api/budget/{budget_id}/cotisations/{cotisation_id}/payments/{payment_id}': {
    responses: { put: APISchemas['ModelsPayment']; delete: null };
    requests:
      | {
          method: 'put';
          urlParams: {
            budget_id: string;
            cotisation_id: string;
            payment_id: string;
          };
          body: APISchemas['UpdatePaymentInput'];
        }
      | {
          method: 'delete';
          urlParams: {
            budget_id: string;
            cotisation_id: string;
            payment_id: string;
          };
        };
  };
  '/api/budget/{budget_id}/dashboard': {
    responses: { get: APISchemas['ModelsBudgetDashboard'] };
    requests: {
      method?: 'get';
      query?: {
        /* Format: int32 */
        year?: number;
      };
      urlParams: { budget_id: string };
    };
  };
  '/api/budget/{budget_id}/email': {
    responses: { post: null };
    requests: {
      method: 'post';
      urlParams: { budget_id: string };
      body: APISchemas['SendBudgetEmailInput'];
    };
  };
  '/api/budget/{budget_id}/email-preview': {
    responses: { post: APISchemas['ModelsBuiltEmail'] };
    requests: {
      method: 'post';
      urlParams: { budget_id: string };
      body: APISchemas['PreviewBudgetEmailInput'];
    };
  };
  '/api/budget/{budget_id}/expenses': {
    responses: {
      get: Array<APISchemas['ModelsExpense']>;
      post: APISchemas['ModelsExpense'];
    };
    requests:
      | { method?: 'get'; urlParams: { budget_id: string } }
      | {
          method: 'post';
          urlParams: { budget_id: string };
          body: APISchemas['CreateExpenseInput'];
        };
  };
  '/api/budget/{budget_id}/expenses/{expense_id}': {
    responses: { put: APISchemas['ModelsExpense']; delete: null };
    requests:
      | {
          method: 'put';
          urlParams: { budget_id: string; expense_id: string };
          body: APISchemas['UpdateExpenseInput'];
        }
      | {
          method: 'delete';
          urlParams: { budget_id: string; expense_id: string };
        };
  };
  '/api/budget/{budget_id}/publish': {
    responses: { post: APISchemas['ModelsBudgetResult'] };
    requests: { method: 'post'; urlParams: { budget_id: string } };
  };
  '/api/dashboard/directory': {
    responses: { get: APISchemas['ModelsDirectoryQuality'] };
    requests: { method?: 'get' };
  };
  '/api/dashboard/emails': {
    responses: { get: APISchemas['ModelsEmailDashboard'] };
    requests: { method?: 'get' };
  };
  '/api/email/campaigns': {
    responses: {
      get: APISchemas['ModelsEmailCampaignPage'];
      post: APISchemas['ModelsEmailCampaign'];
    };
    requests:
      | {
          method?: 'get';
          query?: {
            direction?: string;
            /* Format: int32 */
            page?: number;
            /* Format: int32 */
            page_size?: number;
            query?: string;
            sort?: string;
            state?: string;
          };
        }
      | { method: 'post'; body: APISchemas['CreateEmailCampaignInput'] };
  };
  '/api/email/campaigns/{campaign_id}': {
    responses: { get: APISchemas['ModelsEmailCampaign']; delete: null };
    requests:
      | { method?: 'get'; urlParams: { campaign_id: string } }
      | { method: 'delete'; urlParams: { campaign_id: string } };
  };
  '/api/email/campaigns/{campaign_id}/emails': {
    responses: { get: APISchemas['ModelsEmailPage'] };
    requests: {
      method?: 'get';
      query?: {
        direction?: string;
        /* Format: int32 */
        page?: number;
        /* Format: int32 */
        page_size?: number;
        query?: string;
        sort?: string;
        state?: string;
      };
      urlParams: { campaign_id: string };
    };
  };
  '/api/email/templates': {
    responses: {
      get: Array<APISchemas['ModelsEmailTemplate']>;
      post: APISchemas['ModelsEmailTemplate'];
    };
    requests:
      | { method?: 'get' }
      | { method: 'post'; body: APISchemas['CreateEmailTemplateInput'] };
  };
  '/api/email/templates/{template_id}': {
    responses: {
      get: APISchemas['ModelsEmailTemplate'];
      put: APISchemas['ModelsEmailTemplate'];
      delete: null;
    };
    requests:
      | { method?: 'get'; urlParams: { template_id: string } }
      | {
          method: 'put';
          urlParams: { template_id: string };
          body: APISchemas['UpdateEmailTemplateInput'];
        }
      | { method: 'delete'; urlParams: { template_id: string } };
  };
  '/api/email/templates/{template_id}/attachments': {
    responses: {
      get: Array<APISchemas['ModelsAttachment']>;
      post: APISchemas['ModelsAttachment'];
    };
    requests:
      | { method?: 'get'; urlParams: { template_id: string } }
      | {
          method: 'post';
          urlParams: { template_id: string };
          body: APISchemas['AddAttachmentInput'];
        };
  };
  '/api/email/templates/{template_id}/attachments/{attachment_id}': {
    responses: { get: null; delete: null };
    requests:
      | {
          method?: 'get';
          urlParams: { attachment_id: string; template_id: string };
        }
      | {
          method: 'delete';
          urlParams: { attachment_id: string; template_id: string };
        };
  };
  '/api/email/templates/{template_id}/preview': {
    responses: { post: APISchemas['ModelsBuiltEmail'] };
    requests: {
      method: 'post';
      urlParams: { template_id: string };
      body: APISchemas['PreviewEmailTemplateInput'];
    };
  };
  '/api/email/{email_id}': {
    responses: { get: APISchemas['ModelsEmail']; delete: null };
    requests:
      | { method?: 'get'; urlParams: { email_id: string } }
      | { method: 'delete'; urlParams: { email_id: string } };
  };
  '/api/email/{email_id}/send': {
    responses: { post: null };
    requests: {
      method: 'post';
      urlParams: { email_id: string };
      body: APISchemas['SendEmailInput'];
    };
  };
  '/api/email/{email_id}/set-error': {
    responses: { post: null };
    requests: { method: 'post'; urlParams: { email_id: string } };
  };
  '/api/email/{email_id}/status': {
    responses: { get: APISchemas['ModelsEmailStatus'] };
    requests: { method?: 'get'; urlParams: { email_id: string } };
  };
  '/api/email/{email_id}/tracker': {
    responses: { get: null };
    requests: { method?: 'get'; urlParams: { email_id: string } };
  };
  '/api/mailing-lists/preview': {
    responses: { get: APISchemas['MailingsPlan'] };
    requests: { method?: 'get' };
  };
  '/api/mailing-lists/sync': {
    responses: { post: APISchemas['MailingsResult'] };
    requests: { method: 'post'; body: APISchemas['SyncMailingListsInput'] };
  };
  '/api/member': {
    responses: {
      get: Array<APISchemas['ModelsMember']>;
      post: APISchemas['ModelsMember'];
    };
    requests:
      | { method?: 'get' }
      | { method: 'post'; body: APISchemas['CreateMemberInput'] };
  };
  '/api/member/{member_id}': {
    responses: {
      get: APISchemas['ModelsMember'];
      put: APISchemas['ModelsMember'];
      delete: null;
    };
    requests:
      | { method?: 'get'; urlParams: { member_id: string } }
      | {
          method: 'put';
          urlParams: { member_id: string };
          body: APISchemas['UpdateMemberInput'];
        }
      | { method: 'delete'; urlParams: { member_id: string } };
  };
  '/api/member/{member_id}/units': {
    responses: { post: null };
    requests: {
      method: 'post';
      urlParams: { member_id: string };
      body: APISchemas['AddMemberUnitInput'];
    };
  };
  '/api/member/{member_id}/units/{unit_id}': {
    responses: { delete: null };
    requests: {
      method: 'delete';
      urlParams: { member_id: string; unit_id: string };
    };
  };
  '/api/mon/ping': {
    responses: { get: APISchemas['ServerPingOut'] };
    requests: { method?: 'get' };
  };
  '/api/unit': {
    responses: {
      get: Array<APISchemas['ModelsUnit']>;
      post: APISchemas['ModelsUnit'];
    };
    requests:
      | { method?: 'get' }
      | { method: 'post'; body: APISchemas['CreateUnitInput'] };
  };
  '/api/unit/{unit_id}': {
    responses: {
      get: APISchemas['ModelsUnit'];
      put: APISchemas['ModelsUnit'];
      delete: null;
    };
    requests:
      | { method?: 'get'; urlParams: { unit_id: string } }
      | {
          method: 'put';
          urlParams: { unit_id: string };
          body: APISchemas['UpdateUnitInput'];
        }
      | { method: 'delete'; urlParams: { unit_id: string } };
  };
  '/api/unit/{unit_id}/members': {
    responses: { get: Array<APISchemas['ModelsMember']> };
    requests: { method?: 'get'; urlParams: { unit_id: string } };
  };
};

export type APIPaths = keyof APIEndpoints;

export type APIRequests<T extends APIPaths> = APIEndpoints[T]['requests'];

export type APIMethods<T extends APIPaths> = NonNullable<
  APIRequests<T>['method']
>;

export type APIRequest<T extends APIPaths, M extends APIMethods<T>> = Omit<
  {
    [MM in APIMethods<T>]: APIRequests<T> & { method: MM };
  }[M],
  'method'
> & { method?: M };

type DefaultToGet<T extends string | undefined> = T extends string ? T : 'get';

export type APIResponse<T extends APIPaths, M extends string | undefined> =
  DefaultToGet<M> extends keyof APIEndpoints[T]['responses']
    ? APIEndpoints[T]['responses'][DefaultToGet<M>]
    : never;
