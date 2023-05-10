import { AuthConfig } from 'angular-oauth2-oidc';
import { environment } from 'src/environments/environment';

/*
export const authConfig: AuthConfig = {
  issuer: 'https://demo.duendesoftware.com',
  clientId: 'interactive.public', // The "Auth Code + PKCE" client
  responseType: 'code',
  redirectUri: window.location.origin + '/',
  silentRefreshRedirectUri: window.location.origin + '/silent-refresh.html',
  scope: 'openid profile email api', // Ask offline_access to support refresh token refreshes
  useSilentRefresh: true, // Needed for Code Flow to suggest using iframe-based refreshes
  silentRefreshTimeout: 5000, // For faster testing
  timeoutFactor: 0.25, // For faster testing
  sessionChecksEnabled: true,
  showDebugInformation: true, // Also requires enabling "Verbose" level in devtools
  clearHashAfterLogin: false, // https://github.com/manfredsteyer/angular-oauth2-oidc/issues/457#issuecomment-431807040,
  nonceStateSeparator : 'semicolon' // Real semicolon gets mangled by Duende ID Server's URI encoding
};
*/

export const authConfig: AuthConfig = {
  ...environment.auth,
  redirectUri: window.location.origin,
  sessionChecksEnabled: true,
  strictDiscoveryDocumentValidation: false,
  scope: 'openid profile email',
  silentRefreshRedirectUri: `${window.location.origin}/silent-refresh.html`,
  useSilentRefresh: true,
  customQueryParams: { access_type: 'offline', prompt: 'consent' },
  responseType: 'code',
};
