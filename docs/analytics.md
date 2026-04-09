# Analytics Guide

This guide documents the first-party analytics APIs currently available in VorzelaJs.

Import analytics, cookie, and session helpers from `~/router/server`. The browser-side `createAnalyticsClient()` currently lives there too.

## What the Framework Can Measure Reliably

The current analytics stack is designed for first-party attribution and traffic analysis.

It can reliably collect:

- landing URL and search params
- UTM parameters
- common ad click ids such as `gclid`, `fbclid`, `msclkid`, `ttclid`, and `li_fat_id`
- browser referrer data when the browser and the page's referrer policy allow it
- coarse browser, OS, device-type, and language information
- coarse geo information when your edge or proxy already sends country, region, or city headers

This is enough to answer questions like:

- which campaigns drive visits
- which platforms drive paid traffic
- whether traffic is organic search, paid social, email, referral, or direct
- which landing pages are performing

It does not give perfect attribution for every ad platform or user journey.

For example, VorzelaJs cannot magically recover:

- referrer data stripped by browser privacy rules or referrer policy
- ad-network conversion data hidden behind platform-specific APIs
- accurate geolocation without a proxy or backend that already resolves it

## Research-Backed Cookie Rules

Modern browser behavior matters here.

### Same-Site Subdomains

If your frontend is on something like `app.example.com` and your backend API is on `api.example.com`, that is usually a same-site relationship.

In that setup, normal cookies can work with:

- a correct `Domain` strategy if you want sharing across subdomains
- `credentials: 'include'` on cross-origin fetch requests
- correct CORS response headers from the backend API

You do not usually need `Partitioned` just for same-site subdomains.

### Cross-Site Cookies

If your frontend and backend live on different sites, cookies sent across those requests need `SameSite=None; Secure`.

VorzelaJs now supports this through `cookiePolicies.crossSite(...)` and automatic `Secure` normalization.

### Partitioned Cookies

`Partitioned` cookies are mainly for isolated third-party state, also known as CHIPS.

Use them when the same backend or widget is embedded or contacted across different top-level sites and you want cookie state isolated per top-level site.

VorzelaJs now supports this through `cookiePolicies.partitioned(...)` and automatic `Partitioned` serialization.

Important limitation:

- `Partitioned` is not a substitute for `SameSite=None`
- it does not remove the need for `credentials: 'include'`
- it does not make browsers accept cross-origin cookies without proper CORS

## Built-In Analytics Endpoint

When `src/entry-server.tsx` exports an `analytics` definition, the built-in server runtime exposes:

```text
OPTIONS /__vorzela/analytics
POST /__vorzela/analytics
```

Example:

```tsx
import { defineAnalytics } from '~/router/server'

export const analytics = defineAnalytics({
  allowedOrigins: ['https://app.example.com'],
  onEvent: async (event) => {
    console.log(event.attribution.channel, event.attribution.platform)
  },
})
```

The built-in collector:

- parses browser payloads
- classifies attribution from UTM params, click ids, and referrer data
- can set a first-party visitor cookie
- returns `204` when the event is accepted

## Collector Configuration

`defineAnalytics()` accepts:

- `allowedOrigins?: string[] | ((origin, request) => boolean)`
- `onEvent?: (event, { payload, request }) => void | Promise<void>`
- `visitorCookie?: false | { name?: string; options?: CookieOptions }`

Current defaults and behavior:

- if `allowedOrigins` is omitted, requests are accepted without origin filtering
- when an origin is allowed, the collector writes CORS headers and `Vary: Origin`
- the default visitor cookie is `__Host-vrz_aid` with a 90-day max age
- set `visitorCookie: false` to disable the collector-managed visitor cookie entirely
- set `visitorCookie.name` or `visitorCookie.options` when you need a different cookie policy

The collector only accepts JSON object payloads. Empty bodies are treated as `{}`.

## Browser Client

Use `createAnalyticsClient()` from application code:

```tsx
import { createAnalyticsClient } from '~/router/server'

const analytics = createAnalyticsClient()

analytics.startAutoPageviews()
void analytics.event('pricing_cta_clicked', {
  plan: 'pro',
})
```

Default behavior:

- endpoint: `/__vorzela/analytics`
- transport: `sendBeacon()` when possible, otherwise `fetch(..., { keepalive: true })`
- visitor id: persisted in local storage when available
- session id: persisted in session storage when available
- attribution memory: first-touch and last-touch snapshots stored in local storage

## Browser Client Methods

The analytics client exposes:

- `analytics.event(name, properties?, payload?)`
- `analytics.pageview(payload?)`
- `analytics.track(payload)`
- `analytics.startAutoPageviews({ trackInitialPageview? })`

