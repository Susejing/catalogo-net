const BASE_URL = "https://raw.githubusercontent.com/Susejing/catalogo-net/main/";
const ADDON_BASE_URL = "https://victory-incl-elephant-diesel.trycloudflare.com";
const YANDEX_API = "https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=";

const ARCHIVOS = ["ligero.001.json", "ligero.002.json", "ligero.003.json", "ligero.004.json", "ligero.005.json"];
let memoryCache = null;

async function getCatalog() {
  if (memoryCache) return memoryCache;
  let catalogoCompleto = [];
  for (const archivo of ARCHIVOS) {
    try {
      const res = await kino.fetch(BASE_URL + archivo);
      if (res.ok) {
        const parte = await res.json();
        if (Array.isArray(parte)) catalogoCompleto = catalogoCompleto.concat(parte);
      }
    } catch (e) { kino.log("Error cargando " + archivo); }
  }
  memoryCache = catalogoCompleto;
  return memoryCache;
}

function formatItem(item) {
  const realId = item.id ? item.id.toString() : item.row.toString(); 
  const k = item.kind === 'tv' ? 'series' : (item.kind || "movie");
  return {
    id: realId,
    title: item.name || "Sin título",
    poster: item.image_path ? `https://image.tmdb.org/t/p/w500${item.image_path}` : "",
    kind: k,
    ref: `${k}:${realId}`
  };
}

function getGenre(item) {
  const g = (item.genres || "").toString().toLowerCase();
  const res = (item.resolutions || "").toString().toUpperCase();
  if (res.includes('JPN') || res.includes('JAP') || g.includes('anime')) return "anime";
  if (g.includes('animación') || g.includes('animacion') || g.includes('kids') || g.includes('infantil')) return "caricatura";
  return "general";
}

export async function section({ tab }) {
  const tabs = [
    { id: "movies", label: "Películas" },
    { id: "series", label: "Series" },
    { id: "anime", label: "Anime" },
    { id: "cartoons", label: "Caricaturas" }
  ];
  const chosen = tabs.some(t => t.id === tab) ? tab : "movies";
  return { tabs, tab: chosen, rows: await getRowsForTab(chosen) };
}

async function getRowsForTab(tabId) {
  const catalog = await getCatalog();
  const rows = [];

  if (tabId === "movies") {
    const movies = catalog.filter(i => (i.kind === 'movie' || i.kind === 'film') && getGenre(i) === 'general');
    if (movies.length > 0) {
      rows.push({ id: "trend_mov", title: "🔥 Tendencias", ref: "trend_mov", items: movies.slice(0, 20).map(formatItem) });
      rows.push({ id: "cart_mov", title: "🎬 En cartelera", ref: "cart_mov", items: movies.slice(20, 40).map(formatItem) });
      rows.push({ id: "pop_mov", title: "⭐ Populares", ref: "pop_mov", items: movies.slice(40, 60).map(formatItem) });
      rows.push({ id: "action_mov", title: "💥 Acción y Aventura", ref: "action_mov", items: movies.slice(60, 80).map(formatItem) });
    }
  } 
  else if (tabId === "series") {
    const series = catalog.filter(i => (i.kind === 'series' || i.kind === 'tv') && getGenre(i) === 'general');
    if (series.length > 0) {
      rows.push({ id: "pop_ser", title: "📺 Series Populares", ref: "pop_ser", items: series.slice(0, 20).map(formatItem) });
      rows.push({ id: "new_ser", title: "✨ Estrenos", ref: "new_ser", items: series.slice(20, 40).map(formatItem) });
      rows.push({ id: "drama_ser", title: "🎭 Drama y Misterio", ref: "drama_ser", items: series.slice(40, 60).map(formatItem) });
    }
  } 
  else if (tabId === "anime") {
    const anime = catalog.filter(i => getGenre(i) === 'anime');
    if (anime.length > 0) {
      rows.push({ id: "anime_top", title: "🌸 Anime Destacado", ref: "anime_top", items: anime.slice(0, 20).map(formatItem) });
      rows.push({ id: "anime_sub", title: "🇯🇵 Anime Subtitulado", ref: "anime_sub", items: anime.slice(20, 40).map(formatItem) });
      rows.push({ id: "anime_lat", title: "🇲🇽 Anime en Latino", ref: "anime_lat", items: anime.slice(40, 60).map(formatItem) });
    }
  }
  else if (tabId === "cartoons") {
    const cartoons = catalog.filter(i => getGenre(i) === 'caricatura');
    if (cartoons.length > 0) {
      rows.push({ id: "cartoon_pop", title: "🧸 Caricaturas Populares", ref: "cartoon_pop", items: cartoons.slice(0, 20).map(formatItem) });
      rows.push({ id: "cartoon_kids", title: "👶 Para los más pequeños", ref: "cartoon_kids", items: cartoons.slice(20, 40).map(formatItem) });
    }
  }
  return rows;
}

export async function home() {
  return await getRowsForTab("movies");
}

