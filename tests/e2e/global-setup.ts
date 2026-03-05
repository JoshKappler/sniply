/**
 * Playwright global setup — runs once before any tests start.
 *
 * Pre-warms the /pro/dashboard page to trigger any first-hit compilation.
 * With a production build (next start), this is just a warm-up to ensure
 * the server is responsive before tests begin.
 */
export default async function globalSetup() {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

  // Hit the pro dashboard a few times to warm up the server
  for (let i = 0; i < 3; i++) {
    try {
      await fetch(`${base}/pro/dashboard`);
    } catch {
      // Server may be momentarily unavailable — that's fine
    }
    await wait(500);
  }
}
