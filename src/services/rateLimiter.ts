// Simple rate limiter for up to 5 requests per second (globally)
// Usage: await rateLimit();

const MIN_INTERVAL_MS = 200; // 5 per second = 200ms between requests
let lastRequestTime = 0;

export async function rateLimit() {
    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestTime));
    if (wait > 0) {
        await new Promise(res => setTimeout(res, wait));
    }
    lastRequestTime = Date.now();
}
