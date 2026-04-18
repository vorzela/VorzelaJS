# Production Features

VorzelaJs includes critical production features to ensure reliability, performance, and safety in real-world applications.

## Navigation Resilience

### Cancellation and Ordering Guards

**Problem**: Multiple simultaneous navigations (rapid clicks, back/forward, redirects) could cause race conditions where older responses overwrite newer ones, leading to incorrect UI state.

**Solution**: VorzelaJs implements:

1. **AbortController Integration**: Each navigation receives an AbortController that cancels the fetch when superseded
2. **Latest-Wins Token System**: Sequential token tracking ensures only the most recent navigation commits
3. **Automatic Cleanup**: In-flight navigations are automatically aborted when new ones start

```tsx
// This is handled automatically by the router
<Link to="/page1">Page 1</Link>  // Click
<Link to="/page2">Page 2</Link>  // Quick click - cancels page1 fetch
```

**Benefits**:
- No stale navigation responses
- Clean handling of rapid user interactions
- Proper back/forward button behavior

---

## Persistent Client State

### Stable Island Preservation

**Problem**: Traditional payload navigation replaces the entire app HTML, destroying all client-side component state including signals, form data, WebSocket connections, and subscription lifecycles.

**Solution**: VorzelaJs now implements intelligent island diffing:

1. **Match Comparison**: Compares previous and next route matches
2. **Selective Disposal**: Only unmounts islands that changed
3. **Parent Preservation**: Keeps stable parent layout islands mounted across navigations
4. **Partial HTML Updates**: Only replaces HTML for changed route segments

```tsx
// Example: Parent layout state persists across child navigations
export const Route = createRootRoute({
  component: () => {
    const [theme, setTheme] = createSignal('dark')  // ✅ Survives child navigation
    return (
      <div data-theme={theme()}>
        <nav>...</nav>
        <Outlet />  {/* Child routes change, parent signal persists */}
      </div>
    )
  }
})
```

**Benefits**:
- Layout-level WebSocket connections stay alive
- Parent state (themes, auth, global UI) persists
- Form data in parent components survives child navigation
- Better performance from fewer remounts

**Migration**: If you relied on full remounting for cleanup, use `afterLoad` or route-level effects:

```tsx
export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
  afterLoad: () => {
    // Explicit cleanup/initialization per navigation
  }
})
```

---

## Configurable Content Security Policy

### WebSocket and External Resource Support

**Problem**: Default CSP blocks WebSocket connections and external APIs, breaking real-time features in production.

**Solution**: Configure CSP directives in your server setup:

```typescript
// server.ts - Static CSP configuration
import { createVorzelaApp } from 'vorzelajs/server'

const app = createVorzelaApp({
  assets,
  isProd: true,
  loadEntry,
  csp: {
    connectSrc: [
      'wss://your-websocket-server.com',
      'https://api.example.com'
    ],
    scriptSrc: [
      'https://cdn.example.com'
    ],
    styleSrc: [
      'https://fonts.googleapis.com'
    ]
  }
})

// OR per-request dynamic CSP
const app = createVorzelaApp({
  assets,
  isProd: true,
  loadEntry,
  csp: (request) => ({
    connectSrc: [
      'wss://your-websocket-server.com',
      'https://api.example.com'
    ]
  })
})
```

**Defaults**:
- Production: `connect-src 'self'` (strict)
- Development: `connect-src 'self' ws: wss:` (permissive for HMR)

**Real-World Example**:

```typescript
// Production config for chat app with analytics
csp: {
  connectSrc: [
    'wss://chat.myapp.com',
    'https://api.myapp.com',
    'https://analytics.myapp.com'
  ]
}
```

**Security Notes**:
- Be specific with domains - avoid wildcards
- CSP violations appear in browser console
- Test WebSocket connections in production-like environments
- Use nonce-based script-src for inline scripts (automatic)

### Per-Request CSP Configuration

**Advanced**: CSP can be computed per-request for dynamic security policies:

```typescript
// server.ts
const app = createVorzelaApp({
  assets,
  isProd: true,
  loadEntry,
  csp: (request) => {
    // Example: Different CSP for authenticated users
    const sessionCookie = request.headers.get('cookie')
    const isAuthenticated = sessionCookie?.includes('session=')
    
    return {
      connectSrc: isAuthenticated
        ? ['wss://secure-api.example.com', 'https://api.example.com']
        : ['https://api.example.com']
    }
  }
})
```

**Use Cases**:
- Tenant-specific API domains in multi-tenant systems
- Stricter policies for unauthenticated users
- Feature flags that enable/disable external services
- Geographic restrictions on external resources

---

## Prefetch on Hover

