import React, { useEffect, useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Plus, Globe, X, Info, Image as ImageIcon, Music2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

/**
 * ⚠️ Setup (einmalig):
 * 1) Supabase Projekt anlegen (https://supabase.com)
 * 2) Storage Buckets erstellen: "images" (public) und "audio" (public)
 * 3) SQL-Tabelle anlegen:
 *    create table if not exists entries (
 *      id uuid primary key default gen_random_uuid(),
 *      country_code text not null,
 *      title text,
 *      info text,
 *      image_url text,
 *      audio_url text,
 *      created_at timestamp with time zone default now()
 *    );
 *
 *    -- RLS aktivieren und einfache, öffentliche Policies (für schnellen Start):
 *    alter table entries enable row level security;
 *    create policy "public can read" on entries for select using (true);
 *    create policy "public can insert" on entries for insert with check (true);
 *    -- (Optional) Später einschränken / Moderation hinzufügen.
 *
 * 4) In Vercel/Netlify Umgebungsvariablen setzen:
 *    VITE_SUPABASE_URL=...  |  VITE_SUPABASE_ANON_KEY=...
 *
 * 5) Deployen. Fertig. 🌍
 */

// 🔑 Supabase Konfiguration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Weltkarte TopoJSON (leichtgewichtiges CDN)
const TOPO_JSON = "https://cdn.jsdelivr.net/npm/react-simple-maps@3.0.0/topojson-maps/world-110m.json";

// 🏳️‍🌈 Flaggen-Emoji aus ISO-A2
function flagEmojiFromISO2(code) {
  if (!code || code.length !== 2) return "";
  const base = 127397; // regional indicator base
  const chars = code.toUpperCase().split("").map(c => String.fromCodePoint(base + c.charCodeAt(0)));
  return chars.join("");
}

// Kleines Helferlein: sicheres Dateinamen-Präfix
function safeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9-_\.]/g, "-");
}

