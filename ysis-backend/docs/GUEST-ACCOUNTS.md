# Guest accounts

## Authority

- Director can create and manage all Guest accounts.
- Principal can create and manage Guest accounts they created.
- Head Teachers and Guests cannot create or manage Guest accounts.
- The normal `/users` endpoint does not accept `guest`; provisioning uses `/guest-accounts`.

## Provisioning

`POST /guest-accounts` requires `fullName`, `email`, optional `phone`, a written `reason`, `expiresAt`, and 1-100 `studentIds`. The server validates student IDs, creates an active Guest user with a generated temporary credential, forces a password change, stores explicit student access, and writes an audit event. The credential is returned once.

## Access rules

- Guest account expiry is checked at login, refresh, and every authenticated API request.
- Guest first devices require approval; they are not auto-trusted. Subsequent devices follow the existing device-trust workflow.
- Guest student-list and incremental sync queries are restricted by `guest_student_access` on the server. Guest sync responses omit DOB, gender and arm.
- Guest accounts are read-only: the mutation sync endpoint excludes the Guest role, and student write scope checks fail closed for Guest. Student photos are not accessible.
- Guest can open the same external Results Portal as staff. This is intentionally not restricted to assigned student IDs, per the product decision. Opening the portal and saved-login use are audited.
- Guest biometric unlock revalidates the session online; an offline cached Guest session cannot unlock the app.

## Management endpoints

- `POST /guest-accounts`: create/approve a Guest account.
- `GET /guest-accounts`: list accounts in the caller's management scope.
- `PATCH /guest-accounts/:id/status`: suspend or reactivate; increments `session_version`.
- `PATCH /guest-accounts/:id/renew`: set a new expiry and reason; increments `session_version`.
- `POST /guest-accounts/student-views/:studentId`: records a Guest student-detail view after verifying assignment.

Run migrations `019_guest_accounts` and `020_guest_account_details` before deploying the backend. The frontend does not confer authority; every management endpoint independently requires Director or Principal role and checks ownership.
