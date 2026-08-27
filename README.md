# sniply

A live booking marketplace for barbers and stylists, running at [sniply.biz](https://sniply.biz). Customers find a pro by map and specialty and book a slot; pros run their services, hours, and calendar from a dashboard.

![sniply home](docs/screenshots/home.png)

| Browse | A pro's profile |
|---|---|
| ![Browse professionals](docs/screenshots/browse.png) | ![Professional profile](docs/screenshots/profile.png) |

## How it works

- Next.js 16 monolith: pages and API routes live under `app/`, and typed query helpers wrap the `pg` driver so every DB call is typed end to end.
- Booking runs the conflict check and insert in one transaction behind `pg_advisory_xact_lock`, keyed on barber and date. `FOR UPDATE` alone can't lock an empty slot, so without it two customers racing the same time would both pass the check.
- Sessions are HMAC-SHA256 signed tokens verified with `crypto.timingSafeEqual`. Role checks split customer and pro endpoints.
- Discovery filters pros on a Leaflet map by hair type, specialty, and availability.
- The server migrates and seeds its own Postgres on boot, so a fresh database needs no setup.
- 234 tests: 180 Vitest unit and API tests, 54 Playwright end-to-end flows over auth, booking, messaging, and settings.

## Run it

```bash
pnpm install
echo 'DATABASE_URL=postgres://...' > .env.local
pnpm dev
```
