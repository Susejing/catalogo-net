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
    ids: { tmdb: realId } // Necesario para que meta() obtenga la sinopsis
  };
}

// --- 📑 PESTAÑAS (Películas, Series, Anime) ---
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

async function getRowsForTab(tabId) {
  const catalog = await getCatalog();
  const rows = [];

  if (tabId === "movies") {
    const movies = catalog.filter(i => i.kind === 'movie');
    rows.push({ id: "movies_row", title: "Películas Recientes", items: movies.slice(0, 20).map(formatItem) });
  } else if (tabId === "series") {
    const series = catalog.filter(i => i.kind === 'series');
    rows.push({ id: "series_row", title: "Series Recientes", items: series.slice(0, 20).map(formatItem) });
  } else if (tabId === "anime") {
    // Filtro de anime usando el ID de género 16 de TMDB o texto "anime"
    const animes = catalog.filter(i => {
      const g = (i.genres || "").toString().toLowerCase();
      return g.includes('16') || g.includes('anime') || g.includes('animación');
    });
    rows.push({ id: "anime_row", title: "Anime", items: animes.slice(0, 20).map(formatItem) });
  }
  return rows;
}

// --- 🏠 FUNCIÓN HOME (Se usa como respaldo si la sección no está activa) ---
export async function home() {
  return await getRowsForTab("movies");
}

// --- ➡️ BROWSE (Para las pestañas y "Ver más") ---
export async function browse(ref, cursor) {
  const catalog = await getCatalog();
  let itemsSource = [];
  if (ref === "movies") itemsSource = catalog.filter(i => i.kind === 'movie');
  else if (ref === "series") itemsSource = catalog.filter(i => i.kind === 'series');
  else if (ref === "anime") itemsSource = catalog.filter(i => {
    const g = (i.genres || "").toString().toLowerCase();
    return g.includes('16') || g.includes('anime') || g.includes('animación');
  });
  else itemsSource = catalog;

  const limit = 30;
  const start = cursor ? parseInt(cursor) : 0;
  const end = start + limit;
  const items = itemsSource.slice(start, end).map(formatItem);
  const nextCursor = end < itemsSource.length ? end.toString() : null;
  return { items, next: nextCursor };
}

export async function search(query) {
  const catalog = await getCatalog();
  const q = query.q.toLowerCase();
  return catalog.filter(item => item.name && item.name.toLowerCase().includes(q)).slice(0, 50).map(formatItem);
}

// --- 📝 SINOPSIS (Usando meta y el token TMDB de Kino) ---
export async function meta(item) {
  if (!item.ids || !item.ids.tmdb) return {};
  try {
    const tmdb = await kino.tmdb(item.ids.tmdb, item.kind, 'es-ES');
    return {
      overview: tmdb.overview || "Sin sinopsis disponible.",
      genres: tmdb.genres?.map(g => g.name) || []
    };
  } catch (e) {
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
