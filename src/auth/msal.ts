import { PublicClientApplication } from "@azure/msal-browser";

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: import.meta.env.VITE_AAD_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_TENANT_ID}/v2.0`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI!,
    postLogoutRedirectUri: import.meta.env.VITE_REDIRECT_URI!,
  },
  cache: { cacheLocation: 'localStorage' },
});

export const loginRequest = { scopes: [import.meta.env.VITE_API_SCOPE!] };
