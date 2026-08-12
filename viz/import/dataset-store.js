(() => {
  const DB_NAME = 'reddit-data-visualizer';
  const DB_VERSION = 1;
  const STORE = 'datasets';
  const ACTIVE_KEY = 'active';

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function withStore(mode, action) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = action(transaction.objectStore(STORE));
        let result;
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = () => reject(transaction.error);
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      db.close();
    }
  }

  async function getImported() {
    return withStore('readonly', store => store.get(ACTIVE_KEY));
  }

  async function getActive(demoData) {
    try {
      const imported = await getImported();
      return Array.isArray(imported?.items) && imported.items.length ? imported.items : demoData;
    } catch {
      return demoData;
    }
  }

  async function getStatus() {
    try {
      const imported = await getImported();
      if (!Array.isArray(imported?.items) || !imported.items.length) return { imported: false };
      return {
        imported: true,
        count: imported.items.length,
        sourceName: imported.sourceName || 'Reddit export',
        importedAt: imported.importedAt,
      };
    } catch {
      return { imported: false };
    }
  }

  async function saveImported(items, sourceName) {
    if (!Array.isArray(items) || !items.length) throw new Error('The imported dataset is empty.');
    await withStore('readwrite', store => store.put({
      items,
      sourceName,
      importedAt: new Date().toISOString(),
    }, ACTIVE_KEY));
  }

  async function clearImported() {
    await withStore('readwrite', store => store.delete(ACTIVE_KEY));
  }

  window.RedditDataset = { getActive, getStatus, saveImported, clearImported };
})();