`event()` is the ergonomic default for named events. `pageview()` forces `type: 'pageview'`. `track()` lets you send the full payload shape directly.

```tsx
const analytics = createAnalyticsClient()

void analytics.pageview()
void analytics.event('signup_clicked', { plan: 'pro' })
void analytics.track({
  name: 'checkout_started',
  properties: { step: 1 },
  type: 'event',
})
```

`startAutoPageviews()` patches `history.pushState()` and `history.replaceState()`, listens to `popstate`, and returns a cleanup function.

```tsx
const stopAutoPageviews = analytics.startAutoPageviews({
  trackInitialPageview: false,
})

stopAutoPageviews()
```

## Browser Client Options

`createAnalyticsClient(options)` supports:

- `endpoint`
- `transport: 'auto' | 'beacon' | 'fetch'`
- `credentials`
- `includeLanguage`
- `includeScreen`
- `includeTimezone`
- `storageKey`
- `sessionKey`
- `firstTouchKey`
- `lastTouchKey`

Behavior notes:

- `transport: 'auto'` prefers `sendBeacon()` only for same-origin endpoints without `credentials: 'include'`
- otherwise the client falls back to `fetch(..., { keepalive: true })`
- `storageKey` and `sessionKey` let you isolate analytics state across apps on the same origin
- `firstTouchKey` and `lastTouchKey` control where attribution snapshots are stored

## Traffic Classification

The current classifier maps landings into these high-level channels:

- `direct`
- `email`
- `internal`
- `organic-search`
- `organic-social`
- `paid-search`
- `paid-social`
- `referral`
- `unknown`

Classification uses:

- UTM parameters
- known click IDs such as `dclid`, `epik`, `fbclid`, `gclid`, `li_fat_id`, `msclkid`, `ttclid`, `twclid`, and `wbraid`
- known search and social referrer host patterns

`internal` means the landing referrer host matches the current site host.

## Helper Exports

The server barrel also exports two lower-level analytics helpers:

### `DEFAULT_ANALYTICS_ENDPOINT`

```tsx
import { DEFAULT_ANALYTICS_ENDPOINT } from '~/router/server'

console.log(DEFAULT_ANALYTICS_ENDPOINT)
// '/__vorzela/analytics'
```

### `extractAnalyticsTouchPoint`

```tsx
import { extractAnalyticsTouchPoint } from '~/router/server'

const touchPoint = extractAnalyticsTouchPoint(
  'https://app.example.com/pricing?utm_source=google&utm_medium=cpc&utm_campaign=spring',
  'https://www.google.com/search?q=vorzela',
)
```

Use it when you want the normalized attribution structure without building a full analytics event.

## Event Shape

Normalized events contain these high-value fields:

- `type`
- `name`
- `visitorId`
- `sessionId`
- `page`
- `attribution`
- `firstTouch`
- `lastTouch`
- `userAgent`
- `geo`
- `properties`

Important attribution fields:

- `attribution.channel`
- `attribution.platform`
- `attribution.source`
- `attribution.medium`
- `attribution.campaign`
- `attribution.clickIds`

Other high-value nested fields currently included:

- `client.language`
- `client.screen`
- `client.timezone`
- `page.pathname`, `page.search`, `page.title`, `page.url`, `page.referrer`
- `request.host`, `request.origin`, `request.referer`, `request.secFetchSite`
- `geo.country`, `geo.region`, `geo.city`
- `userAgent.browser`, `userAgent.browserVersion`, `userAgent.os`, `userAgent.deviceType`, `userAgent.isBot`

These are the fields you would normally aggregate to answer:

- which channels bring the most traffic
- which paid platforms are appearing in acquisition
- which campaigns and landing pages deserve more budget

## External Backend APIs

If your analytics collector lives in a separate backend API, you can reuse the same parsing logic there:

```tsx
import { handleAnalyticsRequest } from '~/router/server'

export async function analyticsRoute(request: Request) {
  return handleAnalyticsRequest(request, {
    allowedOrigins: ['https://app.example.com'],
    onEvent: async (event) => {
      await writeToDatabase(event)
    },
  })
}
```

This lets your standalone API and the built-in VorzelaJs server use the same attribution model.

The normalized event passed to `onEvent` also includes the original `payload` and raw `request` through the second callback argument.

## Practical Recommendation

For most apps, the best default stack is:

1. use UTM parameters on every campaign link
2. keep referrer policy at `strict-origin-when-cross-origin` or similarly useful defaults
3. collect first-party pageviews and events with `createAnalyticsClient()`
4. aggregate by `channel`, `platform`, `campaign`, and landing page in your backend

If you later need ad-platform conversion measurement, add those platform-specific APIs separately. VorzelaJs first-party analytics should be the base layer, not the whole attribution stack.