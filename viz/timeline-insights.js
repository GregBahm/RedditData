(() => {
  const monthIndexes = new Map([
    ['january', 0],
    ['february', 1],
    ['march', 2],
    ['april', 3],
    ['may', 4],
    ['june', 5],
    ['july', 6],
    ['august', 7],
    ['september', 8],
    ['october', 9],
    ['november', 10],
    ['december', 11],
  ]);

  function parse(text, basePath) {
    const sections = String(text)
      .replace(/\r\n?/g, '\n')
      .trim()
      .split(/\n(?=[A-Za-z]+\s+\d{4}\s*,\s*[^\n]+\s*$)/m);
    return sections.map(section => {
      const match = /^([A-Za-z]+)\s+(\d{4})\s*,\s*([^\n]+)\n([\s\S]+)$/.exec(section.trim());
      if (!match) throw new Error('Invalid timeline insight section');
      const monthName = match[1];
      const month = monthIndexes.get(monthName.toLowerCase());
      const year = Number(match[2]);
      const imageName = match[3].trim();
      if (month === undefined) throw new Error(`Invalid timeline insight month: ${monthName}`);
      if (!/^[^/\\]+\.png$/i.test(imageName)) {
        throw new Error(`Invalid timeline insight image: ${imageName}`);
      }
      return {
        year,
        label: `${monthName} ${year}`,
        start: Date.UTC(year, month, 1),
        body: match[4].trim(),
        image: `${basePath}${encodeURIComponent(imageName)}`,
      };
    }).sort((a, b) => a.start - b.start);
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
