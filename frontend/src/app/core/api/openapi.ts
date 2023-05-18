export type APISchemas = {
  AddMemberUnitInput: { unit_id?: string };
  AuthUser: {
    actions?: Array<string>;
    admin?: boolean;
    /* Format: date-time */
    created_at?: string;
    enabled?: boolean;
    id?: string;
    /* Format: date-time */
    updated_at?: string;
    username?: string;
  };
  CreateBudgetInput: { label?: string };
  CreateExpenseInput: {
    /* Format: double */
    amount?: number;
    label?: string;
  };
  CreateMemberInput: {
    address?: string;
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
  ModelsBudget: {
    /* Format: date-time */
    created_at?: string;
    draft?: boolean;
    id?: string;
    label?: string;
    /* Format: date-time */
    updated_at?: string;
  };
  ModelsBudgetResult: {
    /* Format: double */
    amount?: number;
    /* Format: date-time */
    created_at?: string;
    draft?: boolean;
    id?: string;
    label?: string;
    /* Format: double */
    paid?: number;
    /* Format: date-time */
    updated_at?: string;
  };
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
    amount?: number;
    budget?: APISchemas['ModelsBudget'];
    budget_id?: string;
    /* Format: date-time */
    created_at?: string;
    id?: string;
    /* Format: double */
    paid?: number;
    unit?: APISchemas['ModelsUnit'];
    unit_id?: string;
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
  ModelsMember: {
    address?: string;
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
  ServerAPIError: {
    /*
     * The error message returned to the client.
     * @example internal server error
     */
    message?: string;
  };
  ServerPingOut: { message?: string; status?: string };
  UpdateBudgetInput: { label?: string };
  UpdateExpenseInput: {
    /* Format: double */
    amount?: number;
    label?: string;
  };
  UpdateMemberInput: {
    address?: string;
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
};

export type APIEndpoints = {
  '/api/auth/me': {
    responses: { get: APISchemas['AuthUser'] };
    requests: { method?: 'get' };
  };
  '/api/budget': {
    responses: { get: Array<APISchemas['ModelsBudgetResult']>; post: null };
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
  '/api/budget/{budget_id}/cotisations/{cotisation_id}/payments': {
    responses: { get: Array<APISchemas['ModelsPayment']>; post: null };
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
  '/api/budget/{budget_id}/expenses': {
    responses: { get: Array<APISchemas['ModelsExpense']>; post: null };
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
  '/api/member': {
    responses: { get: Array<APISchemas['ModelsMember']>; post: null };
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
    responses: { get: Array<APISchemas['ModelsUnit']>; post: null };
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

export type APIResponse<
  T extends APIPaths,
  M extends string | undefined
> = DefaultToGet<M> extends keyof APIEndpoints[T]['responses']
  ? APIEndpoints[T]['responses'][DefaultToGet<M>]
  : never;
