# Cookies and Sessions Guide

This guide documents VorzelaJs cookie helpers, cookie policies, and cookie-backed session storage.

Import cookie and session helpers from `~/router/server`.

## Cookie Helpers

The main helpers are:

- `createCookie()`
- `cookiePolicies.host()`
- `cookiePolicies.crossSite()`
- `cookiePolicies.partitioned()`
- `setCookie()`
- `deleteCookie()`
- `createCookieSessionStorage()`

## `createCookie`

`createCookie(name, options)` creates a cookie helper with:

- `parse(cookieHeader)`
- `serialize(value)`
- `destroy()`
- `name`
- `options`

Example:

```tsx
import { createCookie, cookiePolicies } from '~/router/server'

const sessionCookie = createCookie('__Host-session', {
  maxAge: 60 * 60 * 24 * 7,
  secrets: ['replace-me'],
})

const crossSiteCookie = createCookie('api-session', cookiePolicies.crossSite({
  httpOnly: true,
}))

const embeddedCookie = createCookie('__Host-widget', cookiePolicies.partitioned({
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 30,
}))
```

## Normalization Rules

The cookie layer applies several automatic safety rules.

Current behavior:

- `SameSite=None` automatically upgrades to `Secure`
- `policy: 'cross-site'` sets `SameSite=None; Secure`
- `policy: 'partitioned'` sets `Partitioned; SameSite=None; Secure`
- `partitioned: true` also forces `Secure`
- `domain` values have leading dots removed

## Prefix-Aware Security Rules

Cookie name prefixes also enforce behavior:

- `__Secure-` forces `Secure`
- `__Host-` forces `Secure`, forces `Path=/`, and rejects `Domain`
- `__Http-` forces `HttpOnly`
- `__Host-Http-` combines the `__Host-` and `__Http-` restrictions

These rules make it harder to accidentally publish a cookie with weaker attributes than the prefix implies.

## Signing Behavior

If you provide `secrets`, VorzelaJs signs the cookie value and verifies that signature during `parse()`.

Important limitation:

- signing protects integrity
- signing does not encrypt the cookie payload

So a signed cookie can be trusted against tampering, but its contents are still visible to the browser and the user.

## Writing and Deleting Cookies

Use `setCookie()` and `deleteCookie()` with either:

- a route `response` stub from `beforeLoad` or `loader`
- a raw `Headers` object

Example from a route loader:

```tsx
import { createFileRoute } from '~/router'
import { createCookie, setCookie } from '~/router/server'

const sessionCookie = createCookie('__Host-session', {
  secrets: ['replace-me'],
})

export const Route = createFileRoute('/login')({
  loader: async ({ response }) => {
    await setCookie(response, sessionCookie, 'signed-session-value')
    return null
  },
  component: LoginPage,
})
```

Current runtime behavior:

- `response.headers` is forwarded through streamed document responses
- `response.headers` is also forwarded through payload responses for client navigation

That means route-level `Set-Cookie` headers work for both first load and later same-origin transitions.

## Cookie Policies

`cookiePolicies` packages common deployment modes.

### `cookiePolicies.host()`

Use for first-party host cookies with the strongest default scope.

### `cookiePolicies.crossSite()`

Use when cookies must travel across cross-site requests and you want the right `SameSite=None; Secure` bundle.

### `cookiePolicies.partitioned()`

Use for CHIPS-style isolated third-party state.

Important limitation:

- `Partitioned` is not a replacement for normal same-site subdomain cookies
- it does not remove the need for `credentials: 'include'`
- it does not remove the need for correct CORS on cross-origin requests

## Cookie-Backed Sessions

`createCookieSessionStorage()` creates a small session layer on top of cookies.

Example:

```tsx
import { createCookieSessionStorage } from '~/router/server'

const sessions = createCookieSessionStorage({
  cookie: {
    name: '__Host-session',
    maxAge: 60 * 60 * 24 * 7,
    secrets: ['replace-me'],
  },
})

const session = await sessions.getSession(request.headers.get('Cookie'))
session.set('userId', '42')
const setCookieHeader = await sessions.commitSession(session)
```

You can pass either:

- raw cookie options
- an already created `VorzelaCookie`

## Session Object Semantics

The session object supports:

- `get(key)`
- `has(key)`
- `set(key, value)`
- `unset(key)`
- `flash(key, value)`
- `data`

### Flash Values

`flash(key, value)` stores one-time data for the next read.

```tsx
session.flash('notice', 'Signed in successfully')
await sessions.commitSession(session)

const nextSession = await sessions.getSession(request.headers.get('Cookie'))
const notice = nextSession.get<string>('notice')
```

The first `get('notice')` returns the flashed value and removes it from the session.

## Commit and Destroy

`commitSession(session)` returns the serialized `Set-Cookie` header value for the current session state.

`destroySession(session)` returns an expired cookie value that clears the session cookie.

```tsx
const commitHeader = await sessions.commitSession(session)
const destroyHeader = await sessions.destroySession(session)
```

## Practical Constraints

This session storage is cookie-backed.

That means:

- session data is JSON serialized into the cookie value
- the session should stay small
- this is not a server-side session database
- secrets sign the cookie for integrity, but do not encrypt the session contents

Use it for lightweight auth or flash state. For larger or confidential session state, store only an identifier in the cookie and keep the real session data in your own backend storage.