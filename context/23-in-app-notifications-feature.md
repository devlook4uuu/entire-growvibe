# 23 — In-App Push Notification Banner

## What Was Built

When the app is in the foreground and a push notification arrives, a custom sliding banner appears from the top of the screen — instead of relying solely on the system notification banner (which iOS suppresses when the app is open).

---

## File Created

### `growvibe-app-v1/components/InAppNotification.jsx`

A self-contained component that:
1. Registers a `Notifications.addNotificationReceivedListener`
2. On notification received: animates a dark card down from above the status bar
3. Auto-dismisses after 4000ms
4. Tap anywhere on the banner to dismiss early

### Visual design
- Background: `#1A1D26` (dark navy)
- Left accent bar: `Colors.primary` (brand color), 3px wide, full height
- Title: white, 14px, semiBold
- Body: `#94A3B8` (muted), 13px, regular
- Border radius: 16px
- Shadow: `0 4px 20px rgba(0,0,0,0.3)`
- Width: screen width minus `wp(8)` horizontal padding
- Top offset: `StatusBar.currentHeight + 8` (Android) or `52` (iOS) — clears the status bar/notch

### Animation (react-native-reanimated)
- `translateY` shared value: starts at `-(BANNER_HEIGHT + 60)` (above screen)
- On show: `withSpring(0, { damping: 18, stiffness: 200 })` — slides in with spring
- On dismiss: `withTiming(-(BANNER_HEIGHT + 60), { duration: 300 })` — slides out
- `BANNER_HEIGHT = 80`

### Auto-dismiss
```js
dismissTimer.current = setTimeout(() => dismiss(), 4000);
```
Timer is cleared on manual tap-dismiss and on component unmount.

---

## App Integration — `_layout.jsx`

`<InAppNotification />` rendered inside `RootLayoutInner`, at the top of the component tree (above the navigator stack) so it overlays all screens:

```jsx
function RootLayoutInner() {
  return (
    <>
      <ActiveStatusGuard />
      <InAppNotification />
      <Stack>...</Stack>
    </>
  );
}
```

The component uses `position: 'absolute'` + `zIndex: 9999` to float above all content.

---

## Key Decisions

1. **Reanimated over Animated API** — smoother spring animation on the JS thread. `withSpring` gives a natural feel without manual easing curves.
2. **Custom banner instead of system alert** — iOS suppresses system banners when the app is foreground. Custom banner ensures the user always sees the notification.
3. **4-second auto-dismiss** — long enough to read a short notification, short enough to not block the UI.
4. **No navigation on tap** — banner dismisses only. Routing logic on notification tap is handled separately by `Notifications.addNotificationResponseReceivedListener` (background/killed state).
5. **Self-contained** — listener registered inside the component, no Redux state needed. Banner content is local state.

---

## Gotchas

- `StatusBar.currentHeight` is only available on Android (returns `undefined` on iOS). The iOS top offset of `52` is a fixed approximation for the notch area. On non-notch iPhones this adds extra padding but doesn't break layout.
- If multiple notifications arrive rapidly, the banner resets with the newest notification (title/body updated, timer reset).
- `Notifications.addNotificationReceivedListener` only fires when the app is **foregrounded**. Background/killed notifications go through the system tray.
- `react-native-reanimated` must be installed and the Babel plugin configured in `babel.config.js`. Without it, the component crashes at runtime.
