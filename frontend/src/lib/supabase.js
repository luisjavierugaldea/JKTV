/**
 * lib/supabase.js
 * Cliente de Supabase.
 * Las credenciales vienen de las variables de entorno de Vite.
 *
 * Si no tienes Supabase configurado, el cliente simplemente no funcionará
 * pero el resto de la app seguirá siendo usable (no rompe).
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  ?? '';
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

// Si no hay credenciales, exportamos un stub que no hace nada
// para que el resto de la app no explote sin Supabase
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
} else {
  console.warn('[Supabase] No se encontraron credenciales (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  console.warn('[Supabase] Las funciones de auth, favoritos e historial no estarán disponibles.');
  // Stub mínimo para no romper imports
  supabase = null;
}

export default supabase;

export const isSupabaseEnabled = Boolean(supabaseUrl && supabaseKey);
