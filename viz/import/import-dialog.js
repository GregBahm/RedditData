(() => {
  const dialog = document.getElementById('importDialog');
  const openButton = document.getElementById('importOpen');
  const closeButton = document.getElementById('importClose');
  const clearButton = document.getElementById('clearImported');
  const input = document.getElementById('importFile');
  const drop = document.getElementById('importDrop');
  const state = document.getElementById('importState');
  const stateTitle = document.getElementById('importStateTitle');
  const stateMessage = document.getElementById('importStateMessage');
  const progress = document.getElementById('importProgress');
  const stateActions = document.getElementById('importStateActions');
  const status = document.getElementById('datasetStatus');
  const pageTitle = document.getElementById('pageTitle');
  const commentarySection = document.getElementById('commentarySection');
  let processing = false;
  let controller = null;
  let parsedRecords = null;
  let sourceName = '';
  let importRun = 0;

  function button(text, action, primary = false) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'control';
    if (primary) node.style.borderColor = 'var(--accent)';
    node.textContent = text;
    node.addEventListener('click', action);
    stateActions.append(node);
  }

  function showState(kind, title, message, options = {}) {
    state.hidden = false;
    state.dataset.kind = kind;
    stateTitle.textContent = title;
    stateMessage.textContent = message;
    stateActions.replaceChildren();
    progress.hidden = !options.progress;
    progress.removeAttribute('value');
    if (options.progress && Number.isFinite(options.value) && Number.isFinite(options.max)) {
      progress.max = Math.max(1, options.max);
      progress.value = options.value;
    }
  }

  function setReady() {
    state.hidden = true;
    stateActions.replaceChildren();
    input.value = '';
    parsedRecords = null;
    sourceName = '';
  }

  function reloadVisualizers() {
    for (const frame of document.querySelectorAll('iframe')) {
      frame.contentWindow.location.reload();
    }
  }

  async function updateDatasetStatus() {
    const current = await RedditDataset.getStatus();
    clearButton.hidden = !current.imported;
    commentarySection.hidden = current.imported;
    window.dispatchEvent(new CustomEvent('reddit-data-dataset-status', { detail: current }));
    status.textContent = current.imported
      ? `${current.count.toLocaleString()} personal records active`
      : 'Showing the built-in demo data';
    pageTitle.replaceChildren();
    if (current.imported) {
      pageTitle.textContent = 'Your Reddit History Visualized';
    } else {
      const link = document.createElement('a');
      link.href = 'https://www.reddit.com/u/GregBahm';
      link.textContent = 'u/GregBahm';
      pageTitle.append(link, document.createTextNode("'s Reddit Addiction Visualized"));
    }
  }

  function progressUpdate(info) {
    if (info.stage === 'reading' || info.stage === 'parsing') {
      showState('working', info.stage === 'reading' ? 'Reading ZIP' : 'Parsing export',
        info.message, { progress: true });
      return;
    }
    const labels = {
      'post-scores': 'Fetching post scores',
      'comment-scores': 'Fetching comment scores',
      'thread-titles': 'Fetching thread titles',
    };
    showState('working', labels[info.stage], `${info.complete} of ${info.total} batches complete`,
      { progress: true, value: info.complete, max: info.total });
  }

  async function enrichParsedRecords(run = importRun) {
    controller = new AbortController();
    try {
      const result = await ArcticShift.enrich(parsedRecords, progressUpdate, controller.signal);
      if (run !== importRun) return;
      processing = false;
      controller = null;
      const posts = result.items.filter(item => item.type === 'post').length;
      const comments = result.items.length - posts;
      showState('complete', 'Import ready',
        `${posts.toLocaleString()} posts, ${comments.toLocaleString()} comments, ${result.enriched.toLocaleString()} scores found, and ${result.unavailable.toLocaleString()} scores unavailable.`);
      button('Display my data', async () => {
        try {
          showState('working', 'Saving locally', 'Storing the processed dataset in this browser…', { progress: true });
          await RedditDataset.saveImported(result.items, sourceName);
          await updateDatasetStatus();
          reloadVisualizers();
          dialog.close();
          setReady();
        } catch (error) {
          showError(error, false);
        }
      }, true);
      button('Choose another ZIP', setReady);
    } catch (error) {
      processing = false;
      controller = null;
      if (error.name === 'AbortError') {
        setReady();
        return;
      }
      showError(error, true);
    }
  }

  function showError(error, canRetryEnrichment) {
    showState('error', 'Import could not be completed', error.message || String(error));
    if (canRetryEnrichment && parsedRecords) button('Retry Arctic Shift lookup', () => {
      processing = true;
    enrichParsedRecords(importRun);
    }, true);
    button('Choose another ZIP', setReady);
  }

  async function importFile(file) {
    if (processing || !file) return;
    const run = ++importRun;
    processing = true;
    sourceName = file.name;
    controller = new AbortController();
    try {
      parsedRecords = await RedditExport.readRedditExport(file, progressUpdate);
      if (run !== importRun) return;
      await enrichParsedRecords(run);
    } catch (error) {
      processing = false;
      controller = null;
      if (error.name !== 'AbortError') showError(error, false);
    }
  }

  function requestClose() {
    importRun++;
    if (processing) controller?.abort();
    processing = false;
    dialog.close();
    setReady();
  }

  openButton.addEventListener('click', () => {
    setReady();
    dialog.showModal();
  });
  closeButton.addEventListener('click', requestClose);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    requestClose();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) requestClose();
  });
  dialog.addEventListener('close', () => openButton.focus());
  input.addEventListener('change', () => importFile(input.files[0]));

  for (const eventName of ['dragenter', 'dragover']) {
    drop.addEventListener(eventName, event => {
      event.preventDefault();
      if (!processing) drop.classList.add('drag-active');
    });
  }
  for (const eventName of ['dragleave', 'drop']) {
    drop.addEventListener(eventName, event => {
      event.preventDefault();
      drop.classList.remove('drag-active');
    });
  }
  drop.addEventListener('drop', event => {
    if (!processing) importFile(event.dataTransfer.files[0]);
  });

  clearButton.addEventListener('click', async () => {
    clearButton.disabled = true;
    try {
      await RedditDataset.clearImported();
      await updateDatasetStatus();
      reloadVisualizers();
    } finally {
      clearButton.disabled = false;
    }
  });

  updateDatasetStatus();
})();
