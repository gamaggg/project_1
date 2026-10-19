// Запрос к Overpass с повторами: публичный сервер часто отвечает «at capacity» (502/504)
// или HTML вместо JSON. Ждём и пробуем снова.
export async function overpass(query, tries = 8) {
  for (let t = 1; t <= tries; t++) {
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'User-Agent': 'fishing-hex/0.1', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      });
      const text = await res.text();
      if (text.trim().startsWith('{')) return JSON.parse(text);
      console.error(`Overpass занят (${res.status}), попытка ${t}/${tries}`);
    } catch (err) {
      console.error('Overpass ошибка', err.message, `попытка ${t}/${tries}`);
    }
    await new Promise((r) => setTimeout(r, 25000));
  }
  throw new Error('Overpass не ответил');
}
