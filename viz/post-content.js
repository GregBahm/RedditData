(() => {
  const mediaCache = new Map();

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function safeHref(raw) {
    try {
      const url = new URL(raw, location.href);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch {
      return null;
    }
  }

  function appendMarkdownInline(parent, text) {
    const token = /(\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*\n]+)\*|_([^_\n]+)_|https?:\/\/[^\s<]+)/g;
    let at = 0;
    let match;
    while ((match = token.exec(text))) {
      if (match.index > at) parent.append(document.createTextNode(text.slice(at, match.index)));
      if (match[2] !== undefined) {
        const href = safeHref(match[3]);
        if (href) {
          const link = element('a', null, match[2]);
          link.href = href;
          link.target = '_blank';
          link.rel = 'noopener';
          parent.append(link);
        } else {
          parent.append(document.createTextNode(match[0]));
        }
      } else if (match[4] !== undefined || match[5] !== undefined) {
        const strong = document.createElement('strong');
        appendMarkdownInline(strong, match[4] ?? match[5]);
        parent.append(strong);
      } else if (match[6] !== undefined) {
        parent.append(element('code', null, match[6]));
      } else if (match[7] !== undefined || match[8] !== undefined) {
        const emphasis = document.createElement('em');
        appendMarkdownInline(emphasis, match[7] ?? match[8]);
        parent.append(emphasis);
      } else {
        const link = element('a', null, match[0]);
        link.href = safeHref(match[0]);
        link.target = '_blank';
        link.rel = 'noopener';
        parent.append(link);
      }
      at = token.lastIndex;
    }
    if (at < text.length) parent.append(document.createTextNode(text.slice(at)));
  }

  function renderMarkdown(text) {
    const root = element('div', 'body');
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    let paragraph = [];
    let list = null;
    let code = null;
    const flushParagraph = () => {
      if (!paragraph.length) return;
      const node = document.createElement('p');
      appendMarkdownInline(node, paragraph.join(' '));
      root.append(node);
      paragraph = [];
    };
    const endList = () => { list = null; };
    for (const line of lines) {
      if (code) {
        if (/^```/.test(line)) {
          const pre = document.createElement('pre');
          pre.append(element('code', null, code.join('\n')));
          root.append(pre);
          code = null;
        } else {
          code.push(line);
        }
        continue;
      }
      if (/^```/.test(line)) {
        flushParagraph();
        endList();
        code = [];
        continue;
      }
      if (!line.trim()) {
        flushParagraph();
        endList();
        continue;
      }
      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      if (heading) {
        flushParagraph();
        endList();
        const node = document.createElement('h' + heading[1].length);
        appendMarkdownInline(node, heading[2]);
        root.append(node);
        continue;
      }
      const quote = /^>\s?(.*)$/.exec(line);
      if (quote) {
        flushParagraph();
        endList();
        const node = document.createElement('blockquote');
        appendMarkdownInline(node, quote[1]);
        root.append(node);
        continue;
      }
      const bullet = /^\s*[-+*]\s+(.+)$/.exec(line);
      const numbered = /^\s*\d+\.\s+(.+)$/.exec(line);
      if (bullet || numbered) {
        flushParagraph();
        const tag = bullet ? 'ul' : 'ol';
        if (!list || list.tagName.toLowerCase() !== tag) {
          list = document.createElement(tag);
          root.append(list);
        }
        const item = document.createElement('li');
        appendMarkdownInline(item, (bullet || numbered)[1]);
        list.append(item);
        continue;
      }
      endList();
      paragraph.push(line.trim());
    }
    flushParagraph();
    if (code) {
      const pre = document.createElement('pre');
      pre.append(element('code', null, code.join('\n')));
      root.append(pre);
    }
    return root;
  }

  function archivedPost(id) {
    if (!mediaCache.has(id)) {
      const url = 'https://arctic-shift.photon-reddit.com/api/posts/ids?ids=' + encodeURIComponent(id);
      mediaCache.set(id, fetch(url).then(response => {
        if (!response.ok) throw new Error('media lookup failed');
        return response.json();
      }).then(result => result.data?.[0] || null).catch(() => null));
    }
    return mediaCache.get(id);
  }

  function mediaSources(post) {
    const direct = safeHref(post?.url);
    const redditVideo = safeHref(post?.secure_media?.reddit_video?.fallback_url ||
      post?.media?.reddit_video?.fallback_url);
    const previewVideo = safeHref(post?.preview?.images?.[0]?.variants?.mp4?.source?.url);
    const previewImage = safeHref(post?.preview?.images?.[0]?.variants?.gif?.source?.url ||
      post?.preview?.images?.[0]?.source?.url);
    const thumbnail = safeHref(post?.thumbnail);
    const sources = [];
    const add = (type, url) => {
      if (url && !sources.some(source => source.url === url)) sources.push({ type, url });
    };
    add('video', redditVideo);
    add('video', previewVideo);
    if (direct && /\.(?:mp4|webm)(?:$|[?#])/i.test(direct)) add('video', direct);
    if (direct && /\.(?:avif|gif|jpe?g|png|webp)(?:$|[?#])/i.test(direct)) add('image', direct);
    if (post?.post_hint === 'image') add('image', direct);
    add('image', previewImage);
    if (thumbnail && !/\/(?:default|self|spoiler|nsfw)\.(?:png|jpg)$/i.test(thumbnail)) {
      add('image', thumbnail);
    }
    return sources;
  }

  async function appendMedia(container, postRecord, options = {}) {
    const isCurrent = options.isCurrent || (() => true);
    container.textContent = 'loading media…';
    const post = await archivedPost(postRecord.id);
    if (!isCurrent()) return;
    const sources = mediaSources(post);
    const thumbnail = safeHref(post?.thumbnail);
    if (thumbnail && !/\/(?:default|self|spoiler|nsfw)\.(?:png|jpg)$/i.test(thumbnail)) {
      const preview = document.createElement('img');
      preview.src = thumbnail;
      preview.alt = postRecord.title || 'Post media preview';
      container.replaceChildren(preview);
    }
    for (const source of sources) {
      if (!isCurrent()) return;
      const media = await new Promise(resolve => {
        if (source.type === 'video') {
          const video = document.createElement('video');
          video.autoplay = true;
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          video.controls = !!options.controls;
          video.addEventListener('loadeddata', () => resolve(video), { once: true });
          video.addEventListener('error', () => resolve(null), { once: true });
          video.src = source.url;
          video.load();
        } else {
          const image = document.createElement('img');
          image.alt = postRecord.title || 'Post media';
          image.addEventListener('load', () => resolve(image), { once: true });
          image.addEventListener('error', () => resolve(null), { once: true });
          image.src = source.url;
        }
      });
      if (media) {
        if (!isCurrent()) return;
        container.replaceChildren(media);
        container.style.opacity = '1';
        return;
      }
    }
    container.textContent = sources.length ? 'media is no longer available' : '';
  }

  window.RedditPostContent = { renderMarkdown, appendMedia };
})();
