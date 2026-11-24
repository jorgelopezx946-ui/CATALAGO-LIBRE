/* Capa de sincronización con Supabase (solo clave anon pública).
   Si las tablas aún no existen o no hay conexión, la app sigue funcionando
   en modo local sin errores. */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

let sb = null;
export async function getSupabase() {
  if (sb) return sb;
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    console.warn('Supabase no disponible:', e);
  }
  return sb;
}

/* Lee el catálogo público (productos activos de tiendas activas) desde la nube.
   Devuelve [] si no hay tablas todavía o falla la red. */
export async function cloudProducts() {
  const client = await getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from('products')
      .select('id,name,category,description,price,stock,sizes,colors,image_url,images,stores(name,whatsapp)')
      .eq('active', true)
      .limit(500);
    if (error) { console.warn('Supabase products:', error.message); return []; }
    return (data || []).map(r => ({
      id: 'sb-' + r.id,
      owner: r.store_id || 'cloud',
      name: r.name,
      category: r.category || 'Otros',
      price: Number(r.price) || 0,
      stock: Number(r.stock) || 0,
      sizes: r.sizes || '',
      colors: r.colors || '',
      description: r.description || '',
      image: r.image_url || (Array.isArray(r.images) ? r.images[0] : '') || '',
      images: Array.isArray(r.images) ? r.images : (r.image_url ? [r.image_url] : []),
      store: r.stores?.name || 'Tienda',
      whatsapp: r.stores?.whatsapp || '',
    }));
  } catch (e) {
    console.warn('Supabase no accesible:', e);
    return [];
  }
}
