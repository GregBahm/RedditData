(() => {
  const aliases = new Map([
    ['eli5', 'explainlikeimfive'],
  ]);

  function normalize(name) {
    const key = String(name).replace(/^\/?r\//i, '').trim().toLowerCase();
    return aliases.get(key) || key;
  }

  function parse(text) {
    const sections = String(text).replace(/\r\n?/g, '\n').trim()
      .split(/\n(?=\/r\/[^\n]+\s*$)/mi);
    return new Map(sections.map(section => {
      const match = /^\/r\/([^\n]+)\s*\n([\s\S]+)$/.exec(section.trim());
      if (!match) throw new Error('Invalid subreddit insight section');
      return [normalize(match[1]), {
        subreddit: match[1].trim(),
        body: match[2].trim(),
      }];
    }));
  }

  async function load(path = '../subredditInsights.txt') {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Unable to load subreddit insights (${response.status})`);
    return parse(await response.text());
  }

  window.RedditSubredditInsights = { load, normalize };
})();
