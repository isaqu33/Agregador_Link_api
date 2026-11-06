// Turns a YouTube/Spotify link into the URL of its official player, or null when it has none.
// Only these hosts are ever produced, so the public page can iframe them safely.
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const SP_ID = /^[A-Za-z0-9]{10,30}$/;

export function toEmbedUrl(type: string, link: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');

  if (type === 'Youtube') {
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      return YT_ID.test(id)
        ? `https://www.youtube-nocookie.com/embed/${id}`
        : null;
    }
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      const list = url.searchParams.get('list');
      const v = url.searchParams.get('v');
      if (v && YT_ID.test(v))
        return `https://www.youtube-nocookie.com/embed/${v}`;
      const parts = url.pathname.split('/').filter(Boolean);
      if (
        ['shorts', 'embed', 'live'].includes(parts[0]) &&
        YT_ID.test(parts[1] ?? '')
      ) {
        return `https://www.youtube-nocookie.com/embed/${parts[1]}`;
      }
      if (list && /^[A-Za-z0-9_-]{10,60}$/.test(list)) {
        return `https://www.youtube-nocookie.com/embed/videoseries?list=${list}`;
      }
    }
    return null;
  }

  if (type === 'Spotify' && host === 'open.spotify.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    // /intl-pt/track/ID also exists
    const i = parts[0]?.startsWith('intl-') ? 1 : 0;
    const kind = parts[i];
    const id = parts[i + 1];
    if (
      ['track', 'album', 'playlist', 'episode', 'show', 'artist'].includes(
        kind,
      ) &&
      SP_ID.test(id ?? '')
    ) {
      return `https://open.spotify.com/embed/${kind}/${id}`;
    }
  }
  return null;
}

export const EMBED_TYPES = ['Youtube', 'Spotify'];
