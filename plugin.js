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

// Filtro de anime: busca "anime" en el nombre, géneros o resolución
function isAnime(item) {
  const nombre = (item.name || "").toLowerCase();
  const generos = (item.genres || "").toLowerCase();
  const resolucion = (item.resolutions || "").toUpperCase();
  return nombre.includes('anime') || generos.includes('anime') || resolucion.includes('JPN') || resolucion.includes('JAP');
}

// --- PESTAÑAS ---
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
    const movies = catalog.filter(i => (i.kind === 'movie' || i.kind === 'film') && !isAnime(i));
    if (movies.length > 0) {
      rows.push({ id: "trend_mov", title: "🔥 Tendencias", ref: "trend_mov", items: movies.slice(0, 20).map(formatItem) });
      rows.push({ id: "pop_mov", title: "⭐ Populares", ref: "pop_mov", items: movies.slice(20, 40).map(formatItem) });
    }
  } 
  else if (tabId === "series") {
    const series = catalog.filter(i => (i.kind === 'series' || i.kind === 'tv') && !isAnime(i));
    if (series.length > 0) {
      rows.push({ id: "pop_ser", title: "📺 Series Populares", ref: "pop_ser", items: series.slice(0, 20).map(formatItem) });
      rows.push({ id: "new_ser", title: "✨ Estrenos", ref: "new_ser", items: series.slice(20, 40).map(formatItem) });
    }
  } 
  else if (tabId === "anime") {
    const anime = catalog.filter(i => isAnime(i));
    if (anime.length > 0) {
      rows.push({ id: "anime_top", title: "🌸 Anime Destacado", ref: "anime_top", items: anime.slice(0, 20).map(formatItem) });
      rows.push({ id: "anime_all", title: "📚 Todo el Anime", ref: "anime_all", items: anime.slice(20, 40).map(formatItem) });
    }
  }
  else if (tabId === "cartoons") {
    const cartoons = catalog.filter(i => (i.kind === 'movie' || i.kind === 'series' || i.kind === 'tv') && !isAnime(i) && (i.genres || "").toLowerCase().includes('animación'));
    if (cartoons.length > 0) {
      rows.push({ id: "cartoon_pop", title: "🧸 Caricaturas", ref: "cartoon_pop", items: cartoons.slice(0, 20).map(formatItem) });
    }
  }
  return rows;
}

export async function home() {
  return await getRowsForTab("movies");
}

// --- PAGINACIÓN CORREGIDA ---
export async function browse(ref, cursor) {
  const catalog = await getCatalog();
  let source = [];

  if (ref.includes("_mov")) source = catalog.filter(i => (i.kind === 'movie' || i.kind === 'film') && !isAnime(i));
  else if (ref.includes("_ser")) source = catalog.filter(i => (i.kind === 'series' || i.kind === 'tv') && !isAnime(i));
  else if (ref.includes("_anime")) source = catalog.filter(i => isAnime(i));
  else if (ref.includes("_cartoon")) source = catalog.filter(i => (i.kind === 'movie' || i.kind === 'series' || i.kind === 'tv') && !isAnime(i) && (i.genres || "").toLowerCase().includes('animación'));
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

// --- SINOPSIS CORREGIDA ---
export async function meta(item) {
  try {
    const tmdbType = item.kind === 'series' ? 'tv' : 'movie';
    const tmdb = await kino.tmdb(item.id, tmdbType, 'es-ES');
    return {
      title: item.title,
      poster: item.poster,
      overview: tmdb.overview || "Sin sinopsis disponible.",
      genres: tmdb.genres ? tmdb.genres.map(g => g.name) : [],
      rating: tmdb.vote_average || 0
    };
  } catch (e) {
    return { title: item.title, poster: item.poster, overview: "Sin información." };
  }
}

// --- EPISODIOS (Intenta MoviePlus, respaldo TMDB) ---
export async function episodes(ref) {
  const parts = ref.split(':');
  const id = parts[1];
  
  // 1. Intentar con MoviePlus (probando un endpoint común)
  try {
    const res = await kino.fetch(`${ADDON_BASE_URL}/addon/episodes/series/${id}.json`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          episodes: data.map(ep => ({
            id: `${id}:${ep.season || 1}:${ep.episode || 1}`,
            title: ep.title || `Episodio ${ep.episode || 1}`,
            season: ep.season || 1,
            number: ep.episode || 1,
            overview: ep.overview || ""
          })),
          next: null
        };
      }
    }
  } catch (e) { kino.log("MoviePlus no tiene episodios, usando TMDB"); }

  // 2. Respaldo: TMDB
  try {
    const tmdb = await kino.tmdb(id, 'tv', 'es-ES');
    const temporadas = tmdb.seasons || [];
    let episodios = [];
    for (const temp of temporadas) {
      if (temp.season_number === 0) continue;
      episodios.push({
        id: `${id}:${temp.season_number}:1`,
        title: temp.name || `Temporada ${temp.season_number}`,
        season: temp.season_number,
        number: 1,
        overview: temp.overview
      });
    }
    return { episodes: episodios, next: null };
  } catch (e) {
    return { episodes: [], next: null };
  }
}

// --- REPRODUCCIÓN CORREGIDA (Películas y Series) ---
export async function resolve(ref) {
  const parts = ref.split(':');
  const type = parts[0]; 
  const id = parts[1];
  let season = null;
  let episode = null;

  // Si es serie, el ref puede venir como "series:id:season:episode"
  if (type === 'series' && parts.length >= 4) {
    season = parts[2];
    episode = parts[3];
  }

  try {
    // Construir la URL de links
    let url = `${ADDON_BASE_URL}/addon/links/${type}/${id}.json`;
    if (season && episode) {
      url = `${ADDON_BASE_URL}/addon/links/${type}/${id}/${season}/${episode}.json`;
    }

    const res = await kino.fetch(url);
    if (!res.ok) throw new Error(`No se encontraron enlaces (HTTP ${res.status})`);
    
    const links = await res.json();
    if (!links || links.length === 0) throw new Error("No hay enlaces de Yandex.");
    
    const firstLink = links[0];
    const yandexRes = await kino.fetch(YANDEX_API + encodeURIComponent(firstLink.share));
    if (!yandexRes.ok) throw new Error("Yandex rechazó la solicitud.");
    
    const yandexData = await yandexRes.json();
    if (!yandexData || !yandexData.href) throw new Error("No se pudo obtener el enlace directo.");
    
    return { url: yandexData.href };
  } catch (error) {
    throw new Error(error.message);
  }
}
