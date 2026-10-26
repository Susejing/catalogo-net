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
  return {
    id: realId,
    title: item.name || "Sin título",
    poster: item.image_path ? `https://image.tmdb.org/t/p/w500${item.image_path}` : "",
    kind: item.kind || "movie",
    ref: `${item.kind || "movie"}:${realId}`,
    ids: { tmdb: realId } // Necesario para que Kino busque la sinopsis
  };
}

// Verifica si es anime (ID de género 16 de TMDB o texto "anime")
function isAnime(item) {
  const g = (item.genres || "").toString().toLowerCase();
  return g.includes('16') || g.includes('anime') || g.includes('animación');
}

// --- 📑 FUNCIÓN DE PESTAÑAS ---
export async function section({ tab }) {
  const tabs = [
    { id: "movies", label: "Películas" },
    { id: "series", label: "Series" },
    { id: "anime", label: "Anime" }
  ];
  const chosen = tabs.some(t => t.id === tab) ? tab : "movies";
  
  return {
    tabs,
    tab: chosen,
    rows: await getRowsForTab(chosen)
  };
}

// --- 🏠 GENERADOR DE FILAS POR PESTAÑA ---
async function getRowsForTab(tabId) {
  const catalog = await getCatalog();
  const rows = [];

  if (tabId === "movies") {
    const movies = catalog.filter(i => i.kind === 'movie');
    // Simulamos diferentes categorías con los mismos datos
    rows.push({ id: "trending_movies", title: "🔥 Tendencias de la semana", ref: "trending_movies", items: movies.slice(0, 20).map(formatItem) });
    rows.push({ id: "cartelera_movies", title: "🎬 En cartelera", ref: "cartelera_movies", items: movies.slice(20, 40).map(formatItem) });
    rows.push({ id: "populares_movies", title: "⭐ Populares", ref: "populares_movies", items: movies.slice(40, 60).map(formatItem) });
  } 
  else if (tabId === "series") {
    const series = catalog.filter(i => i.kind === 'series');
    rows.push({ id: "populares_series", title: "📺 Series Populares", ref: "populares_series", items: series.slice(0, 20).map(formatItem) });
    rows.push({ id: "nuevas_series", title: "✨ Nuevas Series", ref: "nuevas_series", items: series.slice(20, 40).map(formatItem) });
  } 
  else if (tabId === "anime") {
    const animes = catalog.filter(i => isAnime(i));
    rows.push({ id: "anime_top", title: "🌸 Anime Destacado", ref: "anime_top", items: animes.slice(0, 20).map(formatItem) });
    rows.push({ id: "anime_lat", title: "🇲🇽 Anime en Latino", ref: "anime_lat", items: animes.filter(i => (i.resolutions || "").toUpperCase().includes('LAT')).slice(0, 20).map(formatItem) });
    rows.push({ id: "anime_sub", title: "🇯🇵 Anime Subtitulado", ref: "anime_sub", items: animes.filter(i => (i.resolutions || "").toUpperCase().includes('SUB') || (i.resolutions || "").toUpperCase().includes('JPN')).slice(0, 20).map(formatItem) });
  }
  return rows;
}

// --- 🏠 FUNCIÓN HOME (Respaldo) ---
export async function home() {
  return await getRowsForTab("movies");
}

// --- ➡️ BROWSE (Paginación para "Ver Más") ---
export async function browse(ref, cursor) {
  const catalog = await getCatalog();
  let source = [];

  // Determinamos qué lista usar según el ref de la fila
  if (ref === "trending_movies" || ref === "cartelera_movies" || ref === "populares_movies") {
    source = catalog.filter(i => i.kind === 'movie');
  } else if (ref === "populares_series" || ref === "nuevas_series") {
    source = catalog.filter(i => i.kind === 'series');
  } else if (ref === "anime_top") {
    source = catalog.filter(i => isAnime(i));
  } else if (ref === "anime_lat") {
    source = catalog.filter(i => isAnime(i) && (i.resolutions || "").toUpperCase().includes('LAT'));
  } else if (ref === "anime_sub") {
    source = catalog.filter(i => isAnime(i) && ((i.resolutions || "").toUpperCase().includes('SUB') || (i.resolutions || "").toUpperCase().includes('JPN')));
  } else {
    source = catalog; // Fallback
  }

  // Kino pasa el cursor como un número de página o offset
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

// --- 📝 SINOPSIS NATIVA (Sin API Key) ---
export async function meta(item) {
  // Kino obtiene la sinopsis directamente usando su token interno
  if (!item.ids || !item.ids.tmdb) return {};
  
  try {
    // Obtenemos los detalles de TMDB en español
    const tmdb = await kino.tmdb(item.ids.tmdb, item.kind, 'es-ES');
    return {
      overview: tmdb.overview || "Sin sinopsis disponible.",
      genres: tmdb.genres ? tmdb.genres.map(g => g.name) : []
    };
  } catch (e) {
    kino.log("Error obteniendo sinopsis:", e.message);
    return {};
  }
}

// --- ▶️ REPRODUCCIÓN (Yandex) ---
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
