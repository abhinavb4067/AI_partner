# AI Companions — Mobile App (Flutter)

Full feature parity with the web app, for **normal users only** (no admin
surface), talking to the same FastAPI backend — no backend changes needed.

**Status: builds clean.** `flutter analyze` → 0 errors/warnings (cosmetic
`info`-level lints only). `flutter build apk --debug` → succeeds, produces a
working APK. Verified on this machine (Flutter 3.44.9 / JDK 17 / Android SDK
36) with `flutter create .`, `flutter pub get`, `flutter analyze`, and a real
Gradle build — not just written-and-hoped.

## Features

- **Auth**: Login, Register (email OTP), Forgot/Reset password, native Google Sign-In.
- **Character list**: Instagram-story row + WhatsApp-style chat list, restyled with the app's pink→purple brand.
- **AI chat**: text + AI-generated photos, hold-to-record voice notes (transcribed server-side), TTS playback on replies, out-of-credits paywall, typing indicator, Zero-Knowledge E2E encryption of chat history.
- **Profile**: plan/credits, account info, logout.
- **Pricing**: native plan list; checkout opens the existing web PaymentModal flow in an in-app WebView.
- **Social**: Discover (swipe cards), Matches, human-to-human chat over WebSocket with E2E encryption, view-once photos, read receipts.
- **Voice/video calls**: WebRTC (STUN + the same free TURN relay as the web app), full signaling over the shared chat socket, global incoming-call ring screen from anywhere in the app.
- **Push notifications**: FCM for chat + call/missed-call alerts, with Answer/Decline actions on the call notification.

## Setup

```bash
cd mobile_app
flutter create .          # only needed once, already done in this repo
flutter pub get
flutter run
```

Point at a different backend:
```bash
flutter run --dart-define=API_BASE_URL=https://your-backend.example.com \
            --dart-define=WEB_APP_URL=https://your-frontend.example.com
```

## External configuration this environment could not generate for you

Everything above is real, working code. These three integrations need
credentials/config from **your** Firebase/Google Cloud consoles — I have no
access to create them. The app degrades gracefully without them (features
just no-op) rather than crashing.

### 1. Push notifications (FCM)
Add to the **same Firebase project** as `backend/firebase_admin_sdk.json`:
- `android/app/google-services.json` (register package `com.avoiga.ai_girlfriend_app`)
- `ios/Runner/GoogleService-Info.plist`

Then uncomment the plugin line in `android/app/build.gradle.kts`:
```kotlin
id("com.google.gms.google-services")
```
(It's commented out so the app builds without the file; leaving it uncommented
with no `google-services.json` present fails the Gradle build immediately.)

### 2. Native Google Sign-In
`lib/services/google_auth_service.dart` reuses the web app's OAuth client ID
as `serverClientId`. For the native picker to actually work you additionally
need, in the same Google Cloud project:
- An **Android** OAuth client: package `com.avoiga.ai_girlfriend_app` + your
  debug/release keystore SHA-1 (`cd android && ./gradlew signingReport`).
- An **iOS** OAuth client: your bundle ID, and its reversed-client-id added as
  a URL scheme in `ios/Runner/Info.plist`.

### 3. Checkout WebView auto-login (optional, nice-to-have)
`PaymentWebviewScreen` opens `{WEB_APP_URL}/pricing?mobile_token=...`. For that
token to auto-authenticate the user (skipping a second login inside the
WebView), add a few lines to the React app's entry point that read
`mobile_token`/`mobile_uid` from the URL and seed them into `localStorage` as
`token`/`user_id` before the router mounts. Until added, users can still
complete checkout by signing in once inside the WebView.

## Windows build note

If you build on Windows with the project and Gradle/pub caches on different
drive letters, Kotlin's incremental compiler can throw "this and base files
have different roots". `android/gradle.properties` already sets
`kotlin.incremental=false` to work around it — keep that if you hit the same
issue elsewhere.

## Project layout

```
lib/
  core/           env config, theme, session storage, dio api client,
                  E2E crypto (sodium_libs), the shared chat/call websocket
  models/         Character, ChatMessage, HumanMessage
  services/       one file per backend route group, plus call_manager
                  (WebRTC) and push_service (FCM)
  screens/
    auth/         login, register+OTP, forgot/reset password
    home/         character list
    chat/         AI companion chat
    social/       discover, matches, human-to-human chat
    calls/        in-call screen (voice/video)
    profile/      profile
    pricing/      plans + WebView checkout
  widgets/        GradientAvatar, GradientButton, IncomingCallOverlay
  router.dart     go_router route table + auth redirect guard
  main.dart       app entry point
```