export default function App() {
  const [entries, setEntries] = useState([]); // alle Einträge
  const [loading, setLoading] = useState(true);
  const [activeCountry, setActiveCountry] = useState(null); // { code, name }
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [info, setInfo] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [error, setError] = useState("");

  // Fetch alle Einträge
  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!supabase) { setLoading(false); return; }
      const { data, error } = await supabase.from("entries").select("*").order("created_at", { ascending: false });
      if (!ignore) {
        if (error) console.error(error);
        setEntries(data || []);
        setLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, []);

  // Gefilterte Einträge fürs aktive Land
  const countryEntries = useMemo(() => {
    if (!activeCountry) return [];
    return entries.filter(e => e.country_code === activeCountry.code);
  }, [entries, activeCountry]);

  async function handleUpload(e) {
    e.preventDefault();
    setError("");
    if (!supabase) { setError("Supabase ist nicht konfiguriert."); return; }
    if (!activeCountry) { setError("Bitte zuerst ein Land auswählen."); return; }
    if (!imageFile || !audioFile) { setError("Bitte Bild (2:3) und MP3 auswählen."); return; }

    setUploading(true);
    try {
      const id = uuidv4();
      const base = safeName(`${activeCountry.code}-${title || "upload"}-${id}`);

      // Bild hochladen
      const { data: imgData, error: imgErr } = await supabase.storage
        .from("images")
        .upload(`${base}.${(imageFile.name.split('.').pop() || 'jpg')}`, imageFile, { cacheControl: "3600", upsert: false });
      if (imgErr) throw imgErr;
      const { data: imgPublic } = supabase.storage.from("images").getPublicUrl(imgData.path);

      // Audio hochladen
      const { data: audData, error: audErr } = await supabase.storage
        .from("audio")
        .upload(`${base}.${(audioFile.name.split('.').pop() || 'mp3')}`, audioFile, { cacheControl: "3600", upsert: false });
      if (audErr) throw audErr;
      const { data: audPublic } = supabase.storage.from("audio").getPublicUrl(audData.path);

      // DB-Eintrag
      const { error: dbErr } = await supabase.from("entries").insert({
        country_code: activeCountry.code,
        title: title || null,
        info: info || null,
        image_url: imgPublic.publicUrl,
        audio_url: audPublic.publicUrl,
      });
      if (dbErr) throw dbErr;

      // UI reset + reload
      setTitle(""); setInfo(""); setImageFile(null); setAudioFile(null);
      const { data: refreshed } = await supabase.from("entries").select("*").order("created_at", { ascending: false });
      setEntries(refreshed || []);
      setShowForm(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Globe className="w-6 h-6" />
          <h1 className="text-xl font-semibold">Interaktive Weltkarte: Audio & Bilder hochladen</h1>
          <div className="ml-auto flex items-center gap-2 text-sm">
            {!SUPABASE_URL || !SUPABASE_ANON_KEY ? (
              <span className="px-2 py-1 rounded bg-amber-100 text-amber-800">Hinweis: Supabase Variablen fehlen</span>
            ) : (
              <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800">Verbunden</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid md:grid-cols-5 gap-6">
          {/* Karte */}
          <section className="md:col-span-3 bg-white rounded-2xl shadow p-3">
            <ComposableMap projectionConfig={{ scale: 160 }} className="w-full h-auto">
              <Geographies geography={TOPO_JSON}>
                {({ geographies }) => geographies.map(geo => {
                  const code =
  geo.properties.ISO_A2_EH || // meist vorhanden
  geo.properties.ISO_A2 ||    // fallback
  "";

const name =
  geo.properties.NAME ||       // meist vorhanden
  geo.properties.ADMIN ||      // fallback
  geo.properties.NAME_LONG ||
  "Unbenannt";

                  const isActive = activeCountry?.code === code;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={() => setActiveCountry({ code, name })}
                      style={{
                        default: { fill: isActive ? "#93c5fd" : "#e5e7eb", outline: "none" },
                        hover: { fill: "#bfdbfe", outline: "none" },
                        pressed: { fill: "#93c5fd", outline: "none" },
                      }}
                    />
                  );
                })}
              </Geographies>
            </ComposableMap>
            <div className="text-xs text-gray-500 px-2 pb-2">Tipp: Klicke ein Land an, um Einträge zu sehen oder hinzuzufügen.</div>
          </section>

          {/* Seitenleiste */}
          <aside className="md:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl shadow p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 mt-0.5" />
                <div>
                  <h2 className="font-semibold">So funktioniert's</h2>
                  <ol className="mt-2 list-decimal pl-5 space-y-1 text-sm text-gray-700">
                    <li>Land auf der Karte auswählen.</li>
                    <li>"Eintrag hinzufügen" anklicken.</li>
                    <li>Bild (2:3) und MP3 hochladen, Info ausfüllen.</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Aktives Land</h3>
                <button
                  onClick={() => setShowForm(true)}
                  disabled={!activeCountry}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl shadow bg-blue-600 text-white disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> Eintrag hinzufügen
                </button>
              </div>
              <div className="mt-2 text-sm">
                {activeCountry ? (
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{flagEmojiFromISO2(activeCountry.code)}</span>
                    <span className="font-medium">{activeCountry.name}</span>
                    <span className="text-gray-500">({activeCountry.code})</span>
                  </div>
                ) : (
                  <div className="text-gray-500">Bitte ein Land anklicken.</div>
                )}
              </div>

              <div className="mt-4 space-y-3 max-h-[48vh] overflow-auto pr-2">
                {loading && <div className="text-sm text-gray-500">Lade Einträge ...</div>}
                {!loading && activeCountry && countryEntries.length === 0 && (
                  <div className="text-sm text-gray-500">Noch keine Einträge für dieses Land.</div>
                )}
                <AnimatePresence>
                  {countryEntries.map((e) => (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="border rounded-xl overflow-hidden"
                    >
                      <div className="w-full" style={{ aspectRatio: "2 / 3", background: "#f3f4f6" }}>
                        {e.image_url && (
                          <img src={e.image_url} alt={e.title || "Bild"} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{flagEmojiFromISO2(e.country_code)}</span>
                          <div className="font-medium truncate">{e.title || "Ohne Titel"}</div>
                        </div>
                        {e.info && <p className="text-sm text-gray-700 whitespace-pre-wrap">{e.info}</p>}
                        {e.audio_url ? (
                          <audio src={e.audio_url} controls className="w-full" />
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-gray-500"><Music2 className="w-4 h-4"/>Keine Audio</div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Upload-Dialog */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <motion.div initial={{ y: 20 }} animate={{ y: 0 }} exit={{ y: 20 }} className="w-full max-w-xl bg-white rounded-2xl shadow-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Eintrag hinzufügen</h3>
                <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5"/></button>
              </div>
              <form onSubmit={handleUpload} className="space-y-3">
                <div className="text-sm text-gray-700">Land: {activeCountry?.name} ({activeCountry?.code}) {activeCountry && flagEmojiFromISO2(activeCountry.code)}</div>

                <div>
                  <label className="text-sm font-medium">Titel</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="z.B. Traditioneller Gesang" className="mt-1 w-full rounded-xl border px-3 py-2" />
                </div>

                <div>
                  <label className="text-sm font-medium flex items-center gap-2"><ImageIcon className="w-4 h-4"/>Bild (2:3)</label>
                  <div className="mt-1">
                    <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="w-full" />
                    <p className="text-xs text-gray-500 mt-1">Wird 2:3 angezeigt (optimal z.B. 1000x1500px). Andere Formate werden skaliert/zugeschnitten vom Browser.</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium flex items-center gap-2"><Music2 className="w-4 h-4"/>MP3</label>
                  <div className="mt-1">
                    <input type="file" accept="audio/mpeg,audio/mp3" onChange={e => setAudioFile(e.target.files?.[0] || null)} className="w-full" />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Kurzer Infotext</label>
                  <textarea value={info} onChange={e => setInfo(e.target.value)} rows={4} placeholder="Ein paar Stichwörter oder Sätze" className="mt-1 w-full rounded-xl border px-3 py-2" />
                </div>

                {error && <div className="text-sm text-red-600">{error}</div>}

                <div className="flex items-center justify-between pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 rounded-xl border">Abbrechen</button>
                  <button disabled={uploading} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl shadow bg-blue-600 text-white disabled:opacity-50">
                    <Upload className="w-4 h-4" /> {uploading ? "Lade hoch..." : "Speichern"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="max-w-6xl mx-auto px-4 py-8 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} Interaktive Weltkarte. Bilder & Audios bleiben unter den jeweiligen Rechten der Uploader.
      </footer>
    </div>
  );
}
