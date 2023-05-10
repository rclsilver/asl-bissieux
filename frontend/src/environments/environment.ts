import { AuthConfig } from 'angular-oauth2-oidc';

const auth: AuthConfig = {
  issuer: 'https://accounts.google.com',
  clientId:
    '433001078171-48qvd3j5e7arqtujsis1ulisg5pngkpb.apps.googleusercontent.com',
  dummyClientSecret: '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',
  showDebugInformation: true,
};

export const environment = {
  auth,
};