export async function browse(ref, cursor) {
  const catalog = await getCatalog();
  let source = [];
  if (ref.includes("_mov")) source = catalog.filter(i => (i.kind === 'movie' || i.kind === 'film') && getGenre(i) === 'general');
  else if (ref.includes("_ser")) source = catalog.filter(i => (i.kind === 'series' || i.kind === 'tv') && getGenre(i) === 'general');
  else if (ref.startsWith("anime_")) source = catalog.filter(i => getGenre(i) === 'anime');
  else if (ref.startsWith("cartoon_")) source = catalog.filter(i => getGenre(i) === 'caricatura');
  else source = catalog;

  const limit = 30;
  const start = cursor ? parseInt(cursor) : 0;
  const end = start + limit;
  const items = source.slice(start, end).map(formatItem);
  const nextCursor = end < source.length ? end.toString() : null;
  return { items, next: nextCursor };
}

export async function search(query) {
  const catalog = await getCatalog();
  const q = query.q.toLowerCase();
  return catalog.filter(item => item.name && item.name.toLowerCase().includes(q)).slice(0, 50).map(formatItem);
}

// 🌟 SINOPSIS FORZADA CON API KEY
export async function meta(item) {
  const apiKey = kino.settings.get("tmdb_api_key");
  const tmdbType = item.kind === 'series' ? 'tv' : 'movie';
  
  // 1. Intentar con la API Key del usuario
  if (apiKey) {
    try {
      const res = await kino.fetch(`https://api.themoviedb.org/3/${tmdbType}/${item.id}?api_key=${apiKey}&language=es-ES`);
      if (res.ok) {
        const data = await res.json();
        return { title: item.title, poster: item.poster, overview: data.overview || "Sin sinopsis.", genres: data.genres?.map(g => g.name) || [], rating: data.vote_average || 0 };
      }
    } catch (e) { kino.log("Fallo API Key, intentando nativo"); }
  }

  // 2. Respaldo: Kino nativo
  try {
    const tmdb = await kino.tmdb(item.id, tmdbType, 'es-ES');
    return { title: item.title, poster: item.poster, overview: tmdb.overview || "Sin sinopsis disponible." };
  } catch (e) {
    return { title: item.title, poster: item.poster, overview: "No hay información." };
  }
}

// 📺 EPISODIOS (Obligando a TMDB a dar la lista real)
export async function episodes(ref) {
  const parts = ref.split(':');
  const id = parts[1];
  const apiKey = kino.settings.get("tmdb_api_key");

  try {
    // Pedimos los detalles de la serie a TMDB
    const url = apiKey 
      ? `https://api.themoviedb.org/3/tv/${id}?api_key=${apiKey}&language=es-ES`
      : `https://api.themoviedb.org/3/tv/${id}?api_key=TU_API_KEY_AQUI&language=es-ES`; // Intenta con Kino nativo si no hay key

    let tmdbData;
    if (apiKey) {
        const res = await kino.fetch(url);
        tmdbData = await res.json();
    } else {
        tmdbData = await kino.tmdb(id, 'tv', 'es-ES');
    }

    const temporadas = tmdbData.seasons || [];
    let listaEpisodios = [];

    // Por cada temporada, buscamos sus episodios
    for (const temp of temporadas) {
      if (temp.season_number === 0) continue; // Ignorar especiales
      
      let tempData;
      if (apiKey) {
        const tempRes = await kino.fetch(`https://api.themoviedb.org/3/tv/${id}/season/${temp.season_number}?api_key=${apiKey}&language=es-ES`);
        tempData = await tempRes.json();
      }

      if (tempData && tempData.episodes) {
        for (const ep of tempData.episodes) {
          listaEpisodios.push({
            id: `${id}:${temp.season_number}:${ep.episode_number}`, // ID que usará resolve
            title: ep.name || `Episodio ${ep.episode_number}`,
            season: temp.season_number,
            number: ep.episode_number,
            overview: ep.overview || ""
          });
        }
      }
    }
    return { episodes: listaEpisodios, next: null };
  } catch (e) {
    kino.log("Error cargando episodios:", e.message);
    return { episodes: [], next: null };
  }
}

// ▶️ REPRODUCCIÓN (Arreglado para Series)
export async function resolve(ref) {
  const parts = ref.split(':');
  const type = parts[0]; 
  const id = parts[1];
  const season = parts[2]; // Si es serie, vendrá la temporada
  const episode = parts[3]; // Si es serie, vendrá el episodio

  try {
    let linksUrl = `${ADDON_BASE_URL}/addon/links/${type}/${id}.json`;
    
    // Si es una serie y tenemos temporada/episodio, usamos la ruta de series (Stremio Standard)
    if (type === 'series' && season && episode) {
       linksUrl = `${ADDON_BASE_URL}/stream/series/${id}:${season}:${episode}.json`;
    }

    const res = await kino.fetch(linksUrl);
    if (!res.ok) throw new Error(`No hay video para este episodio (HTTP ${res.status})`);
    
    const data = await res.json();
    
    // Dependiendo de cómo devuelva el addon los links (array o streams)
    const links = data.streams || data.links || data;
    if (!links || links.length === 0) throw new Error("No hay enlaces de Yandex.");

    const firstLink = links[0];
    const linkUrl = firstLink.url || firstLink.share;

    // Resolvemos en Yandex
    const yandexRes = await kino.fetch(YANDEX_API + encodeURIComponent(linkUrl));
    if (!yandexRes.ok) throw new Error("Yandex rechazó la descarga.");
    
    const yandexData = await yandexRes.json();
    if (!yandexData || !yandexData.href) throw new Error("No se obtuvo el enlace directo.");

    return { url: yandexData.href };
  } catch (error) {
    throw new Error(error.message);
  }
}
