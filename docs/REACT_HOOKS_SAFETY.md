# React Hooks Safety Guide

## 🚨 Critical Rules to Prevent "Rendered more hooks" Errors

This document outlines the critical patterns that caused production-breaking errors and how to avoid them.

## The Problem

React Hooks must be called in the **exact same order** on every render. Violating this causes:
- `"Rendered more hooks than during the previous render"`
- `"Cannot access 'X' before initialization"`
- Silent failures and crashes

## ✅ DO: Always Call Hooks at the Top Level

```typescript
// ✅ CORRECT: All hooks before any conditional returns
export default function MyComponent() {
  // 1. All hooks first
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const router = useRouter();
  
  useEffect(() => {
    // Hook logic
  }, [dependencies]);
  
  // 2. THEN conditional logic and returns
  if (isLoading) {
    return <Loading />;
  }
  
  return <Content />;
}
```

## ❌ DON'T: Call Hooks After Conditional Returns

```typescript
// ❌ WRONG: Hook called after conditional return
export default function MyComponent() {
  const { user } = useAuth();
  
  if (isLoading) {
    return <Loading />; // Early return
  }
  
  // ❌ This hook is called conditionally - BREAKS RULES OF HOOKS
  useEffect(() => {
    // This will cause "Rendered more hooks" error
  }, []);
  
  return <Content />;
}
```

## ❌ DON'T: Call Hooks Inside Conditionals

```typescript
// ❌ WRONG: Conditional hook call
export default function MyComponent() {
  const { user } = useAuth();
  
  if (user) {
    // ❌ Hook inside conditional - BREAKS RULES OF HOOKS
    useEffect(() => {
      // This causes hook count mismatch
    }, []);
  }
  
  return <Content />;
}
```

## ❌ DON'T: Use Hooks in Dependency Arrays Before Definition

```typescript
// ❌ WRONG: Using function in dependency array before it's defined
export default function MyComponent() {
  useEffect(() => {
    // Some logic
  }, [user, session, logout]); // ❌ logout not defined yet
  
  const logout = useCallback(() => {
    // logout definition
  }, []);
  
  return <Content />;
}
```

## Common Patterns That Cause Issues

### Pattern 1: Hooks After Early Returns

**Problem:**
```typescript
function Component() {
  const hook1 = useHook1();
  
  if (condition) return <EarlyReturn />;
  
  const hook2 = useHook2(); // ❌ Called conditionally
  return <Content />;
}
```

**Solution:**
```typescript
function Component() {
  const hook1 = useHook1();
  const hook2 = useHook2(); // ✅ Always called
  
  if (condition) return <EarlyReturn />;
  
  return <Content />;
}
```

### Pattern 2: Functions in Dependency Arrays Before Definition

**Problem:**
```typescript
function Component() {
  useEffect(() => {
    // Uses logout
  }, [logout]); // ❌ logout not defined yet
  
  const logout = useCallback(() => {
    // Definition
  }, []);
}
```

**Solution:**
```typescript
function Component() {
  const logout = useCallback(() => {
    // Definition first
  }, []);
  
  useEffect(() => {
    // Now logout is available
  }, [logout]); // ✅ Defined before use
}
```

## ESLint Protection

The project includes ESLint rules that catch these issues:

- `react-hooks/rules-of-hooks`: Error on hooks violations
- `react-hooks/exhaustive-deps`: Warn about missing dependencies

Run `npm run lint` before committing to catch these issues early.

## Pre-Commit Protection

A pre-commit hook runs ESLint automatically. If hooks violations are detected, the commit will be blocked.

## Testing Checklist

Before submitting code, verify:

- [ ] All hooks are called at the top level of the component
- [ ] No hooks are called after conditional returns
- [ ] No hooks are called inside conditionals, loops, or nested functions
- [ ] All functions used in dependency arrays are defined before use
- [ ] `npm run lint` passes without errors

## Real Examples from This Codebase

### Fixed: app/index.tsx

**Before (Broken):**
```typescript
export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  
  // ... other hooks ...
  
  if (isLoading) {
    return <Loading />; // Early return
  }
  
  // ❌ Hook after conditional return
  useEffect(() => {
    // Logic
  }, []);
  
  return <Redirect />;
}
```

**After (Fixed):**
```typescript
export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  
  // ... other hooks ...
  
  // ✅ All hooks before any returns
  useEffect(() => {
    // Logic
  }, []);
  
  if (isLoading) {
    return <Loading />;
  }
  
  return <Redirect />;
}
```

### Fixed: hooks/auth-context.tsx

**Before (Broken):**
```typescript
useEffect(() => {
  // Hardware audit logic
}, [user, session, logout]); // ❌ logout not defined yet

const logout = useCallback(() => {
  // Definition
}, []);
```

**After (Fixed):**
```typescript
const logout = useCallback(() => {
  // Definition first
}, []);

useEffect(() => {
  // Hardware audit logic
}, [user, session]); // ✅ Removed logout (not used in effect)
```

## Resources

- [React Hooks Rules](https://react.dev/reference/rules/rules-of-hooks)
- [ESLint React Hooks Plugin](https://www.npmjs.com/package/eslint-plugin-react-hooks)

## Summary

**Golden Rule:** Always call all hooks at the top level, before any conditional logic or early returns. This ensures hooks are called in the same order on every render.
