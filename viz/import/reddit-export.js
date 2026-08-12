(() => {
  Papa.SCRIPT_PATH = new URL('vendor/papaparse.min.js', document.baseURI).href;
  const POST_COLUMNS = ['id', 'date', 'subreddit', 'title', 'body', 'permalink'];
  const COMMENT_COLUMNS = ['id', 'date', 'subreddit', 'body', 'permalink', 'link'];

  function basename(path) {
    return path.replace(/\\/g, '/').split('/').pop().toLowerCase();
  }

  function findFile(zip, name) {
    return Object.values(zip.files).find(entry => !entry.dir && basename(entry.name) === name);
  }

  function parseCsv(text, fileName) {
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: 'greedy',
        worker: true,
        complete: result => {
          if (result.errors.some(error => error.type === 'Quotes' || error.type === 'Delimiter')) {
            reject(new Error(`${fileName} could not be parsed as CSV.`));
            return;
          }
          resolve({ rows: result.data, fields: result.meta.fields || [] });
        },
        error: error => reject(new Error(`${fileName} could not be parsed: ${error.message}`)),
      });
    });
  }

  function requireColumns(fileName, fields, required) {
    const present = new Set(fields);
    const missing = required.filter(column => !present.has(column));
    if (missing.length) {
      throw new Error(`${fileName} is incompatible with this visualizer. Missing column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`);
    }
  }

  function redditUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(value, 'https://www.reddit.com');
      const host = url.hostname.toLowerCase();
      if (!['http:', 'https:'].includes(url.protocol) ||
          !(host === 'reddit.com' || host.endsWith('.reddit.com'))) return '';
      return url.href;
    } catch {
      return '';
    }
  }

  function clean(value) {
    return value == null ? '' : String(value);
  }

  function validRows(rows, type) {
    return rows.filter(row => clean(row.id).trim() && clean(row.date).trim()).map(row => {
      const date = clean(row.date).trim();
      if (!Number.isFinite(Date.parse(date.replace(' UTC', 'Z').replace(' ', 'T')))) {
        throw new Error(`${type === 'post' ? 'posts.csv' : 'comments.csv'} contains an invalid date for ID ${clean(row.id).trim()}.`);
      }
      const record = {
        id: clean(row.id).trim(),
        type,
        date,
        sub: clean(row.subreddit).trim() || '(unknown)',
        title: type === 'post' ? clean(row.title) : '',
        body: clean(row.body),
        score: null,
        link: redditUrl(row.permalink),
      };
      if (type === 'comment') {
        const match = clean(row.link).match(/\/comments\/([a-z0-9]+)/i);
        record.thread = '';
        record._threadId = match ? match[1].toLowerCase() : '';
      }
      return record;
    });
  }

  async function readRedditExport(file, onProgress = () => {}) {
    if (!file || !/\.zip$/i.test(file.name || '') &&
        !['application/zip', 'application/x-zip-compressed'].includes(file.type)) {
      throw new Error('Choose the ZIP file downloaded from Reddit. Other file types are not supported.');
    }

    onProgress({ stage: 'reading', message: `Reading ${file.name}…` });
    let zip;
    try {
      zip = await JSZip.loadAsync(file);
    } catch {
      throw new Error('This file is not a readable ZIP archive. Choose the unmodified ZIP downloaded from Reddit.');
    }

    const postsEntry = findFile(zip, 'posts.csv');
    const commentsEntry = findFile(zip, 'comments.csv');
    if (!postsEntry || !commentsEntry) {
      const missing = [!postsEntry && 'posts.csv', !commentsEntry && 'comments.csv'].filter(Boolean);
      throw new Error(`The Reddit export is missing ${missing.join(' and ')}.`);
    }

    onProgress({ stage: 'parsing', message: 'Parsing posts.csv…' });
    const postsText = await postsEntry.async('string');
    const posts = await parseCsv(postsText, 'posts.csv');
    requireColumns('posts.csv', posts.fields, POST_COLUMNS);

    onProgress({ stage: 'parsing', message: 'Parsing comments.csv…' });
    const commentsText = await commentsEntry.async('string');
    const comments = await parseCsv(commentsText, 'comments.csv');
    requireColumns('comments.csv', comments.fields, COMMENT_COLUMNS);

    const records = [
      ...validRows(posts.rows, 'post'),
      ...validRows(comments.rows, 'comment'),
    ];
    if (!records.length) throw new Error('The Reddit export contains no posts or comments to visualize.');
    return records;
  }

  window.RedditExport = { readRedditExport };
})();
