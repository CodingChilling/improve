// Configuración de la cuenta en línea (Supabase). La URL y la clave publicable son públicas:
// lo que puede hacer cada usuario lo deciden las reglas de la base de datos (RLS), no esta clave.
// Aquí no va nunca una clave «service_role» ni ningún otro secreto.
// Con los dos valores vacíos, Ascenso funciona solo en este dispositivo, sin cuenta.
window.ASCENSO_CONFIG = {
  supabaseUrl: "https://bmqnjwljypqhhitbglbs.supabase.co",
  supabaseClave: "sb_publishable_c3WkkuQR0n1QZbxxnfyz8g_migpWOSO"
};