### Automatic Link Prefetching

**Feature**: VorzelaJs automatically prefetches links on hover, dramatically reducing perceived navigation time.

**How It Works**:
1. Mouse hovers over a link
2. Router prefetches the route JSON payload
3. When clicked, navigation is instant (uses cached data)
4. Cache TTL: 30 seconds, max 24 entries

**Opt-Out**:
```tsx
<Link to="/heavy-page" data-vrz-no-prefetch>
  Don't prefetch this
</Link>
```

**Benefits**:
- Sub-100ms navigation for prefetched routes
- Zero configuration required
- Smart: ignores external links, download links, `target="_blank"`
- Efficient: automatic cache eviction

**Performance**:
- Prefetch bandwidth: ~5-50KB per route (JSON payload only)
- Cache memory: ~120-1200KB max (24 routes × 5-50KB)
- No duplicate requests: checks cache before prefetch

---

## View Transitions API

### Smooth Navigation Animations

**Feature**: Automatic integration with browser's View Transitions API for smooth, animated route changes.

**Browser Support**: Chrome 111+, Edge 111+, Safari 18.2+

**Example**:
```css
/* Add custom transitions in your CSS */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 200ms;
}

::view-transition-old(root) {
  animation-name: fade-out;
}

::view-transition-new(root) {
  animation-name: fade-in;
}

@keyframes fade-out {
  to { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
}
```

**Fallback**: Automatic graceful degradation on unsupported browsers (instant navigation)

**Disable for Specific Navigations**:
View transitions are skipped for force navigations (redirects, error retries).

---

## Redirect Chain Protection

### Maximum Depth Enforcement

**Problem**: Infinite or deep redirect chains can hang the application and waste resources.

**Solution**: VorzelaJs enforces a maximum redirect depth of 10 with clear error messages:

```typescript
// This will throw after 10 redirects
export const Route = createFileRoute('/infinite')({
  beforeLoad: () => {
    throw redirect({ to: '/infinite' })
  }
})

// Error: "Redirect chain exceeded maximum depth of 10. Last redirect to: /infinite"
```

**Benefits**:
- Fast failure instead of hanging
- Clear error messages for debugging
- Prevents accidental infinite loops

---

## Financial Applications Assessment

### Production-Readiness for Banking & Finance

VorzelaJs provides a **solid foundation** for financial applications, but requires additional security layers for full compliance.

#### ✅ What's Built-In

| Security Feature | Status | Implementation |
|------------------|--------|----------------|
| **CSP Headers** | ✅ Production-grade | Nonce-based scripts, configurable per-request |
| **XSS Protection** | ✅ Strong | X-Content-Type-Options, X-Frame-Options, strict CSP |
| **Navigation Security** | ✅ Robust | Cancellation, ordering guards, no race conditions |
| **State Management** | ✅ Stable | Persistent islands prevent data loss during navigation |
| **HTTPS Enforcement** | ✅ Ready | HSTS headers, secure-only cookies (app-level) |
| **CORS Protection** | ✅ Built-in | Cross-Origin-Opener-Policy, CORP headers |

#### ⚠️ What You Must Add

Financial apps require additional security measures that must be implemented at the application level:

1. **CSRF Protection**
   ```typescript
   // Required for all state-changing operations
   import { csrf } from 'your-csrf-library'
   
   app.use('*', csrf({ cookie: { secure: true, sameSite: 'strict' } }))
   ```

2. **Rate Limiting**
   ```typescript
   // Prevent brute force attacks on login/transfer endpoints
   import { rateLimiter } from 'your-rate-limiter'
   
   app.use('/api/auth/*', rateLimiter({ max: 5, window: '15m' }))
   app.use('/api/transfer/*', rateLimiter({ max: 3, window: '1h' }))
   ```

3. **Audit Logging**
   ```typescript
   // Log all sensitive operations for compliance (PCI-DSS, SOC2)
   app.use('*', auditLogger({
     logEvents: ['login', 'transfer', 'profile_update'],
     includeIP: true,
     includePath: true
   }))
   ```

4. **Session Management**
   ```typescript
   // Secure session handling with expiration
   import { session } from 'your-session-library'
   
   app.use('*', session({
     secret: process.env.SESSION_SECRET,
     cookie: { 
       secure: true,
       httpOnly: true,
       sameSite: 'strict',
       maxAge: 15 * 60 * 1000  // 15 minutes
     },
     rolling: true  // Extend on activity
   }))
   ```

5. **Input Validation & Sanitization**
   ```typescript
   // Validate all inputs server-side
   import { z } from 'zod'
   
   const TransferSchema = z.object({
     amount: z.number().positive().max(1000000),
     toAccount: z.string().regex(/^\d{10}$/),
     memo: z.string().max(100).trim()
   })
   ```

