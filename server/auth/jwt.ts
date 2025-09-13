import { expressjwt as jwt } from 'express-jwt';
import jwks from 'jwks-rsa';

export const requireAuth = jwt({
  secret: jwks.expressJwtSecret({
    jwksUri: `https://login.microsoftonline.com/${process.env.TENANT_ID}/discovery/v2.0/keys`,
    cache: true,
    rateLimit: true,
  }) as any,
  audience: process.env.API_AUDIENCE,
  issuer: process.env.ISSUER,
  algorithms: ['RS256'],
});
