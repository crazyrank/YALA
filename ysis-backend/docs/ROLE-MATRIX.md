# Role matrix (draft)

Compiled from the route checks in the code. Confirm with the Director before relying on it.

| Action | Director | Principal | Head Teacher |
|---|---|---|---|
| Create Principal accounts | Yes | No | No |
| Create Head Teacher accounts | No | Yes | No |
| Disable or enable Principal accounts | Yes (own) | No | No |
| Delete Principal accounts (soft delete) | Yes (own) | No | No |
| Disable or enable Head Teacher accounts | Principals (own) | Yes (own) | No |
| Approve or revoke devices | Yes | Yes | No |
| View all devices | Yes | Yes | No (own only) |
| Register students | Yes | Yes | Yes (own scope) |
| Promote students | Yes | Yes | No |
| Edit student profile fields (name, registration no., date of birth, gender, arm, guardian) | Yes | Yes | Yes (own scope) |
| Change student class or division (promotion only) | Yes | Yes | No |
| Archive or restore students | Yes | Yes | No |
| Replace passport photo | No | Yes (reason required) | No |
| Import students | Yes | Yes | Yes (own division or classes only; other rows are reported and skipped) |
| Resolve conflicts and merge queue | Yes | Yes | No |
| Export student PDF | Yes | Yes | Yes |
| View results portal and school website | Yes | Yes | Yes |
| Delegate permissions | No | Yes (reason required) | No |
| Revoke delegated permissions | Yes | Own grants only | No |
| Board of Directors directory entries | Yes | No | No |
| Management directory entries | Yes | Yes | No |
| Class teacher directory entries | Yes | Yes | Yes |

Head teacher scope is their assigned division or classes. Head teachers cannot change class, division, or status, and cannot replace photos.

"Own" means the account was created by the person acting. A deleted account is marked inactive, cannot sign in, and is hidden from staff lists.

Review this every term and whenever staff leave.
