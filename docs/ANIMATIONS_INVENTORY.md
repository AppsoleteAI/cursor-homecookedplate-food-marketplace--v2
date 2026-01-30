# App Animations Inventory

## Total Animations: **10 Distinct Animation Systems**

This document catalogs all animations in the HomeCookedPlate app, their locations, functions, and technical details.

---

## 1. Loading Splash Screen - Logo Pulse Animation
**Location**: `components/LoadingSplashScreen.tsx`  
**Library**: `react-native-reanimated`  
**Type**: Scale + Opacity Animation

### Function:
- **Purpose**: Provides visual feedback during app initialization/auth hydration
- **User Experience**: Prevents white flash, shows branded loading state
- **Context**: Shown when `app/index.tsx` detects `isLoading = true` during auth hydration

### Technical Details:
- **Animation 1 - Logo Pulse**:
  - Property: `scale` (transform)
  - Range: `1.0` → `1.05` (5% scale increase)
  - Duration: `1200ms` per cycle
  - Easing: `Easing.inOut(Easing.ease)`
  - Repeat: Infinite (with reverse)
  
- **Animation 2 - Glow Pulse**:
  - Property: `opacity`
  - Range: `0.3` → `0.6`
  - Duration: `1500ms` per cycle
  - Easing: `Easing.inOut(Easing.ease)`
  - Repeat: Infinite (with reverse)

### Visual Effect:
- Logo gently pulses (breathes) while loading
- Subtle glow circle behind logo pulses in sync
- Creates premium "cooking/preparing" feel

---

## 2. Shimmer Logo - Interactive Shimmer Effect
**Location**: `components/ShimmerLogo.tsx`  
**Library**: `react-native-reanimated`  
**Type**: Translate + Scale Animation

### Function:
- **Purpose**: Interactive logo component with shimmer effect on tap
- **User Experience**: Provides tactile feedback and premium feel
- **Context**: Used in various screens (likely profile, dashboard, etc.)

### Technical Details:
- **Animation 1 - Shimmer Ripple**:
  - Property: `translateX` (transform)
  - Range: `-200` → `300` (500px horizontal sweep)
  - Duration: `2500ms`
  - Easing: `Easing.bezier(0.42, 0, 0.58, 1)` (smooth ease-in-out)
  - Trigger: On component mount + on tap gesture
  
- **Animation 2 - Continuous Pulse**:
  - Property: `scale` (transform)
  - Range: `1.0` → `1.03` (3% scale increase)
  - Duration: `2000ms` per cycle
  - Easing: `Easing.inOut(Easing.ease)`
  - Repeat: Infinite (with reverse)

### Visual Effect:
- Shimmer gradient sweeps across logo from left to right
- Logo continuously pulses subtly
- Tap gesture triggers additional shimmer sweep
- Creates interactive, premium feel

---

## 3. Login Screen - Logo Rotation Animation
**Location**: `app/(auth)/login.tsx`  
**Library**: `react-native.Animated` (legacy API)  
**Type**: Rotation Animation

### Function:
- **Purpose**: Celebratory animation after successful login
- **User Experience**: Provides visual feedback that login was successful
- **Context**: Triggers when `isLoggingIn = true` after successful authentication

### Technical Details:
- **Animation**: Two-phase rotation sequence
  - **Phase 1 (Slow)**:
    - Property: `rotate` (transform)
    - Range: `0°` → `720°` (platetaker) or `0°` → `-720°` (platemaker)
    - Duration: `2000ms`
    - Easing: `Easing.out(Easing.quad)` (slow start)
    
  - **Phase 2 (Fast)**:
    - Property: `rotate` (transform)
    - Range: `720°` → `1440°` (platetaker) or `-720°` → `-1440°` (platemaker)
    - Duration: `2000ms`
    - Easing: `Easing.in(Easing.quad)` (fast end)
  
- **Total Duration**: `4000ms` (4 seconds)
- **Total Rotation**: `1440°` (4 full rotations) or `-1440°` (reverse)

### Visual Effect:
- Logo spins 4 full rotations (slow then fast)
- Direction depends on user role:
  - **Platetaker**: Clockwise (positive rotation)
  - **Platemaker**: Counter-clockwise (negative rotation)
- After animation completes, navigates to appropriate dashboard

### Issue:
- **Blocks navigation for 4 seconds** - user must wait for animation before accessing app
- **Recommendation**: Navigate immediately, animate in background

