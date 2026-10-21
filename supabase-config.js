// ============================================================
// CONFIGURACIÓN DE SUPABASE
// ============================================================
// Este archivo se carga ANTES que script.js y admin.js.
//
// Ambas claves son PÚBLICAS por diseño: lo que protege los datos
// son las reglas de seguridad (RLS) configuradas en la base de datos.
//
// La librería usa LEGACY_ANON_KEY (formato JWT), que es la que
// funciona con el endpoint REST. La publishable queda como
// respaldo por si algún día se cambia.

const SUPABASE_URL = "https://zsjhtozulhfccqcgkgur.supabase.co";

// Clave legacy "anon" (formato JWT) — la que usa la web
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzamh0b3p1bGhmY2NxY2drZ3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1OTEzNzgsImV4cCI6MjEwODE2NzM3OH0.Pp6SasrcAmixTHR4BpdtwJW6gJ62iPGx0cV8oWTSk2I";

// Clave nueva formato "publishable" (respaldo)
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_-xOxn0EbWFVGqPgkFySmxw_7KpIK4Ia";

// La librería elige automáticamente la clave disponible
const SUPABASE_KEY = SUPABASE_ANON_KEY.trim() !== ""
  ? SUPABASE_ANON_KEY.trim()
  : SUPABASE_PUBLISHABLE_KEY;

// Cliente único compartido por la web pública y el panel
const supabaseClient = (typeof window !== "undefined" && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;
