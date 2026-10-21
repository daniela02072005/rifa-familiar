// ============================================================
// CONFIGURACIÓN DE SUPABASE
// ============================================================
// Este archivo se carga ANTES que script.js y admin.js.
// La URL y la clave publishable son públicas por diseño:
// lo que protege los datos son las reglas de seguridad (RLS)
// configuradas en la base de datos de Supabase.

const SUPABASE_URL = "https://zsjhtozulhfccqcgkgur.supabase.co";
const SUPABASE_KEY = "sb_publishable_-xOxn0EbWFVGqPgkFySmxw_7KpIK4Ia";

// Cliente único compartido por la web pública y el panel
const supabaseClient = (typeof window !== "undefined" && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;