---

## 4. Signup Screen - Logo Rotation Animation
**Location**: `app/(auth)/signup.tsx`  
**Library**: `react-native.Animated` (legacy API)  
**Type**: Rotation Animation

### Function:
- **Purpose**: Celebratory animation after successful account creation
- **User Experience**: Provides visual confirmation that signup was successful
- **Context**: Triggers when `isSigningUp = true` after successful signup

### Technical Details:
- **Animation**: Identical to login animation (two-phase rotation)
  - **Phase 1 (Slow)**: `0°` → `±720°` over `2000ms`
  - **Phase 2 (Fast)**: `±720°` → `±1440°` over `2000ms`
  - **Total Duration**: `4000ms`
  - **Direction**: Based on `signupUserRole` (platetaker/platemaker)

### Visual Effect:
- Same spinning logo effect as login
- After animation, shows alert: "Account Created! Please sign in"
- Redirects to login screen

### Issue:
- **Same blocking issue as login** - 4 second delay
- **Additional UX issue**: Requires manual alert dismissal before redirect

---

## 5. Home Screen - Featured Meal Image Fade Transition
**Location**: `app/(tabs)/(home)/home.tsx`  
**Library**: `react-native.Animated` (legacy API)  
**Type**: Opacity Fade Animation

### Function:
- **Purpose**: Smoothly transitions between featured meal images in carousel
- **User Experience**: Prevents jarring image swaps, creates smooth visual flow
- **Context**: Automatically cycles through top 5 rated meals every 8 seconds

### Technical Details:
- **Animation**: Fade out → Fade in sequence
  - **Fade Out**:
    - Property: `opacity`
    - Range: `1.0` → `0.0`
    - Duration: `500ms`
    
  - **Fade In**:
    - Property: `opacity`
    - Range: `0.0` → `1.0`
    - Duration: `500ms`
  
- **Total Cycle Duration**: `8000ms` (8 seconds) per image
- **Transition Duration**: `1000ms` (500ms out + 500ms in)

### Visual Effect:
- Current featured meal image fades out
- Next featured meal image fades in
- Creates smooth carousel effect without jarring swaps
- Automatically advances through top-rated meals

---

## 6. Checkout Screen - Confetti Rain Animation
**Location**: `app/checkout.tsx`  
**Library**: `react-native.Animated` (legacy API)  
**Type**: Particle System Animation

### Function:
- **Purpose**: Celebration animation after successful order/payment
- **User Experience**: Creates excitement and confirms successful transaction
- **Context**: Triggers when `playConfetti = true` after payment success

### Technical Details:
- **Particle Count**: `180` particles
- **Particle Properties**:
  - Size: `2-5px` (random)
  - Length: `8-16px` (random)
  - Colors: `['#FDE68A', '#F59E0B', '#D97706']` (gold/yellow palette)
  - Delay: `0-800ms` (random per particle)
  - Duration: `2500-4500ms` (random per particle)
  - Rotation: `0-360°` (random)
  
- **Animation**:
  - Property: `translateY`, `translateX`, `opacity`, `rotate`
  - Movement: Falls from top to bottom with slight sway
  - Opacity: Fades in → visible → fades out
  - Stagger: `60ms` delay between particle groups

### Visual Effect:
- 180 golden/yellow confetti particles rain down from top of screen
- Each particle has unique timing, creating organic feel
- Particles sway slightly as they fall
- Creates celebratory "success" feeling

---

## 7. Checkout Screen - Corner Confetti Burst
**Location**: `app/checkout.tsx`  
**Library**: `react-native.Animated` (legacy API)  
**Type**: Particle System Animation

### Function:
- **Purpose**: Additional celebration effect from screen corners
- **User Experience**: Enhances celebration, creates more dynamic visual
- **Context**: Triggers when `playCorners = true` after payment success

### Technical Details:
- **Particle Count**: `112` particles (`56` per corner × 2 corners)
- **Particle Properties**:
  - Size: `3-6px` (random)
  - Length: `10-20px` (random)
  - Colors: `['#B45309', '#92400E', '#78350F', '#A16207']` (dark brown/gold palette)
  - Delay: `0-220ms` (random per particle)
  - Duration: `1600-2500ms` (random per particle)
  - Rotation: `0-360°` (random)
  
