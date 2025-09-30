import { expressjwt as jwt } from 'express-jwt';
import jwks from 'jwks-rsa';

// Prefer AZURE_TENANT_ID; fall back to legacy TENANT_ID if present.
const TENANT = process.env.AZURE_TENANT_ID || process.env.TENANT_ID || '';

export const requireAuth = jwt({
  secret: jwks.expressJwtSecret({
    jwksUri: `https://login.microsoftonline.com/${TENANT}/discovery/v2.0/keys`,
    cache: true,
    rateLimit: true,
  }) as any,
  audience: process.env.API_AUDIENCE,
  issuer: process.env.ISSUER,
  algorithms: ['RS256'],
});

// Export a tiny status helper used elsewhere to confirm SSO JWT prereqs.
export function jwtConfigStatus() {
  return {
    tenant: TENANT,
    hasTenant: !!TENANT,
    audience: process.env.API_AUDIENCE || null,
    issuer: process.env.ISSUER || null,
  };
}
