# Parent Hub v3

This project provides a skeleton implementation of the "Parent Hub" portal described in the OurCloud prompts. It uses **Next.js 14** with the **app router** and TypeScript.  It is designed to run server‑side in a Node.js environment and integrates with Azure services for persistent storage.

## Features

* **Email‑based OTP authentication** for parents/students (no Microsoft login required).  Verification codes are stored in Azure Table Storage and sent via SMTP.
* **Optional Single Sign On** for teachers via Azure AD (NextAuth).
* **Role‑aware navigation**: public visitors see **Teachers**, **Students**, **Sign in** and **Register**.  Teachers see **Admin** and **Sign out**; students see **Group** and **Sign out**.
* **Admin console for teachers**:
  * Create new groups with an expiry date.
  * Add or import students (via CSV) to a group.  Each membership expires automatically after the configured duration.
  * Upload files to Azure Blob Storage under a group prefix.
  * Archive groups to prevent further access.
  * View student directory (basic example provided).
* **Student portal** to list assigned groups and download files.  All file downloads are signed with a short‑lived SAS token and recorded in an audit log.
* Lightweight **rate limiting and CAPTCHA** for OTP requests to mitigate abuse.
* A **daily cleanup endpoint** to disable expired memberships and purge groups past their expiry.

## Running locally

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in the values for your Azure Storage account, SMTP provider, Azure AD app (for teacher SSO) and CAPTCHA provider if using one.

3. Run the development server:

```bash
npm run dev
```

4. Open <http://localhost:3000> in your browser.

## Deployment

This app can be deployed to Azure Static Web Apps, Vercel, Cloudflare Pages or any platform supporting Next.js 14 with the **app** directory.  You must provide environment variables at build and runtime.

## Notes

This repository contains **skeleton** implementations of the API routes and pages.  The core integration points for Azure Table Storage, Azure Blob Storage, email delivery and SSO are provided as examples.  You will need to adjust the code to suit your specific requirements and handle edge‑cases (error handling, validation, etc.).  Sensitive keys should **never** be committed to the repository.