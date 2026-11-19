// Búsqueda de artistas en Deezer para sacar su foto (sin clave; vía JSONP porque la API no admite CORS).
let seq = 0;

export function searchArtists(q, limit = 8) {
  return new Promise((resolve, reject) => {
    const cb = `__dz${Date.now()}_${seq++}`;
    const s = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); reject(new Error('Deezer no responde')); }, 8000);
    function cleanup() { clearTimeout(timer); delete window[cb]; s.remove(); }
    window[cb] = (res) => {
      cleanup();
      const data = (res && res.data) || [];
      resolve(data.map((a) => ({
        id: a.id, name: a.name, fans: a.nb_fan || 0,
        image: a.picture_xl || a.picture_big || a.picture_medium || null,
        thumb: a.picture_medium || a.picture || null,
      })).filter((a) => a.image && !/\/artist\/\/|images\/artist\/\//.test(a.image)));
    };
    s.onerror = () => { cleanup(); reject(new Error('Deezer no responde')); };
    s.src = `https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=${limit}&output=jsonp&callback=${cb}`;
    document.head.appendChild(s);
  });
}
