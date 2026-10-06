# Apple Developer Program License Agreement — Compliance Review
**App:** HomeCookedPlate (Homecooked Plate Marketplace)  
**Bundle ID:** `app.rork.homecookedplate-dynamic-gradient-food-marketplace-v1-1`  
**Review Date:** July 8, 2026  
**Agreement Version Reviewed:** LYL251 — June 18, 2026  

---

## Executive Summary

HomeCookedPlate is a peer-to-peer home-cooked food marketplace built on Expo/React Native with a Cloudflare Workers + Supabase backend. Payments are processed exclusively through Stripe (not Apple's In-App Purchase system). This review assesses compliance across all applicable sections of the updated Apple Developer Program License Agreement.

**Overall Status: ⚠️ CONDITIONAL — Several items require action before App Store submission.**

---

## Section-by-Section Compliance Assessment

---

### ✅ Section 2 — Internal Use License and Restrictions

| Item | Status | Notes |
|------|--------|-------|
| Apple Software used only for permitted purposes | ✅ Pass | Used solely for building and distributing the iOS/iPadOS app |
| No redistribution or sublicensing of Apple Software | ✅ Pass | Not redistributed |
| Apple SDKs used only on Apple-branded hardware | ✅ Pass | Expo/Xcode build pipeline is standard |
| No decompilation or reverse engineering | ✅ Pass | No such activity present |

---

### ✅ Section 3.1 — General Developer Obligations

| Item | Status | Notes |
|------|--------|-------|
| Developer is of legal age and authorized representative | ✅ Assumed | Legal entity enrolled in developer program |
| Information provided to Apple is accurate | ✅ Pass | Standard submission requirements |
| Authorized Developers comply with Agreement | ✅ Pass | Internal team responsibility |

---

### ⚠️ Section 3.2 — Use of Apple Software and Services

| Item | Status | Notes |
|------|--------|-------|
| App does not facilitate illegal activity | ✅ Pass | Food marketplace is a lawful use |
| App does not threaten or incite violence | ✅ Pass | Not applicable |
| App complies with Documentation and Program Requirements | ⚠️ See Section 3.3 | See detailed findings below |
| App does not disable security mechanisms | ✅ Pass | No attempt to bypass signing or sandboxing |
| No fraudulent use of App Store (e.g., fake reviews) | ✅ Pass | Review system is order-locked and user-generated |
| No AI-generated unlawful content | ✅ Pass | Workers AI used only for NSFW image moderation |

---

### ⚠️ Section 3.3.1 — APIs, Functionality, and User Interface

#### A. Documented APIs Only

| Item | Status | Notes |
|------|--------|-------|
| Only Documented APIs used | ✅ Pass | Expo SDK APIs; no private API calls found |
| No private API calls | ✅ Pass | Verified in codebase |

#### B. Executable Code

| Item | Status | Notes |
|------|--------|-------|
| No unauthorized download/execution of code | ✅ Pass | App does not download executable code at runtime |

#### C. Additional Features Unlocked via Distribution Mechanisms

| Item | Status | Notes |
|------|--------|-------|
| New features/functionality delivered only via App Store | ✅ Pass | No side-loading or alternate distribution of feature unlocks |

#### D. Designated Container Areas

| Item | Status | Notes |
|------|--------|-------|
| App reads/writes only to its designated container | ✅ Pass | Uses Supabase Storage and Expo secure-store per platform conventions |

#### G. Documentation and HIG

| Item | Status | Notes |
|------|--------|-------|
| Follows Human Interface Guidelines | ⚠️ Review Needed | App uses custom gradient UI; confirm HIG compliance for modals, navigation, text inputs, and accessibility (VoiceOver support not verified in codebase) |

---

### ⚠️ Section 3.3.2 — Regulatory Compliance

| Item | Status | Notes |
|------|--------|-------|
| Food safety disclosures | ✅ Pass | PlateMakers must acknowledge food safety before listing |
| Allergy disclaimers | ✅ Pass | Allergy field on orders; disclaimer on legal screen |
| FTC compliance (marketplace, reviews) | ✅ Pass | Reviews are tied to verified completed orders |
| State cottage food laws | ⚠️ Action Required | App geolocates users to U.S. metro areas. **Cottage food regulations vary significantly by state.** The app should include a conspicuous disclosure that PlateMakers are solely responsible for complying with applicable local, state, and federal cottage food, food handler certification, and home kitchen regulations. A static disclaimer is present but needs to be surfaced prominently at PlateMaker onboarding. |
| FDA regulations | ⚠️ Action Required | The app involves food production and sale. Confirm whether any listed meals trigger FDA registration requirements (e.g., operators producing for direct consumer sale at scale). The app currently does not collect or display FDA registration information from PlateMakers. |

---

### ⚠️ Section 3.3.3 — Data and Privacy

#### A. Recordings

| Item | Status | Notes |
|------|--------|-------|
| Camera/microphone recording indicator displayed | ⚠️ Review Needed | `expo-image-picker` and `expo-camera` are used for meal and profile photos, and microphone is declared for video. Confirm a conspicuous in-app indicator is shown when the camera/mic is active, beyond the OS-level permission prompt |

#### B. Collection and Use of Data

| Item | Status | Notes |
|------|--------|-------|
| No user/device data collected without prior consent | ✅ Pass | `agreedToTerms` is required at signup; location permission is requested explicitly |
| No use of permanent device identifier for unique identification | ⚠️ Action Required | **`device_id`** is stored on user profiles and used for the Lifetime Membership hardware lock (`auth.hardwareAudit`). Using a persistent device identifier for hardware-binding a paid feature may technically constitute using it "for purposes of uniquely identifying a device," which is restricted under Section 3.3.3(B). Evaluate whether this can be replaced with an account-level binding mechanism or cryptographic token rather than a raw device ID |
| Third-party SDKs are signed and include required metadata | ⚠️ Review Needed | Confirm that all third-party SDKs (Stripe, Sentry, Supabase) include required privacy manifests and are signed per Apple's requirements for iOS 17+ builds |

#### C. Disclosures to Users

| Item | Status | Notes |
|------|--------|-------|
| Privacy policy provided in app and on website | ⚠️ Action Required | A `privacy-security.tsx` screen exists with local data export and privacy toggles, but **no dedicated Privacy Policy URL or text is surfaced in the app UI or App Store product page** in the reviewed code. A hosted, publicly accessible Privacy Policy URL must be provided in App Store Connect |
| Users notified of data breach | ⚠️ Not Implemented | No breach notification system was found in the codebase. This is a legal requirement under applicable laws (CCPA, etc.) and must be addressed |
| Privacy controls (pause, delete, 2FA) are functional | ⚠️ Action Required | Per codebase analysis, account pause, delete, and 2FA toggles appear to be **UI/local state only** and are not backed by server-side API calls. Account deletion must fully delete or anonymize user data server-side to comply with App Store requirements (Apple guideline 5.1.1) and applicable privacy law |

#### D. Legal and Other Requirements

| Item | Status | Notes |
|------|--------|-------|
| Compliance with applicable privacy laws (CCPA, etc.) | ⚠️ Action Required | The app collects location data, device ID, payment data, user-generated food content, and order history. A full privacy law compliance review (CCPA, state privacy laws) should be performed, particularly given the U.S.-metro geo-gating model |
| App not designed for harassment/stalking | ✅ Pass | Messaging is limited to order-related conversation |
| No scraping of Apple services | ✅ Pass | Not applicable |

#### F. Location and Maps; User Consents

| Item | Status | Notes |
|------|--------|-------|
| Location consent obtained before collection | ✅ Pass | `expo-location` permission requested before GPS use |
| `NSLocationWhenInUseUsageDescription` declared | ⚠️ Verify | The description string is expected to be injected by the `expo-location` Expo config plugin at build time. Verify the final `Info.plist` in a production build contains a clear, descriptive purpose string (not just a generic phrase) |
| Location used only as consented | ✅ Pass | Used for metro assignment only; not background-tracked |
| Location not used for emergency/life-safety | ✅ Pass | Not applicable |

---

### ✅ Section 3.3.4 — Content Rights and Licensing

| Item | Status | Notes |
|------|--------|-------|
| User-generated content (photos, meal listings) is owned by users | ✅ Pass | Users upload their own content; NSFW scanning applied |
| No malware or harmful code | ✅ Pass | Workers AI NSFW moderation and text sanitization in place |
| FOSS compliance | ✅ Pass | Open source dependencies (React Native, Expo, etc.) used under standard licenses (MIT, Apache) |
| No unauthorized music or copyrighted media embedded | ✅ Pass | No music/media assets embedded in the app binary |

---

### ⚠️ Section 3.3.7 — Infrastructure Technologies

#### C. Apple Push Notification Service

| Item | Status | Notes |
|------|--------|-------|
| Push notifications only sent with end-user consent | ✅ Pass | `expo-notifications` permission requested; `notifications-context.tsx` provides granular preference toggles |
| No unsolicited push messages or spam | ✅ Pass | Notifications are transactional (orders, messages, payments) |
| No advertising-only push without explicit opt-in | ⚠️ Review Needed | "Promos" is a notification toggle category. Confirm that promotional push is only sent when users have explicitly opted in to that category, per Attachment 1, Section 2.2 |

---

### 🚨 Section 3.3.9 — Transactions and Passes

#### In-App Purchase API Requirement (Critical)

| Item | Status | Notes |
|------|--------|-------|
| **Digital goods/services sold within app use IAP** | 🚨 **Critical Risk** | The **PlateMaker membership subscription ($4.99/month or $39.99/year)** is sold within the app using **Stripe**, not Apple's In-App Purchase API. Per Section 3.3.1(C) and App Store Guideline 3.1.1, **digital content, subscriptions, and in-app functionality sold within an iOS app must use the In-App Purchase API.** This is among the most common and serious reasons for App Store rejection. The Stripe subscription flow must be either: (a) replaced with StoreKit/IAP for App Store builds, or (b) restricted to a non-App Store distribution channel |
| **Physical goods exemption** | ✅ Applicable | Meal orders are for **physical food** prepared and picked up in person. Physical goods and services are exempt from the IAP requirement. The Stripe-based order checkout is acceptable |
| Apple Pay configuration present but not active | ℹ️ Info | `merchantIdentifier` is set in `app.json` for Stripe's Apple Pay support. If the Payment Sheet presents Apple Pay as an option (Stripe does this automatically when configured), Apple Pay is technically active. This is acceptable for physical goods; no separate Apple Pay API compliance issue |

---

### ✅ Section 5 — Apple Certificates; Revocation

| Item | Status | Notes |
|------|--------|-------|
| Distribution certificate not shared with third parties | ✅ Pass | Standard Expo build/submission process |
| No certificate used to sign third-party apps | ✅ Pass | Not applicable |
| Certificates protected from compromise | ✅ Assumed | Developer responsibility |

---

### ✅ Section 6 — Application Submission and Selection

| Item | Status | Notes |
|------|--------|-------|
| App is complete and adequately tested before submission | ✅ Assumed | Developer responsibility |
| No hidden features or misrepresentation to Apple review | ✅ Pass | No obfuscation techniques found |
| Metadata and screenshots accurately represent the app | ⚠️ Action Required | **Fee disclosure inconsistency:** `app/legal.tsx` states a **15% platform fee / 85% seller payout**, but the runtime code in `backend/lib/fees.ts` implements a **"Double 10" model** (buyer pays +10%, seller receives −10%, resulting in ~20% platform capture). All user-facing disclosures and App Store metadata must accurately reflect the actual fee structure applied at checkout |

---

### ✅ Section 6.8 — Compatibility with Current OS Version

| Item | Status | Notes |
|------|--------|-------|
| App compatible with current iOS shipping version | ✅ Pass | Expo SDK 54 / React Native 0.81 targets current iOS versions |
| Minimum iOS version declared | ✅ Pass | Expo sets `deploymentTarget` in `app.json` |

---

### ⚠️ Section 7 — Distribution

| Item | Status | Notes |
|------|--------|-------|
| App distributed only through authorized channels | ✅ Pass | App Store + TestFlight (standard) |
| No other iOS distribution without Apple authorization | ✅ Pass | No enterprise/sideload distribution found |

---

### ✅ Section 9 — Confidentiality

| Item | Status | Notes |
|------|--------|-------|
| Pre-release Apple Software not publicly disclosed | ✅ Pass | Standard developer responsibility |

---

### ✅ Section 14.8 — Export Control

| Item | Status | Notes |
|------|--------|-------|
| No export-controlled content | ✅ Pass | Food marketplace; no encryption exported beyond standard HTTPS/TLS |
| App not targeting embargoed regions | ✅ Pass | U.S.-only metro geo-gating |

---

## App Store Guidelines — Additional Compliance Notes

Beyond the License Agreement itself, the following App Store Review Guidelines are directly relevant:

| Guideline | Item | Status |
|-----------|------|--------|
| **2.1** | App completeness | ✅ App appears functionally complete |
| **3.1.1** | In-App Purchase for digital goods | 🚨 **Membership subscription must use IAP on App Store** |
| **5.1.1** | Data Collection and Storage | ⚠️ Account deletion must be server-side and fully effective |
| **5.1.2** | Data Use and Sharing | ⚠️ Privacy Policy must be a hosted URL, not just in-app text |
| **5.1.1(v)** | Privacy Nutrition Labels | ⚠️ App Store privacy questionnaire must accurately declare: location, device ID, user ID, photos/video, purchase history, contact info, usage data |

---

## Priority Action Items

### 🚨 Critical (Blocks App Store Approval)

1. **Membership Subscription → Switch to In-App Purchase (IAP)**  
   The $4.99/month and $39.99/year PlateMaker membership subscriptions sold within the app must use Apple's StoreKit In-App Purchase API for App Store builds. Stripe subscriptions are only permissible for membership managed outside the app (e.g., on a website). Consider using `expo-iap` or the native `StoreKit` APIs. Physical meal orders via Stripe remain compliant.

2. **Fee Disclosure Inconsistency**  
   Align the fee text in `app/legal.tsx` with the actual runtime fee model in `backend/lib/fees.ts`. Misrepresentation of fees to users may result in App Store rejection and potential consumer protection issues.

### ⚠️ High Priority (Required Before Submission)

3. **Server-Side Account Deletion**  
   Implement a backend API endpoint for full account deletion that removes or anonymizes all PII from Supabase (profile, orders, messages, reviews, meal listings, payment metadata). Apple requires a functional in-app account deletion mechanism (Guideline 5.1.1).

4. **Privacy Policy — Hosted URL**  
   Publish a complete Privacy Policy at a stable public URL and add it to App Store Connect and within the app's settings. The policy must disclose collection of: location, device ID, photos/video, name/email/phone, order/payment history, and usage data.

5. **`device_id` Usage Review**  
   Replace persistent device ID binding for Lifetime Membership with an account-level or cryptographic approach that does not rely on a permanent hardware identifier to "uniquely identify a device," per Section 3.3.3(B).

6. **Cottage Food / Regulatory Disclaimer at Onboarding**  
   Surface a prominent, affirmative disclosure during PlateMaker onboarding that sellers are solely responsible for compliance with applicable state and local cottage food, food handling, and permitting laws.

### ℹ️ Lower Priority (Best Practices / Pre-Launch)

7. **Privacy Nutrition Labels**  
   Before submitting to App Store Connect, complete the App Privacy questionnaire accurately. Based on the codebase, expect to declare: location (precise), device ID, user ID, photos/video, purchase history, contact info (name/email/phone), and usage data.

8. **Push Notification Promotional Opt-In**  
   Confirm that "Promo" push notifications are only dispatched to users who have explicitly enabled that toggle, distinct from operational notifications.

9. **`NSLocationWhenInUseUsageDescription` — Purpose String**  
   Verify the production `Info.plist` contains a meaningful, app-specific description (e.g., "HomeCookedPlate uses your location to find available PlateMakers in your metro area") rather than a generic placeholder.

10. **Accessibility / HIG Review**  
    Conduct a VoiceOver/accessibility pass. Custom gradient UI and dynamic navigation tabs should be verified against HIG standards.

11. **Third-Party SDK Privacy Manifests**  
    Confirm `@stripe/stripe-react-native`, `@sentry/react-native`, and `expo-location` supply Apple-required privacy manifests (`.xcprivacy`) for iOS 17+ builds.

12. **Breach Notification Procedure**  
    Establish an internal procedure (even if manual) for notifying affected users in the event of a data breach, as required by applicable state laws and Section 3.3.3(C).

---

## Compliant Items Summary

The following aspects of the app are well-handled:

- **Physical goods payments via Stripe** — Meal orders are exempt from IAP requirements
- **Location consent flow** — GPS requested with clear permission prompts before use
- **User-generated content moderation** — Workers AI NSFW scanning and text sanitization
- **Food safety acknowledgment** — Required at PlateMaker onboarding and before meal publishing
- **Order-locked reviews** — Reviews tied to completed orders prevent fake review fraud
- **Push notification preferences** — Granular opt-in/opt-out per notification type
- **Secure credential storage** — `expo-secure-store` (Keychain/Keystore) for auth tokens
- **No private API usage** — Only Documented APIs used throughout
- **Export control** — U.S.-only geo-fencing; no restricted-territory distribution
- **Allergy and liability disclosures** — Present in checkout and legal screens

---

## References

- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple Developer Program License Agreement (LYL251, June 18, 2026)](https://developer.apple.com/support/terms/)
- [StoreKit / In-App Purchase Documentation](https://developer.apple.com/in-app-purchase/)
- [App Privacy Details on the App Store](https://developer.apple.com/app-store/app-privacy-details/)
- [Account Deletion Requirement](https://developer.apple.com/news/announcements/requirements-for-account-deletion-in-ios-apps)
- `backend/lib/fees.ts` — Authoritative fee calculation logic
- `app/legal.tsx` — User-facing fee disclosures (currently inconsistent)
- `backend/trpc/routes/auth/` — Auth and signup flows
- `app.json` — Permissions, entitlements, and build config
