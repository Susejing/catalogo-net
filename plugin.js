const BASE_URL = "https://raw.githubusercontent.com/Susejing/catalogo-net/main/";
const ADDON_BASE_URL = "https://victory-incl-elephant-diesel.trycloudflare.com";
const YANDEX_API = "https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=";

const ARCHIVOS = [
  "ligero.001.json",
  "ligero.002.json",
  "ligero.003.json",
  "ligero.004.json",
  "ligero.005.json"
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
    } catch (e) {
      kino.log("Error cargando " + archivo + ": " + e.message);
    }
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

export async function home() {
  try {
    const catalog = await getCatalog();
    const rows = [];
    const movies = catalog.filter(i => i.kind === 'movie');
    const series = catalog.filter(i => i.kind === 'series');

    rows.push({
      id: "status",
      title: `✅ Catálogo cargado (${catalog.length} títulos)`,
      items: movies.slice(0, 15).map(formatItem)
    });
    if (movies.length > 0) rows.push({ id: "movies", title: "Películas Recientes", items: movies.slice(15, 45).map(formatItem) });
    if (series.length > 0) rows.push({ id: "series", title: "Series Recientes", items: series.slice(0, 30).map(formatItem) });

    return rows;
  } catch (error) {
    return [{ id: "error", title: "❌ Error al cargar: " + error.message, items: [] }];
  }
}

export async function search(query) {
  const catalog = await getCatalog();
  const q = query.q.toLowerCase();
  return catalog.filter(item => item.name && item.name.toLowerCase().includes(q)).slice(0, 50).map(formatItem);
}

export async function browse() { return { items: [], next: null }; }

// --- 🚀 RESOLUCIÓN DIRECTA (SIN DEPENDER DEL ADDON DE NUVIO) ---
export async function resolve(ref) {
  const parts = ref.split(':');
  const type = parts[0]; // "movie" o "series"
  const id = parts[1];

  try {
    // 1. Pedimos la lista de enlaces a la API de MoviePlus/CATALOG//NET
    const url = `${ADDON_BASE_URL}/addon/links/${type}/${id}.json`;
    const res = await kino.fetch(url);
    
    if (!res.ok) {
      throw new Error(`No se encontraron enlaces en el servidor (HTTP ${res.status})`);
    }

    const links = await res.json();
    if (!links || links.length === 0) {
      throw new Error("No hay enlaces de Yandex disponibles para este título.");
    }

    // 2. Tomamos el primer enlace y lo resolvemos en Yandex
    const firstLink = links[0];
    const yandexRes = await kino.fetch(YANDEX_API + encodeURIComponent(firstLink.share));
    
    if (!yandexRes.ok) {
      throw new Error("Yandex rechazó la solicitud de descarga (enlace caducado o límite superado).");
    }

    const yandexData = await yandexRes.json();
    if (!yandexData || !yandexData.href) {
      throw new Error("No se pudo obtener el enlace directo de Yandex.");
    }

    // 3. Devolvemos la URL directa a Kino
    return { url: yandexData.href };

  } catch (error) {
    kino.log("Error en resolve:", error.message);
    // Lanzamos el error para que Kino muestre el mensaje en pantalla
    throw new Error(error.message);
  }
}
