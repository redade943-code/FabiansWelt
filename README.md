# Interaktive Weltkarte – Audio & Bilder (React + Supabase)

Diese App zeigt eine Weltkarte. Nach Klick auf ein Land kannst du ein Bild (2:3), eine MP3 und einen kurzen Infotext hochladen. Alles wird in Supabase gespeichert und erscheint sofort auf der Seite.

## Schnellstart

1. **Supabase vorbereiten**
   - Storage-Buckets: `images` (public) und `audio` (public)
   - Tabelle anlegen (SQL in Supabase SQL Editor ausführen):
     ```sql
     create table if not exists entries (
       id uuid primary key default gen_random_uuid(),
       country_code text not null,
       title text,
       info text,
       image_url text,
       audio_url text,
       created_at timestamp with time zone default now()
     );
     alter table entries enable row level security;
     create policy "public can read" on entries for select using (true);
     create policy "public can insert" on entries for insert with check (true);
     ```

2. **Umgebungsvariablen setzen**
   - `.env` erstellen (oder in Vercel/Netlify setzen)
     ```env
     VITE_SUPABASE_URL=deine-url
     VITE_SUPABASE_ANON_KEY=dein-anon-key
     ```

3. **Lokal starten**
   ```bash
   npm install
   npm run dev
   ```

4. **Build & Deploy**
   ```bash
   npm run build
   ```
   Den `dist/`-Ordner auf einen Static Host hochladen – oder Repository bei Vercel importieren.

> Hinweis: Offene Policies erlauben jedem Uploads. Für eine öffentliche Seite später Auth/Moderation ergänzen.
