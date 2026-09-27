# Serenity Kitchen 0.21.48 — recipe removal and sharing

- **Remove from this device** hides a personal, shared, or installed recipe in the current local profile. Other people and devices keep their copies. If both people remove it, both stop seeing it on their respective devices. Restore through Settings → Hidden Recipes. No server recipe is permanently deleted.
- Recipe edits use individual content revisions and authenticated ownership. Concurrent edits preserve the server version and a named conflict copy; missing recipes in a list never mean deletion.
- Pending recipe changes persist across reloads and are separated by server, account, household, and local profile. Account/household changes invalidate in-flight responses. A local profile already linked to one account cannot be rebound to another account by signing in.
- Same-account devices download recipe additions and edits. Recipe history is paginated beyond 1,000 events. Read cursors are committed after local persistence. Unchanged polling does not consume local safety checkpoints.
- Recipe failures do not prevent uploads of shopping, pantry, or meal-plan collections. Those collections retain their existing conflict policy; this release does not redesign them.

Requires server 0.1.8 **before** publishing this website version. The compatible server preserves existing owner collections and their history, adds an idempotency ledger, and rejects content replacement by legacy whole-list clients. Older apps should update to continue editing shared recipes. Existing ambiguous shared-only legacy records remain preserved for ownership review.

Validation includes separate accounts, two devices on one account, offline/reloaded changes, conflicting edits, independent removal/restoration, failed saves, account switches, history pagination, and a real HTTP browser-client/server fixture. Real iPhone and Android verification remains necessary after installation. Clearing browser storage is not an update or recovery step.
