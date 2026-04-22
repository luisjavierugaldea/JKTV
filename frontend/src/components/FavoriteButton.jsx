/**
 * components/FavoriteButton.jsx
 * Botón de corazón para agregar/quitar de favoritos.
 * Requiere sesión de Supabase. Si no hay sesión, abre el modal de auth.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { addFavorite, removeFavorite, isFavorite } from '../lib/db';

export default function FavoriteButton({ movie, type, onNeedAuth }) {
  const { user } = useAuth();
  const [liked, setLiked]     = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !movie) return;
    isFavorite(user.id, movie.id).then(setLiked);
  }, [user, movie]);

  async function toggle(e) {
    e.stopPropagation();
    if (!user) { onNeedAuth?.(); return; }
    setLoading(true);
    try {
      if (liked) {
        await removeFavorite(user.id, movie.id);
        setLiked(false);
      } else {
        await addFavorite(user.id, movie, type);
        setLiked(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={liked ? 'Quitar de favoritos' : 'Añadir a favoritos'}
      style={{
        background: liked
          ? 'rgba(229,9,20,0.2)'
          : 'rgba(255,255,255,0.08)',
        border: liked
          ? '1px solid rgba(229,9,20,0.4)'
          : '1px solid rgba(255,255,255,0.12)',
        color: liked ? '#e50914' : 'rgba(255,255,255,0.6)',
        borderRadius: '50%',
        width: 40, height: 40,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '1.1rem',
        transition: 'all 0.2s ease',
        flexShrink: 0,
      }}
    >
      {liked ? '❤️' : '🤍'}
    </button>
  );
}
