// Open-Meteo's free API now and then answers 503/502/429 for a few seconds —
// at the top of the hour most of all, when everyone's cron jobs hit it at
// once («Завтра хороший клёв» fell on it at 19:00 on 9 and 13 Oct 2026, and
// a catch's weather on 9 Oct). Such an answer, or a dropped connection, is
// retried with growing pauses before the caller sees it.
const RETRY_DELAYS_MS = [1000, 3000, 8000]

export async function fetchOpenMeteo(url: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, init)
      const transient = res.status === 429 || res.status >= 500
      if (!transient || attempt >= RETRY_DELAYS_MS.length) return res
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length) throw err
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
  }
}
