import { AuthConfig } from 'angular-oauth2-oidc';

const auth: AuthConfig = {
  issuer: 'https://accounts.google.com',
  clientId:
    '174839262039-tg9jv57eod93r2a578hlkcjvq6p4g0hn.apps.googleusercontent.com',
  dummyClientSecret: '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',
  showDebugInformation: true,
};

export const environment = {
  auth,
};
