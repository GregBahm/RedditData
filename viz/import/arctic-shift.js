(() => {
  const API_ROOT = 'https://arctic-shift.photon-reddit.com/api';
  const BATCH_SIZE = 100;
  const CONCURRENCY = 3;
  const MAX_ATTEMPTS = 5;

  const sleep = (ms, signal) => new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Import cancelled.', 'AbortError'));
    }, { once: true });
  });

  function retryDelay(response, attempt) {
    const header = response?.headers.get('Retry-After');
    if (header) {
      const seconds = Number(header);
      if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
      const date = Date.parse(header);
      if (Number.isFinite(date)) return Math.max(0, date - Date.now());
    }
    return Math.min(10000, 500 * 2 ** (attempt - 1));
  }

  async function fetchBatch(endpoint, ids, field, signal) {
    const params = new URLSearchParams({
      ids: ids.join(','),
      fields: `id,${field}`,
    });
    const url = `${API_ROOT}/${endpoint}/ids?${params}`;
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
        if (response.ok) {
          const payload = await response.json();
          return Array.isArray(payload.data) ? payload.data : [];
        }
        if (response.status !== 429 && response.status < 500) {
          throw new Error(`Arctic Shift returned HTTP ${response.status}.`);
        }
        lastError = new Error(`Arctic Shift returned HTTP ${response.status}.`);
        await sleep(retryDelay(response, attempt), signal);
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        lastError = error;
        if (attempt < MAX_ATTEMPTS) await sleep(retryDelay(null, attempt), signal);
      }
    }
    throw new Error(`Arctic Shift could not be reached after ${MAX_ATTEMPTS} attempts. ${lastError?.message || ''}`.trim());
  }

  function batches(values) {
    const result = [];
    for (let i = 0; i < values.length; i += BATCH_SIZE) result.push(values.slice(i, i + BATCH_SIZE));
    return result;
  }

  async function fetchMap(endpoint, ids, field, stage, onProgress, signal) {
    const unique = [...new Set(ids.filter(Boolean))];
    const work = batches(unique);
    const map = new Map();
    let next = 0;
    let complete = 0;
    onProgress({ stage, complete, total: work.length, records: unique.length });

    async function worker() {
      while (next < work.length) {
        const index = next++;
        const data = await fetchBatch(endpoint, work[index], field, signal);
        for (const item of data) {
          if (item?.id && Object.prototype.hasOwnProperty.call(item, field)) map.set(item.id, item[field]);
        }
        complete++;
        onProgress({ stage, complete, total: work.length, records: unique.length });
        if (next < work.length) await sleep(250, signal);
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, work.length) }, worker));
    return map;
  }

  async function enrich(records, onProgress = () => {}, signal) {
    const posts = records.filter(record => record.type === 'post');
    const comments = records.filter(record => record.type === 'comment');
    const postScores = await fetchMap('posts', posts.map(record => record.id), 'score',
      'post-scores', onProgress, signal);
    const commentScores = await fetchMap('comments', comments.map(record => record.id), 'score',
      'comment-scores', onProgress, signal);
    const threadTitles = await fetchMap('posts', comments.map(record => record._threadId), 'title',
      'thread-titles', onProgress, signal);

    let enriched = 0;
    const items = records.map(record => {
      const score = (record.type === 'post' ? postScores : commentScores).get(record.id);
      const item = {
        ...record,
        score: score !== null && score !== undefined && Number.isFinite(Number(score))
          ? Number(score)
          : null,
      };
      if (item.score !== null) enriched++;
      if (item.type === 'comment') {
        item.thread = threadTitles.get(item._threadId) || '';
        delete item._threadId;
      }
      return item;
    });
    return { items, enriched, unavailable: items.length - enriched };
  }

  window.ArcticShift = { enrich };
})();
