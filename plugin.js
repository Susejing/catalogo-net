const BASE_URL = "https://raw.githubusercontent.com/Susejing/catalogo-net/main/";
const ADDON_BASE_URL = "https://victory-incl-elephant-diesel.trycloudflare.com";
const YANDEX_API = "https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=";

const ARCHIVOS = [
  "ligero.001.json", "ligero.002.json", "ligero.003.json", "ligero.004.json", "ligero.005.json"
];

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
    ref: `${item.kind || "movie"}:${realId}`
  };
}

// --- 🏠 FUNCIÓN DE INICIO (LAS SECCIONES) ---
export async function home() {
  try {
    const catalog = await getCatalog();
    const rows = [];

    // Filtros
    const movies = catalog.filter(i => i.kind === 'movie');
    const series = catalog.filter(i => i.kind === 'series');
    
    // Filtrar Animes (por género)
    const animes = catalog.filter(i => (i.genres || "").toLowerCase().includes('animación') || (i.genres || "").toLowerCase().includes('anime'));
    
    // Filtrar Latino (por resolutions)
    const latino = catalog.filter(i => (i.resolutions || "").toUpperCase().includes('LAT'));
    
    // Filtrar Subtitulado (por resolutions)
    const sub = catalog.filter(i => (i.resolutions || "").toUpperCase().includes('SUB'));

    // 1. Películas Recientes
    if (movies.length > 0) {
      rows.push({ id: "movies", title: "Películas Recientes", items: movies.slice(0, 20).map(formatItem) });
    }
    // 2. Series Recientes
    if (series.length > 0) {
      rows.push({ id: "series", title: "Series Recientes", items: series.slice(0, 20).map(formatItem) });
    }
    // 3. Animes
    if (animes.length > 0) {
      rows.push({ id: "animes", title: "Animes y Animación", items: animes.slice(0, 20).map(formatItem) });
    }
    // 4. Audio Latino
    if (latino.length > 0) {
      rows.push({ id: "latino", title: "Películas y Series en Latino", items: latino.slice(0, 20).map(formatItem) });
    }
    // 5. Subtitulado
    if (sub.length > 0) {
      rows.push({ id: "sub", title: "Subtitulado", items: sub.slice(0, 20).map(formatItem) });
    }

    return rows;
  } catch (error) {
    return [{ id: "error", title: "❌ Error al cargar: " + error.message, items: [] }];
  }
}

// --- ➡️ FUNCIÓN DE VER MÁS (PAGINACIÓN) ---
export async function browse(ref, cursor) {
  const catalog = await getCatalog();
  const limit = 30;
  
  // Determinamos qué lista usar según la fila de donde venimos
  let itemsSource = [];
  if (ref === "movies") itemsSource = catalog.filter(i => i.kind === 'movie');
  else if (ref === "series") itemsSource = catalog.filter(i => i.kind === 'series');
  else if (ref === "animes") itemsSource = catalog.filter(i => (i.genres || "").toLowerCase().includes('animación') || (i.genres || "").toLowerCase().includes('anime'));
  else if (ref === "latino") itemsSource = catalog.filter(i => (i.resolutions || "").toUpperCase().includes('LAT'));
  else if (ref === "sub") itemsSource = catalog.filter(i => (i.resolutions || "").toUpperCase().includes('SUB'));
  else return { items: [], next: null };

  // Calculamos la página actual
  const start = cursor ? parseInt(cursor) : 0;
  const end = start + limit;

  const items = itemsSource.slice(start, end).map(formatItem);
  // Si hay más títulos, devolvemos el cursor para la siguiente página
  const nextCursor = end < itemsSource.length ? end.toString() : null;

  return { items, next: nextCursor };
}

// --- 🔍 FUNCIÓN DE BÚSQUEDA ---
export async function search(query) {
  const catalog = await getCatalog();
  const q = query.q.toLowerCase();
  return catalog.filter(item => item.name && item.name.toLowerCase().includes(q)).slice(0, 50).map(formatItem);
}

// --- ▶️ FUNCIÓN DE REPRODUCCIÓN (LA QUE YA FUNCIONA) ---
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
