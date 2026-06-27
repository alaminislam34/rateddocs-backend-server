Here's a comprehensive prompt for Antigravity to implement better-auth best practices:

---

````markdown
# Authentication & Session Management Best Practices for better-auth

You are working on a project that uses `better-auth` as the primary authentication library. Follow these **MANDATORY** rules for all authentication-related operations:

## 🚫 CRITICAL: What NOT to Do

### NEVER manually create sessions:

```typescript
// ❌ WRONG - DO NOT DO THIS
const authCtx = await auth.$context;
const session = await authCtx.internalAdapter.createSession(userId);
```
````

### NEVER manually set session cookies:

```typescript
// ❌ WRONG - DO NOT DO THIS
tokenUtils.setBetterAuthSessionTokenCookie(res, session.token);
res.cookie('better-auth.session_token', token, { ... });
```

### NEVER manually create JWT tokens for session management:

```typescript
// ❌ WRONG - DO NOT DO THIS
const accessToken = jwt.sign(payload, secret);
const refreshToken = jwt.sign(payload, secret);
```

### NEVER intercept better-auth callback routes:

```typescript
// ❌ WRONG - DO NOT DO THIS
app.get('/api/auth/callback/google', (req, res) => {
  // Custom logic here
});
```

---

## ✅ CORRECT: Use better-auth Built-in APIs

### 1. Email/Password Authentication

```typescript
// ✅ CORRECT: Sign up
const result = await auth.api.signUpEmail({
  body: { email, password, name },
  headers: getAuthHeaders(req),
});

// ✅ CORRECT: Sign in
const result = await auth.api.signInEmail({
  body: { email, password },
  headers: getAuthHeaders(req),
});
```

### 2. Email Verification with OTP

```typescript
// ✅ CORRECT: Verify email OTP
const result = await auth.api.verifyEmailOTP({
  request: buildAuthRequest(req, { email, otp }),
  headers: getAuthHeaders(req),
  method: 'POST',
  path: '/email-otp/verify-email',
  body: { email, otp },
});

// better-auth automatically:
// - Verifies the OTP
// - Creates a session
// - Sets the session cookie
// - Returns user data
```

### 3. Social/OAuth Authentication

```typescript
// ✅ CORRECT: Initiate social login
const result = await auth.api.signInSocial({
  body: { provider: 'google', callbackURL: '/dashboard' },
  headers: getAuthHeaders(req),
});

// ✅ CORRECT: Let better-auth handle callbacks
// DO NOT create custom callback routes
```

### 4. Session Management

```typescript
// ✅ CORRECT: Get current session
const session = await auth.api.getSession({
  headers: getAuthHeaders(req),
});

// ✅ CORRECT: Sign out
await auth.api.signOut({
  headers: getAuthHeaders(req),
});
```

---

## 📋 Implementation Pattern

When implementing authentication flows with custom business logic:

```typescript
// ✅ CORRECT PATTERN: Combine better-auth with custom logic
const registerUser = async (data: RegisterData, req: ExpressRequest) => {
  // Step 1: Use better-auth for authentication
  const authResult = await auth.api.signUpEmail({
    body: data,
    headers: getAuthHeaders(req),
  });

  // Step 2: Perform custom business logic
  if (data.role === 'PATIENT') {
    await prisma.patient.create({
      data: { userId: authResult.user.id },
    });
  }

  await sendWelcomeEmail(data.email, data.name);

  // Step 3: Return better-auth result (contains session info)
  return authResult;
};
```

---

## 🔧 Helper Functions Required

Ensure these helper functions exist in your project:

```typescript
// utils/auth-helpers.ts
import { Request as ExpressRequest } from 'express';

export const buildAuthRequest = (req: ExpressRequest, body: any) => {
  return {
    url: req.url,
    method: req.method,
    headers: req.headers,
    body: body,
  };
};

export const getAuthHeaders = (req: ExpressRequest) => {
  return new Headers(req.headers as Record<string, string>);
};
```

---

## 🎯 Key Principles

1. **Trust better-auth**: It handles session creation, cookie management, and security automatically
2. **Use built-in APIs**: Always use `auth.api.*` methods instead of internal adapters
3. **No manual cookies**: Never set `better-auth.session_token` or similar cookies manually
4. **Return auth results**: Always return the result from better-auth API calls
5. **Add custom logic after**: Perform your business logic after calling better-auth APIs

---

## 🔄 Migration Checklist

When updating existing authentication code:

- [ ] Remove all `authCtx.internalAdapter.createSession()` calls
- [ ] Remove all manual cookie setting (`tokenUtils.setBetterAuthSessionTokenCookie()`)
- [ ] Remove manual JWT token creation for sessions
- [ ] Replace with appropriate `auth.api.*` methods
- [ ] Ensure `req` is passed to service functions that need better-auth
- [ ] Verify no custom callback routes exist for OAuth
- [ ] Test that session cookies are being set correctly in browser DevTools

---

## 📝 Example: Complete Email Verification Flow

```typescript
// Service
const verifyEmailOtp = async (email: string, otp: string, req: ExpressRequest) => {
  // Use better-auth built-in API
  const result = await auth.api.verifyEmailOTP({
    request: buildAuthRequest(req, { email, otp }),
    headers: getAuthHeaders(req),
    method: 'POST',
    path: '/email-otp/verify-email',
    body: { email, otp },
  });

  // Custom business logic
  const user = await prisma.user.findUnique({ where: { email } });

  if (user?.role === 'PATIENT') {
    await prisma.patient.create({
      data: { userId: user.id },
    });
  }

  await sendWelcomeEmail(email, user?.name || email);

  // Return better-auth result
  return result;
};

// Controller
const verifyEmailOtpController = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  // Pass req to service
  const result = await AuthService.verifyEmailOtp(email, otp, req);

  // DO NOT manually set cookies
  // better-auth already set them in the response

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Email verified successfully',
    data: result,
  });
});
```

---

## ⚠️ Common Mistakes to Avoid

1. ❌ Using `auth.$context` to access internal adapters
2. ❌ Manually creating sessions with `createSession()`
3. ❌ Setting cookies with `res.cookie()` for session tokens
4. ❌ Creating custom JWT tokens for authentication
5. ❌ Intercepting OAuth callback routes
6. ❌ Not passing `req` to service functions
7. ❌ Trying to manually handle session refresh

---

## ✅ Success Criteria

Your authentication implementation is correct when:

- ✅ You use `auth.api.*` methods for all auth operations
- ✅ No manual session creation code exists
- ✅ No manual cookie setting for session tokens
- ✅ Session cookies are automatically set by better-auth
- ✅ Custom business logic runs after better-auth API calls
- ✅ The `req` object is passed to service functions that need it

Follow these practices strictly to ensure secure, maintainable, and bug-free authentication.

```

---

এই প্রম্পটটি আপনার `agent.md` ফাইলে যোগ করুন অথবা আলাদা ফাইল হিসেবে রাখুন। Antigravity এখন থেকে better-auth এর সঠিক best practice অনুসরণ করবে এবং আপনার previous project এর মতো clean code লিখবে!
```
