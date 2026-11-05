# Role matrix (draft)

Compiled from the route checks in the code. Confirm with the Director before relying on it.

| Action | Director | Principal | Head Teacher | Guest |
|---|---:|---:|---:|---:|
| Create Principal accounts | Yes | No | No | No |
| Create Guest accounts | Yes | Yes | No | No |
| Manage Guest accounts | Yes (all) | Yes (own) | No | No |
| Create Head Teacher accounts | No | Yes | No | No |
| Disable or enable Principal accounts | Yes (own) | No | No | No |
| Delete Principal accounts (soft delete) | Yes (own) | No | No | No |
| Disable or enable Head Teacher accounts | Principals (own) | Yes (own) | No | No |
| Approve or revoke devices | Yes | Yes | No | No |
| View all devices | Yes | Yes | No (own only) | No |
| Register students | Yes | Yes | Yes (own scope) | No |
| Promote students | Yes | Yes | No | No |
| Edit student profile fields (name, admission no. (YMS/YYYY/GG/SSS, format enforced), date of birth, gender, arm, guardian) | Yes | Yes | Yes (own scope) | No |
| Edit student class, arm, status | Yes | Yes | No | No |
| Archive students | Yes | Yes | No | No |
| Import students | Yes | Yes | Yes (own scope; out-of-scope rows skipped) | No |
| Resolve conflicts and merge queue | Yes | Yes | No | No |
| Replace an existing passport photo | No | Yes (reason required) | No | No |
| Export student PDF | Yes | Yes | Yes | No |
| Delegate permissions | No | Yes (reason required) | No | No |
| Revoke delegated permissions | Yes | Own grants only | No | No |
| Board of Directors directory entries | Yes | No | No | No |
| Management directory entries | Yes | Yes | No | No |
| Class teacher directory entries | Yes | Yes | Yes | No |
| Open external Student Results Portal | Yes | Yes | Yes | Yes (approved, active, unexpired account) |

"Own" means the account was created by the person acting. A deleted account is marked inactive, cannot sign in, and is hidden from staff lists.

Review this every term and whenever staff leave.

## Guest account controls

- Guest can open the same external Results Portal screen as staff; the results portal access is audited.

- Director can create and manage Guest accounts; Principal can create and manage Guest accounts they created.
- Creation requires a written reason, a future expiry (maximum 366 days), and an explicit list of student IDs. The default mobile form proposes 30 days.
- Guest student-list API access is restricted server-side to those assigned student IDs. Guest accounts are read-only and cannot sync mutations or view student photos.
- Guest Results Portal access is allowed after account approval, subject to active account status, expiry and trusted-device checks.
- Guest accounts have no baseline administrative permissions. Creation, suspension, reactivation, renewal, student-list views, sign-ins and results-portal access are audited.
