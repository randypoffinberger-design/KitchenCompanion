# Kitchen Companion v0.5.1

Bug-fix release for mobile updates, shopping-list ingredient formatting, store assignment, sidebar scrolling, and direct GitHub module installation.

## Important repository layout
Upload the files from this folder directly to the root of the GitHub repository. In particular, keep these together at the root:

- `index.html`
- `app.js`
- `styles.css`
- `service-worker.js`
- `app.webmanifest`
- `catalog.json`
- the `.recipepack` files

## One-time iPhone update step
Older home-screen shortcuts were created before Kitchen Companion had a service worker. After uploading v0.5.1, open the GitHub Pages link in Safari, refresh it, then remove and re-add the Home Screen shortcut once. Future releases will use the new network-first service worker and the in-app **Check for app update** button.


## Recipe creation workflows

Recipes can be entered manually, pasted as complete plain text for automatic field parsing, or imported from one or more images using on-device browser text recognition when available. All imported content opens in the standard recipe editor for review and correction before saving.
