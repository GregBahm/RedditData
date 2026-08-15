(() => {
  const STORAGE_KEY = 'reddit-data-theme';
  const THEMES = [
    'basic',
    'dark',
    'minimalistic',
    'bauhaus',
    'neumorphic',
    'dark-neumorphic',
    'brutalist',
  ];

  function normalize(theme) {
    return THEMES.includes(theme) ? theme : 'basic';
  }

  function apply(theme, options = {}) {
    const next = normalize(theme);
    document.documentElement.dataset.theme = next;
    if (options.persist !== false) localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent('reddit-data-theme-change', {
      detail: { theme: next },
    }));
    return next;
  }

  const requested = new URLSearchParams(location.search).get('theme');
  apply(requested || localStorage.getItem(STORAGE_KEY) || 'basic', { persist: false });

  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.data?.type !== 'reddit-data-theme') return;
    apply(event.data.theme, { persist: false });
  });

  window.RedditTheme = {
    apply,
    current: () => normalize(document.documentElement.dataset.theme),
    themes: THEMES.slice(),
  };
})();