- **Animation**:
  - Property: `translateX`, `translateY`, `opacity`, `rotate`
  - Movement: Bursts from left/right corners, arcs toward center
  - Peak Height: `55%` of screen height (random per particle)
  - Opacity: Fades in → visible → fades out
  - Stagger: `40ms` delay between particle groups

### Visual Effect:
- Confetti bursts from left and right corners simultaneously
- Particles arc upward then fall, creating explosion effect
- Darker color palette complements main confetti rain
- Creates more dynamic, multi-directional celebration

---

## 8. Checkout Screen - Congratulations Flash Badge
**Location**: `app/checkout.tsx`  
**Library**: `react-native.Animated` (legacy API)  
**Type**: Opacity Flash Animation

### Function:
- **Purpose**: Highlights success message with attention-grabbing flash
- **User Experience**: Draws user's eye to success confirmation
- **Context**: Triggers when `showCongrats = true` after payment success

### Technical Details:
- **Animation**: Fade in → Hold → Fade out (repeated 3 times)
  - **Fade In**:
    - Property: `opacity`
    - Range: `0.0` → `1.0`
    - Duration: `700ms`
    
  - **Hold**:
    - Duration: `2000ms` (fully visible)
    
  - **Fade Out**:
    - Property: `opacity`
    - Range: `1.0` → `0.0`
    - Duration: `700ms`
    
  - **Delay Between Cycles**: `100ms`
  - **Total Iterations**: `3` cycles
  - **Total Duration**: `~10.2 seconds` (3 × 3.4s)

### Visual Effect:
- Yellow gradient badge with "CONGRATULATIONS" text
- Flashes 3 times (fade in, hold, fade out)
- Positioned at bottom of screen above footer
- Creates attention-grabbing success confirmation

---

## Animation Library Usage Summary

### Libraries Used:
1. **`react-native-reanimated`** (Modern, performant):
   - LoadingSplashScreen (2 animations)
   - ShimmerLogo (2 animations)
   - **Total**: 4 animations

2. **`react-native.Animated`** (Legacy API):
   - Login rotation (1 animation)
   - Signup rotation (1 animation)
   - Home screen fade (1 animation)
   - Confetti rain (1 animation)
   - Corner confetti (1 animation)
   - Congrats flash (1 animation)
   - **Total**: 6 animations

### Performance Considerations:
- **Reanimated animations**: Run on UI thread (60fps, smooth)
- **Legacy Animated**: Run on JS thread (may drop frames on slow devices)
- **Recommendation**: Migrate legacy animations to Reanimated for better performance

---

## Animation Functions by Category

### Loading/Feedback Animations (3):
1. Loading Splash Screen - Logo Pulse
2. Loading Splash Screen - Glow Pulse
3. Shimmer Logo - Continuous Pulse

### Authentication Animations (2):
4. Login Screen - Logo Rotation
5. Signup Screen - Logo Rotation

### Interactive Animations (1):
6. Shimmer Logo - Tap Shimmer

### Content Transitions (1):
7. Home Screen - Image Fade

### Celebration Animations (3):
8. Checkout - Confetti Rain
9. Checkout - Corner Confetti
10. Checkout - Congratulations Flash

---

## Recommendations for Optimization

### High Priority:
1. **Migrate legacy animations to Reanimated** - Better performance, smoother on all devices
2. **Reduce login/signup animation duration** - 4 seconds is too long, blocks navigation
3. **Navigate immediately, animate in background** - Don't block user access for animations

### Medium Priority:
4. **Optimize particle counts** - 180 + 112 particles may cause performance issues on low-end devices
5. **Add animation skip option** - Allow users to skip animations after first viewing
6. **Lazy load celebration animations** - Only load confetti when needed

### Low Priority:
7. **Add animation preferences** - Let users disable animations in settings
8. **Optimize shimmer performance** - Ensure it doesn't impact scroll performance
9. **Add haptic feedback** - Enhance animations with tactile feedback

---

## Animation Performance Metrics

### Current Performance:
- **Reanimated animations**: Excellent (UI thread, 60fps)
- **Legacy animations**: Good (JS thread, may drop frames)
- **Particle systems**: May lag on low-end devices (292 total particles)

### Target Performance:
- All animations: 60fps on mid-range devices
- Particle systems: < 100 particles for better performance
- Animation duration: < 2 seconds for non-blocking animations
