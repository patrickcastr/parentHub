App Overhaul Plan (Future TODO)

This document outlines a possible redesign for handling all actions/commands in the app.
The idea is to unify different “attacks” (features like assign group, reset password, archive student) under one command-driven pipeline.

🎯 Goal

One consistent way to execute actions across the app.

Shared error handling, optimistic updates, audit logs, and telemetry.

Easier to add new actions without duplicating code.

🛠️ Frontend
1. Generic useAction hook

Accepts a command name and payload.

Handles API call, optimistic updates, rollback on error.

Supports React Query or fallback with plain useState.

2. Reusable ActionMenu (dropdown / buttons)

Each row in Students table uses ActionMenu.

Config-driven: add new actions just by passing command + payload.

Keeps table code simple.

🔌 Backend
3. Single /api/commands endpoint (CQRS-lite)

Accepts { command, payload, audit }.

Dispatches to registered handler functions.

Each handler validates payload, checks permissions, updates DB, emits events.

Example handler: students.assignGroup.

4. Event Emission (optional, future)

Handlers emit domain events (StudentGroupAssigned).

Can power SSE/WebSocket real-time updates later.

🔒 Cross-cutting

Audit log: who did what, when.

Idempotency keys: prevent duplicate side effects.

Telemetry: measure failures/success.

Permissions: central checks in handlers.

🚀 Rollout Steps

Add /api/commands with "students.assignGroup" handler.

Swap Assign Group dropdown to use useAction.

Migrate other actions (archive, invite, reset password).

(Optional) Add real-time event stream for multi-user sync.