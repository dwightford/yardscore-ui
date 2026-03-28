# YardScore UI

Frontend for the YardScore product — what users see and interact with.

## Structure

```
web/        — Next.js PWA (desktop + mobile browser)
native/     — React Native or Capacitor (future)
shared/     — Cross-platform components (future)
```

## Role

MCP client. This repo renders the YardScore experience. It talks to `yardscore-ops` for backend services and reads from `yardscore` for product context.

## Does NOT Contain

- Product specs, strategy, or research → `yardscore`
- FastAPI backend, scoring workers, or data pipelines → `yardscore-ops`
- Infrastructure or Docker configs → `drewhenry-infra`

## Related Repos

| Repo | Role |
| ---- | ---- |
| `yardscore` | Product knowledge (knows) |
| `yardscore-ops` | Backend + workers (does) |
| `yardscore-ui` (this) | Frontend (shows) |
| `drewhenry-infra` | Infrastructure |
