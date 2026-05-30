export async function fetchWithRetry(url: string, options?: RequestInit, retries = 3): Promise<Response> {
  const fetchOptions = options || {};
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, fetchOptions);
      if (res.status !== 503) {
        return res;
      }
      // Wait with exponential backoff: 1s, 2s, 4s...
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    } catch (err) {
      // If network/other transient error and we have retries left, continue
      if (i === retries - 1) {
        throw err;
      }
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('Service unavailable after retries');
}
