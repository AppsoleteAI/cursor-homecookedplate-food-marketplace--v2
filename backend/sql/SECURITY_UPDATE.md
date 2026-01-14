# Security Update - Authentication Hardening

## What Was Fixed

### 1. Privilege Escalation Vulnerability (CRITICAL)
**Before:** Users could specify their own role during signup by manipulating the client-side request.
**After:** All new users are hardcoded as 'platetaker' by the database trigger. Role changes now require a secure backend process.

### 2. Dangerous RLS Policy Removed (CRITICAL)
**Before:** The `auth.uid() is null` clause allowed unauthenticated inserts into profiles table.
**After:** Removed INSERT policy entirely. Only the SECURITY DEFINER trigger can create profiles.

### 3. Client-Side Role Selection Removed
**Before:** Signup API accepted role from client input.
**After:** Role parameter removed from signup API. All new accounts start as 'platetaker'.

## Required Database Changes

**IMPORTANT:** You MUST run these SQL scripts in your Supabase SQL Editor in this exact order:

### Step 1: Update the trigger function
```sql
-- Copy and run the entire backend/sql/auto_create_profile.sql file
```

### Step 2: Update RLS policies
```sql
-- Remove the dangerous insert policy
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;

-- Verify no insert policy exists for profiles
SELECT * FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'INSERT';
-- This should return 0 rows
```

## How to Upgrade Users to PlateMaker

Since all signups are now 'platetaker' by default, you need a secure backend process for role upgrades:

### Option A: Manual Admin Update (Recommended for now)
Run in Supabase SQL Editor:
```sql
UPDATE public.profiles 
SET role = 'platemaker' 
WHERE email = 'user@example.com';
```

### Option B: Create Secure Backend Endpoint (Future)
Create a tRPC endpoint that:
1. Verifies admin credentials or approval workflow
2. Validates user identity
3. Updates role server-side only
4. Logs the change for audit

Example structure:
```typescript
// backend/trpc/routes/admin/promote-to-platemaker/route.ts
export const promoteToPlatemakerProcedure = protectedProcedure
  .input(z.object({ userId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    // Add authorization check here
    // Update role in database using service role
  });
```

## Security Recommendations

### Database Security
✅ **Done:** Hardcoded default roles in triggers
✅ **Done:** Removed dangerous RLS policies
✅ **Done:** Added error handling in trigger function
⚠️ **TODO:** Set up database backups
⚠️ **TODO:** Enable Supabase Vault for secrets
⚠️ **TODO:** Review all RLS policies periodically

### Application Layer Security

#### 1. Cloudflare Integration (Recommended)
Cloudflare can provide:
- **DDoS Protection:** Prevent signup/login spam attacks
- **Rate Limiting:** Limit signup attempts per IP (5 signups/hour)
- **Bot Protection:** Challenge/JS validation before reaching your API
- **WAF Rules:** Block malicious requests before they hit Supabase
- **Caching:** Reduce load on your backend

**Setup Steps:**
1. Add your domain to Cloudflare
2. Enable "I'm Under Attack" mode if experiencing attacks
3. Create rate limiting rules for `/api/auth/*` endpoints
4. Enable Bot Fight Mode

#### 2. Rate Limiting (CRITICAL)
Add rate limiting to prevent abuse:

```typescript
// Add to signup/route.ts
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 h'), // 5 signups per hour
});

// In mutation handler:
const identifier = ctx.ip || 'anonymous';
const { success } = await ratelimit.limit(identifier);
if (!success) {
  throw new Error('Too many signup attempts. Please try again later.');
}
```

#### 3. Email Verification (IMPORTANT)
Enable email confirmation in Supabase:
1. Go to Authentication → Settings
2. Enable "Confirm email"
3. This prevents spam accounts

#### 4. Additional Hardening
- [ ] Add CAPTCHA to signup form (hCaptcha or reCAPTCHA)
- [ ] Implement password strength requirements
- [ ] Add 2FA for platemaker accounts
- [ ] Log all role changes for audit trail
- [ ] Monitor for suspicious activity (multiple accounts from same IP)

### Network Security (Cloudflare Alternative)
If not using Cloudflare, consider:
- **Supabase Edge Functions:** Add rate limiting at the edge
- **Vercel Rate Limiting:** If hosted on Vercel
- **AWS WAF:** If using AWS infrastructure

## Testing the Fix

### 1. Test Normal Signup
1. Try to sign up as a new user
2. Verify profile is created with role='platetaker'
3. Check database: `SELECT * FROM profiles WHERE email = 'test@example.com'`

### 2. Test Privilege Escalation (Should Fail)
Try to manipulate signup request in browser dev tools:
```javascript
// This should NOT grant platemaker role
fetch('/api/trpc/auth.signup', {
  body: JSON.stringify({ 
    role: 'platemaker' // This will be ignored
  })
})
```

### 3. Verify RLS Protection
Try direct database insert (should fail):
```sql
-- This should return permission denied
INSERT INTO public.profiles (id, email, username, role)
VALUES (gen_random_uuid(), 'hack@test.com', 'hacker', 'platemaker');
```

## Monitoring

Set up alerts for:
- Failed signup attempts (>10/minute)
- Database errors from trigger function
- Unauthorized role change attempts
- Multiple accounts from same IP

## What About Existing Users?

Existing users keep their current roles. This only affects:
1. New signups (all start as platetaker)
2. Role upgrade process (now requires secure backend)

If you need to audit existing roles:
```sql
SELECT role, COUNT(*) 
FROM public.profiles 
GROUP BY role;
```

## Questions?

- **Q: Can users still become platemakers?**
  A: Yes, but they need to be manually upgraded or through a secure approval process.

- **Q: Will Cloudflare break my app?**
  A: No, but configure it correctly. Disable "Rocket Loader" and be careful with caching on API routes.

- **Q: Is this enough security?**
  A: This fixes critical vulnerabilities. Add rate limiting and CAPTCHA for production.

- **Q: What if the trigger fails?**
  A: The signup will fail completely (no orphaned auth users). Check Supabase logs for details.
