const BASE_URL = "https://victory-incl-elephant-diesel.trycloudflare.com";

// --- Función de Inicio (8 Secciones) ---
export async function home() {
  const rows = [];

  // Función auxiliar para obtener datos de la API
  const fetchRow = async (params, rowTitle, genreSlug) => {
    try {
      const query = new URLSearchParams(params).toString();
      const res = await kino.fetch(`${BASE_URL}/api/titles?${query}&limit=20`);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        rows.push({
          title: rowTitle,
          genre: genreSlug, // Kino usa esto para agrupar
          items: data.items.map(item => ({
            id: item.id.toString(),
            title: item.name,
            poster: `https://image.tmdb.org/t/p/w500${item.image_path}`,
            kind: item.kind,
            ref: `${item.kind}:${item.id}`
          }))
        });
      }
    } catch (e) { kino.log(`Error en ${rowTitle}`, e); }
  };

  // 1-4: Secciones por Idioma (Asumiendo parámetros lang=ja y lang=es)
  await fetchRow({ kind: 'series', lang: 'ja' }, "Animes Subtitulados", "anime-sub");
  await fetchRow({ kind: 'series', lang: 'es' }, "Animes Latino", "anime-latino");
  await fetchRow({ kind: 'movie', lang: 'ja' }, "Películas Subtituladas", "movie-sub");
  await fetchRow({ kind: 'movie', lang: 'es' }, "Películas Latino", "movie-latino");

  // 5-6: Secciones por Novedad
  await fetchRow({ kind: 'series', sort: 'added' }, "Series Recientes", "series-new");
  await fetchRow({ kind: 'movie', sort: 'added' }, "Películas Recientes", "movies-new");

  // 7: Mejor Valoradas
  await fetchRow({ sort: 'vote' }, "Mejor Valoradas", "top-rated");

  // 8: Fila de Géneros (Navegación)
  // Creamos una fila "falsa" que al seleccionar un ítem llamará a browse()
  const genres = ["Acción", "Comedia", "Drama", "Fantasía", "Terror", "Romance", "Ciencia Ficción", "Suspenso"];
  rows.push({
    title: "Explorar por Género",
    items: genres.map(g => ({
      id: `genre:${g}`,
      title: g,
      kind: "series", // Kino lo tratará como un ítem navegable
      ref: `genre:${g}`,
      poster: "" // Sin poster para que se vea como un botón de texto
    }))
  });

  return rows;
}

// --- Función de Navegación (Browse) ---
// Se activa al tocar un género en la fila "Explorar por Género"
export async function browse(ref, cursor) {
  if (!ref.startsWith('genre:')) {
    throw new Error("Referencia de género no válida.");
  }
  const genre = ref.split(':')[1];
  
  // Llamamos a la API con el género seleccionado
  const page = cursor || 1;
  const res = await kino.fetch(`${BASE_URL}/api/titles?genre=${encodeURIComponent(genre)}&page=${page}&limit=30`);
  const data = await res.json();

  return {
    items: data.items.map(item => ({
      id: item.id.toString(),
      title: item.name,
      poster: `https://image.tmdb.org/t/p/w500${item.image_path}`,
      kind: item.kind,
      ref: `${item.kind}:${item.id}`
    })),
    next: data.has_more ? (page + 1).toString() : null
  };
}

// --- Función de Búsqueda ---
export async function search(query) {
  const res = await kino.fetch(`${BASE_URL}/api/titles?q=${encodeURIComponent(query.q)}&limit=30`);
  const data = await res.json();
  return data.items.map(item => ({
    id: item.id.toString(),
    title: item.name,
    poster: `https://image.tmdb.org/t/p/w500${item.image_path}`,
    kind: item.kind,
    ref: `${item.kind}:${item.id}`
  }));
}

// --- Función de Resolución (Reproducción) ---
export async function resolve(ref) {
  // ref viene como "movie:123" o "series:456"
  const [kind, id] = ref.split(':');
  
  // Nota: Ajusta este endpoint según la documentación de la API para obtener detalles.
  // Asumimos que podemos obtener los archivos desde el listado principal si el ID coincide.
  const res = await kino.fetch(`${BASE_URL}/api/titles?kind=${kind}&id=${id}`);
  const data = await res.json();
  const item = data.items ? data.items.find(i => i.id.toString() === id) : null;
  
  if (!item || !item.files || item.files.length === 0) {
    throw new Error("No se encontraron enlaces de video para este título.");
  }

  // Tomamos el primer enlace disponible.
  const videoUrl = item.files[0].plain;
  if (!videoUrl) throw new Error("El enlace de video no está disponible.");
  return { url: videoUrl };
}
