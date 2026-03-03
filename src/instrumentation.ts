// Next.js instrumentation hook — runs once on server startup.
// We use it to run DB migrations + seed before the first request is served.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrate } = await import("@/lib/db");
    await migrate();
  }
}
