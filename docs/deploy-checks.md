# Health
curl -i https://<API_HOST>/api/health

# CORS preflight
curl -i -X OPTIONS "https://<API_HOST>/api/auth/login" \
  -H "Origin: https://<FRONTEND_HOST>" \
  -H "Access-Control-Request-Method: POST"

# Expect 200/204 and Access-Control-Allow-* headers
