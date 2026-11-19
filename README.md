# Conciertos

Web app (instalable en el iPhone) para seguir artistas y grupos y ver sus conciertos en las zonas que elija cada uno.

- **App:** HTML + JavaScript sin compilación, publicada con GitHub Pages.
- **Datos:** Supabase (mismo proyecto que Findes). Tablas `conc_*`; usuarios de `members` (Ramón e Irene).
- **Fotos:** Deezer (automático) o subidas al bucket `conciertos` de Supabase Storage.
- **Búsqueda diaria:** tarea programada en Claude (fase 2), resultados vía el repo privado `conciertos-datos`.
- **Esquema:** `supabase/schema.sql`.
