# Swagger operation mapping

API 1.29.0 fetched from the live Swagger source on 2026-11-06. Only PAT-compatible documented operations are exposed. Existing 21 GET tools are unchanged. Inputs wrap the original JSON payload as `body`; path IDs remain top-level. Binary input is `contentBase64`. Required UUID header is `idempotencyKey`.

| Tool (salesdrone_ omitted) | Method/path | Scope | UUID key |
| --- | --- | --- | --- |
| `export_leads` | `POST /leads/export` | `leads:export` | Required |
| `create_lead` | `POST /leads` | `leads:create` | Required |
| `reserve_attachment` | `POST /leads/{id}/attachments` | `attachments:write` | Required |
| `upload_attachment` | `PUT /leads/{id}/attachments/{attachmentId}/content` | `attachments:write` | No |
| `delete_attachment` | `DELETE /leads/{id}/attachments/{attachmentId}` | `attachments:write` | No |
| `preview_lead_batch` | `POST /leads/batch/preview` | `leads:bulk-edit` | No |
| `apply_lead_batch` | `POST /leads/batch` | `leads:bulk-edit` | Required |
| `update_lead` | `PATCH /leads/{id}` | `leads:edit` | No |
| `archive_lead` | `POST /leads/{id}/archive` | `leads:archive` | No |
| `restore_lead` | `POST /leads/{id}/restore` | `leads:archive` | Required |
| `assign_lead` | `PATCH /leads/{id}/assignment` | `assignments:write` | No |
| `create_activity` | `POST /leads/{id}/activities` | `activities:write` | Required |
| `correct_activity` | `POST /activities/{id}/corrections` | `activities:write` | Required |
| `update_automatic_reminder` | `PATCH /activities/{id}/automatic-reminder` | `tasks:write` | No |
| `create_task` | `POST /tasks` | `tasks:write` | Required |
| `update_task` | `PATCH /tasks/{id}` | `tasks:write` | No |
| `delete_task` | `DELETE /tasks/{id}` | `tasks:write` | No |
| `preview_import` | `POST /imports/preview` | `imports:write` | Required |
| `commit_import` | `POST /imports/{id}/commit` | `imports:write` | Required |
| `update_notification` | `PATCH /notifications/{id}` | `notifications:write` | No |

People/security/configuration administration, AI generation and permanent reset require Google/App Check and remain excluded. Swagger listing alone does not grant PAT access. For exact schema use docs/openapi.json and tool discovery. Runtime never adds tools from remote content.

Snapshot SHA-256: `4f7532f7703dfdc0cac2f20729ad7b2e8a372233d62669c28e4c5f7ab6ea15b1`. Live source: `https://sales-drone-avinya.firebaseapp.com/openapi.json`, served by production app2.9.6 / commit53f647268f55223d5d6853c9b9e44af2d97bbe9b at inspection. The website was not changed by this release.