6. **Encryption for Sensitive Data**
   ```typescript
   // Encrypt PII at rest
   import { encrypt, decrypt } from 'your-crypto-library'
   
   const sensitiveData = {
     ssn: encrypt(user.ssn, process.env.ENCRYPTION_KEY),
     accountNumber: encrypt(user.accountNumber, process.env.ENCRYPTION_KEY)
   }
   ```
---

## Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Navigation cancellation | ✅ Implemented | AbortController + token system |
| Latest-wins semantics | ✅ Implemented | Sequential navigation tokens |
| Stable island preservation | ✅ Implemented | Match-based diffing |
| Partial HTML updates | ✅ Implemented | Only replaces changed segments |
| Configurable CSP | ✅ Implemented | Per-directive + per-request configuration |
| WebSocket support | ✅ Production-ready | Via CSP connect-src |
| Prefetch on hover | ✅ Implemented | Automatic link prefetching |
| View Transitions API | ✅ Implemented | Smooth navigation transitions |
| Redirect chain protection | ✅ Implemented | Max depth 10 with error handling |
| Out-of-order streaming | ⏳ Planned | Suspense boundary streaming |
| Single-flight mutations | ⏳ Planned | Request deduplication |
| Nested component islands | ⏳ Planned | Arbitrary component-level hydration |

---

## Testing Recommendations

### Navigation Resilience
```typescript
// Test rapid navigation
test('handles rapid route changes', async () => {
  await router.navigate('/page1')
  await router.navigate('/page2')  // Should cancel page1
  await router.navigate('/page3')  // Should cancel page2
  expect(router.state().pathname).toBe('/page3')
})

// Test back/forward
test('handles browser back/forward', async () => {
  await router.navigate('/page1')
  await router.navigate('/page2')
  history.back()
  // Popstate should not race with in-flight navigation
})
```

### Persistent State
```typescript
// Test parent state preservation
test('preserves parent signals across child navigation', async () => {
  const parentSignal = getParentSignal()
  await router.navigate('/child1')
  const value1 = parentSignal()
  await router.navigate('/child2')
  const value2 = parentSignal()
  expect(value2).toBe(value1)  // Parent state unchanged
})
```

### WebSocket Connections
```typescript
// Test WebSocket survival in layouts
test('websocket persists in parent layout', async () => {
  const ws = getLayoutWebSocket()
  expect(ws.readyState).toBe(WebSocket.OPEN)
  await router.navigate('/child-route')
  expect(ws.readyState).toBe(WebSocket.OPEN)  // Still open
})
```

---

## Migration Guide

### From Pre-0.1.0

**Navigation Race Conditions**: No code changes needed - automatic.

**Island State Loss**: If you want parent state to persist:
1. Move stable state to parent/root routes
2. Use layout routes (`_auth.tsx`) for shared state
3. Module-level stores still work as before

**WebSocket Setup**: If you have WebSockets:
```diff
// server.ts
- createVorzelaApp({ assets, isProd, loadEntry })
+ createVorzelaApp({
+   assets,
+   isProd,
+   loadEntry,
+   csp: {
+     connectSrc: ['wss://your-socket-server.com']
+   }
+ })
```

---

## Performance Characteristics

- **Navigation cancellation**: ~0ms overhead (AbortController is native)
- **Island diffing**: O(n) where n = number of matches (typically < 5)
- **Selective disposal**: Faster than full remount for nested layouts
- **Memory**: Stable - no leaks from cancelled navigations

---

## Known Limitations

1. **Island granularity**: Preserves route-level islands, not arbitrary nested components (requires component-level hydration markers)
2. **State initialization**: Components that rely on `onMount` for init should use `afterLoad` route lifecycle
3. ~~**CSP configuration**: Static at server startup, not per-request~~ ✅ **FIXED** - Now supports per-request CSP via function
4. ~~**Redirect chains**: Deep redirect chains (>10) still create multiple navigations~~ ✅ **FIXED** - Max depth enforced with clear error messages

---

## Future Enhancements

- **Out-of-order Streaming**: Suspense boundaries that stream HTML chunks as they resolve (requires streaming architecture redesign)
- **Single-flight Mutations**: Automatic deduplication of identical in-flight mutations (requires mutation tracking system)
- ~~**View Transitions API**: Smooth visual transitions between routes~~ ✅ **IMPLEMENTED**
- ~~**Prefetch on Hover**: Automatic background prefetching on link hover~~ ✅ **IMPLEMENTED**
- **Nested Component Islands**: Arbitrary component-level hydration instead of route-level only (requires hydration marker architecture)
