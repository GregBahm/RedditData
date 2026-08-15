(() => {
  function parse(text, basePath) {
    const sections = String(text).replace(/\r\n?/g, '\n').trim().split(/\n(?=\d{4}\s*$)/m);
    return sections.map(section => {
      const match = /^(\d{4})\s*\n([\s\S]+)$/.exec(section.trim());
      if (!match) throw new Error('Invalid timeline insight section');
      const year = Number(match[1]);
      return {
        year,
        start: Date.UTC(year, 0, 1),
        body: match[2].trim(),
        image: `${basePath}${year}.png`,
      };
    }).sort((a, b) => a.year - b.year);
  }

  async function load(basePath = '../timelineInsights/') {
    const response = await fetch(`${basePath}timelineInsights.txt`);
    if (!response.ok) throw new Error(`Unable to load timeline insights (${response.status})`);
    const insights = parse(await response.text(), basePath);
    for (let i = 0; i < insights.length; i++) {
      insights[i].end = insights[i + 1]?.start ?? Infinity;
    }
    return insights;
  }

  window.RedditTimelineInsights = { load };
})();
