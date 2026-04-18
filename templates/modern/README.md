# My App

Built with [VorzelaJs](https://github.com/vorzela/VorzelaJS) - a production-ready SolidJS framework.

## Getting Started

```bash
npm run dev     # Start dev server
npm run build   # Build for production
npm run serve   # Serve production build
```

## Project Structure

```
src/
├── routes/         # File-based routes
│   ├── __root.tsx  # Root layout
│   ├── index.tsx   # Home page (/)
│   └── about.tsx   # About page (/about)
├── components/     # Reusable components
└── styles.css      # Global styles
```

## What You Get

- **Navigation Resilience** - Automatic cancellation and race condition prevention
- **Persistent State** - Parent layouts preserve state across child navigations  
- **Security Headers** - CSP with nonces, XSS protection, CORS protection
- **Performance** - Prefetch on hover, View Transitions API, optimized bundles
- **Zero Config** - No vite.config or server setup required

## Learn More

- [VorzelaJs Documentation](https://github.com/vorzela/VorzelaJS#readme)
- [Production Features Guide](https://github.com/vorzela/VorzelaJS/blob/main/docs/production-features.md)
- [SolidJS](https://www.solidjs.com/)
