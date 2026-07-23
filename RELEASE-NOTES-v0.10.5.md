# Kitchen Companion v0.10.5

## Profile menu outside-tap fix

- Profile **More** menus now close immediately when tapping anywhere outside the open menu, including elsewhere inside the profile manager on iPhone/iPad Safari.
- Uses a capture-phase pointer handler so dialog and form event handling cannot swallow the outside tap.
- Retains same-button toggle, Escape-key closing, and single-open-menu behavior.
