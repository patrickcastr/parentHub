import { PublicClientApplication } from "@azure/msal-browser";

export const MSAL_ENABLED = (import.meta as any).env?.VITE_MSAL_ENABLED === 'true';

export const MSAL_CONFIG = {
  clientId: (import.meta as any).env?.VITE_MSAL_CLIENT_ID || '<PLACEHOLDER_MSAL_CLIENT_ID>',
  authority: (import.meta as any).env?.VITE_MSAL_AUTHORITY || 'https://login.microsoftonline.com/<PLACEHOLDER_TENANT_ID>',
  redirectUri: (import.meta as any).env?.VITE_MSAL_REDIRECT_URI || 'https://<PLACEHOLDER_FRONTEND_HOST>/auth/callback',
};

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: MSAL_CONFIG.clientId,
    authority: MSAL_CONFIG.authority,
    redirectUri: MSAL_CONFIG.redirectUri,
    postLogoutRedirectUri: MSAL_CONFIG.redirectUri,
  },
  cache: { cacheLocation: 'localStorage' },
});

export const loginRequest = { scopes: [(import.meta as any).env?.VITE_API_SCOPE || 'api://default/.default'] };
