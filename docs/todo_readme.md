📦 ParentHub – Production Storage Deployment Checklist

This document outlines the secure baseline configuration for deploying Azure Blob Storage for ParentHub.
Clients will never access blob storage directly — all file uploads/downloads go through our API, which enforces auth & authorization.

🔐 Security

 Require secure transfer = ✅ Enabled (HTTPS/TLS only)

 Minimum TLS version = 1.2 (can use 1.3 once GA)

 Allow anonymous public access = ❌ Disabled

 Enable storage account key access = ❌ Disabled in prod (use Entra ID only)

 Default to Microsoft Entra authorization in portal = ✅ Enabled

 Permitted scope for copy operations = Within same storage account (unless cross-acct needed)

🌐 Networking

 Public network access = Enabled

 Scope = Selected VNets & IPs only

Allowlist API outbound IPs (App Service, Container Apps, VM, etc.)

Block all others

 Private Endpoint = ❌ Not used (by design)

 CORS = None (since clients never talk to blob directly)

📂 Containers

 Create container parenthub-prod

 Access level = Private (no anonymous access)

👤 Identity & Access

 Assign Managed Identity (or SP) used by API:

Role = Storage Blob Data Contributor

Scope = container only (parenthub-prod)

 Store secrets in Azure Key Vault (if SP used)

 App code uses DefaultAzureCredential (no hard-coded keys)

🛡️ Data Protection

 Soft delete for blobs = ✅ Enabled (recommend 30 days retention)

 Soft delete for containers = ✅ Enabled (30 days recommended)

 Soft delete for file shares = ✅ Enabled (irrelevant if unused, but safe)

 Versioning for blobs = ✅ Enable (protects from overwrites)

 Blob change feed = ✅ Enable (audit log)

 Point-in-time restore = Optional (enable if you want container rollbacks)

 Immutability policies = Off (unless compliance requires)

🔒 Encryption

 Encryption type = Microsoft-managed keys (MMK)

 Customer-managed keys (CMK) = Only if compliance requires Key Vault control

 Infrastructure encryption = Off (enable only if strict compliance demands double encryption)

🧩 API Behavior (must enforce)

Uploads: Client → API → Blob

Validate file size, MIME type, filename

Stream upload to blob (don’t buffer in memory)

Log upload in DB (FileAccessLog)

Downloads: Client → API → Blob

API authorizes request (group membership, teacher role, etc.)

API streams blob or issues short-lived SAS (≤5 min)

Log download in DB (FileAccessLog)

Deletes: Only teachers/admins, API deletes blob + DB row, log action

📊 Monitoring

 Enable Microsoft Defender for Storage (malware scan, anomaly alerts)

 Enable Diagnostic logs → Log Analytics (audit every access)

 Setup alerts for: unusual egress, failed requests, Defender alerts

🔁 Ops & Lifecycle

 Enable key/credential rotation policy (if not using MI)

 Consider lifecycle rules (e.g., auto-archive/delete old files)

 Backup/DR strategy: choose redundancy (LRS/ZRS/GRS) per budget/RPO/RTO

✅ With this baseline:

Blobs are never public

Access is auth-gated through API

Data is recoverable from delete/overwrite

Encryption is always on

Monitoring & Defender provide visibility + threat protection