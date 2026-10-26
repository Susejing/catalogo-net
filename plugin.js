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

// Formateo básico (incluye IDs de TMDB para que funcionen las sinopsis)
function formatItem(item) {
  const realId = item.id ? item.id.toString() : item.row.toString(); 
  const k = item.kind === 'tv' ? 'series' : (item.kind || "movie");
  return {
    id: realId,
    title: item.name || "Sin título",
    poster: item.image_path ? `https://image.tmdb.org/t/p/w500${item.image_path}` : "",
    kind: k,
    ref: `${k}:${realId}`,
    ids: { tmdb: realId }
  };
}

// Clasificador (Separa Anime de Caricaturas)
function getGenre(item) {
  const g = (item.genres || "").toString().toLowerCase();
  if (g.includes('16') || g.includes('anime') || g.includes('animación')) {
    if (g.includes('10762') || g.includes('kids') || g.includes('infantil')) return "infantil";
    return "anime";
  }
  return "otros";
}

// --- 📑 PESTAÑAS SUPERIORES ---
export async function section({ tab }) {
  const tabs = [
    { id: "movies", label: "Películas" },
    { id: "series", label: "Series" },
    { id: "anime", label: "Anime" }
  ];
  const chosen = tabs.some(t => t.id === tab) ? tab : "movies";
  return { tabs, tab: chosen, rows: await getRowsForTab(chosen) };
}

// --- 🏠 CONSTRUCCIÓN DE FILAS ---
async function getRowsForTab(tabId) {
  const catalog = await getCatalog();
  const rows = [];

  if (tabId === "movies") {
    const movies = catalog.filter(i => (i.kind === 'movie' || i.kind === 'film') && getGenre(i) === 'otros');
    if (movies.length > 0) {
      rows.push({ id: "trending_movies", title: "🔥 Tendencias", ref: "trending_movies", items: movies.slice(0, 20).map(formatItem) });
      rows.push({ id: "populares_movies", title: "⭐ Populares", ref: "populares_movies", items: movies.slice(20, 40).map(formatItem) });
    }
  } 
  else if (tabId === "series") {
    const series = catalog.filter(i => (i.kind === 'series' || i.kind === 'tv') && getGenre(i) === 'otros');
    if (series.length > 0) {
      rows.push({ id: "populares_series", title: "📺 Series Populares", ref: "populares_series", items: series.slice(0, 20).map(formatItem) });
    } else {
      rows.push({ id: "no_series", title: "No hay series disponibles", items: [] });
    }
  } 
  else if (tabId === "anime") {
    const anime = catalog.filter(i => getGenre(i) === 'anime');
    const infantil = catalog.filter(i => getGenre(i) === 'infantil');
    
    if (anime.length > 0) rows.push({ id: "anime_top", title: "🌸 Anime Destacado", ref: "anime_top", items: anime.slice(0, 20).map(formatItem) });
    if (infantil.length > 0) rows.push({ id: "infantil_row", title: "🧸 Infantil y Caricaturas", ref: "infantil_row", items: infantil.slice(0, 20).map(formatItem) });
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

  if (ref === "trending_movies" || ref === "populares_movies") source = catalog.filter(i => (i.kind === 'movie' || i.kind === 'film') && getGenre(i) === 'otros');
  else if (ref === "populares_series") source = catalog.filter(i => (i.kind === 'series' || i.kind === 'tv') && getGenre(i) === 'otros');
  else if (ref === "anime_top") source = catalog.filter(i => getGenre(i) === 'anime');
  else if (ref === "infantil_row") source = catalog.filter(i => getGenre(i) === 'infantil');
  else source = catalog;

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

// --- 📝 METADATOS Y SINOPSIS (Requerido por Kino) ---
export async function meta(item) {
  // Retornamos la info básica. Kino usará kino.tmdb automáticamente para la sinopsis si está disponible.
  return {
    title: item.title,
    poster: item.poster,
    overview: "" 
  };
}

// --- 📺 EPISODIOS (Para Series) ---
export async function episodes(ref) {
  const parts = ref.split(':');
  const id = parts[1];
  // Como MoviePlus no tiene un endpoint claro de episodios, usamos TMDB como respaldo
  // para que la app al menos muestre la lista de capítulos si es una serie.
  try {
    const tmdb = await kino.tmdb(id, 'series', 'es-ES');
    const temporadas = tmdb.seasons || [];
    let episodios = [];
    
    // Creamos una lista de episodios genérica basada en las temporadas
    for (const temp of temporadas) {
        if (temp.season_number === 0) continue; // Ignorar especiales
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
