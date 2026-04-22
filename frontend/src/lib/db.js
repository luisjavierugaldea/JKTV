/**
 * lib/db.js
 * Helpers para interactuar con Supabase DB.
 *
 * Tablas requeridas en Supabase (SQL en README):
 *
 *   favorites (
 *     id          uuid primary key default gen_random_uuid(),
 *     user_id     uuid references auth.users not null,
 *     tmdb_id     text not null,
 *     media_type  text not null,  -- 'movie' | 'tv'
 *     title       text not null,
 *     poster_path text,
 *     year        text,
 *     created_at  timestamptz default now()
 *   );
 *
 *   watch_history (
 *     id          uuid primary key default gen_random_uuid(),
 *     user_id     uuid references auth.users not null,
 *     tmdb_id     text not null,
 *     media_type  text not null,
 *     title       text not null,
 *     poster_path text,
 *     year        text,
 *     progress_pct float default 0,   -- % de reproducción 0-100
 *     watched_at  timestamptz default now()
 *   );
 *
 * RLS: Habilitar Row Level Security y crear políticas para user_id = auth.uid()
 */

import supabase, { isSupabaseEnabled } from './supabase';

// ── Favoritos ─────────────────────────────────────────────────────────────────

export async function getFavorites(userId) {
  if (!isSupabaseEnabled || !supabase) return [];
  const { data, error } = await supabase
    .from('favorites')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('[DB] getFavorites:', error.message); return []; }
  return data;
}

export async function addFavorite(userId, movie, mediaType) {
  if (!isSupabaseEnabled || !supabase) return null;
  const { data, error } = await supabase
    .from('favorites')
    .upsert({
      user_id:    userId,
      tmdb_id:    String(movie.id),
      media_type: mediaType,
      title:      mediaType === 'tv' ? movie.name : movie.title,
      poster_path: movie.poster_path ?? null,
      year:       (mediaType === 'tv' ? movie.first_air_date : movie.release_date)?.split('-')[0] ?? null,
    }, { onConflict: 'user_id,tmdb_id' });
  if (error) console.error('[DB] addFavorite:', error.message);
  return data;
}

export async function removeFavorite(userId, tmdbId) {
  if (!isSupabaseEnabled || !supabase) return;
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('tmdb_id', String(tmdbId));
  if (error) console.error('[DB] removeFavorite:', error.message);
}

export async function isFavorite(userId, tmdbId) {
  if (!isSupabaseEnabled || !supabase) return false;
  const { data } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('tmdb_id', String(tmdbId))
    .single();
  return Boolean(data);
}

// ── Historial de reproducción ─────────────────────────────────────────────────

export async function getWatchHistory(userId, limit = 20) {
  if (!isSupabaseEnabled || !supabase) return [];
  const { data, error } = await supabase
    .from('watch_history')
    .select('*')
    .eq('user_id', userId)
    .order('watched_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('[DB] getWatchHistory:', error.message); return []; }
  return data;
}

export async function upsertWatchHistory(userId, movie, mediaType, progressPct = 0) {
  if (!isSupabaseEnabled || !supabase) return;
  const { error } = await supabase
    .from('watch_history')
    .upsert({
      user_id:      userId,
      tmdb_id:      String(movie.tmdbId ?? movie.id),
      media_type:   mediaType,
      title:        movie.title,
      poster_path:  movie.posterPath ?? movie.poster_path ?? null,
      year:         movie.year ?? null,
      progress_pct: Math.round(progressPct),
      watched_at:   new Date().toISOString(),
    }, { onConflict: 'user_id,tmdb_id' });
  if (error) console.error('[DB] upsertWatchHistory:', error.message);
}
