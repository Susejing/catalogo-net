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

// Formateo de items
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

// Clasificador
function getGenre(item) {
  const g = (item.genres || "").toString().toLowerCase();
  const isAnim = g.includes('16') || g.includes('anime') || g.includes('animación');
  
  if (isAnim) {
    // Si es infantil o dibujo occidental
    if (g.includes('10762') || g.includes('kids') || g.includes('infantil') || g.includes('familia')) return "caricatura";
    return "anime";
  }
  return "general";
}

// --- 📑 PESTAÑAS (Ahora incluye Caricaturas) ---
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

// --- 🏠 GENERADOR DE FILAS (Llenamos el inicio) ---
async function getRowsForTab(tabId) {
  const catalog = await getCatalog();
  const rows = [];

  if (tabId === "movies") {
    const movies = catalog.filter(i => (i.kind === 'movie' || i.kind === 'film') && getGenre(i) === 'general');
    // Creamos varias filas usando distintos cortes del catálogo
    if (movies.length > 0) {
      rows.push({ id: "trend_mov", title: "🔥 Tendencias de la semana", ref: "trend_mov", items: movies.slice(0, 20).map(formatItem) });
      rows.push({ id: "cart_mov", title: "🎬 En cartelera", ref: "cart_mov", items: movies.slice(20, 40).map(formatItem) });
      rows.push({ id: "pop_mov", title: "⭐ Populares", ref: "pop_mov", items: movies.slice(40, 60).map(formatItem) });
      rows.push({ id: "top_mov", title: "🏆 Mejor valoradas", ref: "top_mov", items: movies.slice(60, 80).map(formatItem) });
      rows.push({ id: "action_mov", title: "💥 Acción y Aventura", ref: "action_mov", items: movies.slice(80, 100).map(formatItem) });
    }
  } 
  else if (tabId === "series") {
    const series = catalog.filter(i => (i.kind === 'series' || i.kind === 'tv') && getGenre(i) === 'general');
    if (series.length > 0) {
      rows.push({ id: "pop_ser", title: "📺 Series Populares", ref: "pop_ser", items: series.slice(0, 20).map(formatItem) });
      rows.push({ id: "new_ser", title: "✨ Estrenos", ref: "new_ser", items: series.slice(20, 40).map(formatItem) });
      rows.push({ id: "drama_ser", title: "🎭 Drama y Misterio", ref: "drama_ser", items: series.slice(40, 60).map(formatItem) });
    } else {
      rows.push({ id: "no_series", title: "No hay series disponibles", items: [] });
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

// --- ➡️ "VER MÁS" ---
export async function browse(ref, cursor) {
  const catalog = await getCatalog();
  let source = [];

  if (ref.startsWith("trend_mov") || ref.startsWith("cart_mov") || ref.startsWith("pop_mov") || ref.startsWith("top_mov") || ref.startsWith("action_mov")) {
    source = catalog.filter(i => (i.kind === 'movie' || i.kind === 'film') && getGenre(i) === 'general');
  } else if (ref.startsWith("pop_ser") || ref.startsWith("new_ser") || ref.startsWith("drama_ser")) {
    source = catalog.filter(i => (i.kind === 'series' || i.kind === 'tv') && getGenre(i) === 'general');
  } else if (ref.startsWith("anime_top") || ref.startsWith("anime_sub") || ref.startsWith("anime_lat")) {
    source = catalog.filter(i => getGenre(i) === 'anime');
  } else if (ref.startsWith("cartoon_pop") || ref.startsWith("cartoon_kids")) {
    source = catalog.filter(i => getGenre(i) === 'caricatura');
  } else {
    source = catalog;
  }

  const limit = 30;
  const start = cursor ? parseInt(cursor) : 0;
  const end = start + limit;
  const items = source.slice(start, end).map(formatItem);
  const nextCursor = end < source.length ? end.toString() : null;
  return { items, next: nextCursor };
}

// --- 🔍 BÚSQUEDA ---
export async function search(query) {
  const catalog = await getCatalog();
  const q = query.q.toLowerCase();
  return catalog.filter(item => item.name && item.name.toLowerCase().includes(q)).slice(0, 50).map(formatItem);
}

// --- 📝 SINOPSIS (Ahora sí, llamando a TMDB) ---
export async function meta(item) {
  try {
    // Kino tiene un token nativo de TMDB, esto buscará la sinopsis en español
    const tmdb = await kino.tmdb(item.id, item.kind, 'es-ES');
    return {
      title: item.title,
      poster: item.poster,
      overview: tmdb.overview || "Sin sinopsis disponible.",
      genres: tmdb.genres ? tmdb.genres.map(g => g.name) : [],
      rating: tmdb.vote_average || 0
    };
  } catch (e) {
    kino.log("Error obteniendo sinopsis:", e.message);
    return { title: item.title, poster: item.poster, overview: "No se pudo cargar la sinopsis." };
  }
}

// --- 📺 EPISODIOS ---
export async function episodes(ref) {
  const parts = ref.split(':');
  const id = parts[1];
  try {
    const tmdb = await kino.tmdb(id, 'series', 'es-ES');
    const temporadas = tmdb.seasons || [];
    let episodios = [];
    
    for (const temp of temporadas) {
        if (temp.season_number === 0) continue;
        episodios.push({
            id: `${id}:${temp.season_number}`,
            title: temp.name || `Temporada ${temp.season_number}`,
            season: temp.season_number,
            number: temp.season_number,
            overview: temp.overview
        });
    }
    return { episodes: episodios, next: null };
  } catch (e) {
    return { episodes: [], next: null };
  }
}

// --- ▶️ REPRODUCCIÓN ---
export async function resolve(ref) {
  const parts = ref.split(':');
  const type = parts[0]; 
  const id = parts[1];
  try {
    const url = `${ADDON_BASE_URL}/addon/links/${type}/${id}.json`;
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
