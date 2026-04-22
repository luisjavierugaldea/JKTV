/**
 * components/AuthModal.jsx
 * Modal de Login / Registro usando Supabase Auth.
 * Se muestra cuando el usuario intenta acceder a funciones
 * que requieren cuenta (favoritos, historial).
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ onClose }) {
  const { login, register } = useAuth();
  const [mode, setMode]   = useState('login');   // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [pass, setPass]   = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, pass);
        onClose();
      } else {
        await register(email, pass);
        setDone(true);
      }
    } catch (err) {
      setError(err.message || 'Error de autenticación.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 16,
        padding: 36,
        width: '100%',
        maxWidth: 420,
        animation: 'slideUp 0.25s ease',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span style={{ fontSize: '2rem' }}>🎬</span>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginTop: 8 }}>
            {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
            {mode === 'login'
              ? 'Accede para guardar favoritos e historial'
              : 'Crea una cuenta gratuita en tu servidor local'}
          </p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: '2rem', marginBottom: 12 }}>📧</p>
            <p style={{ fontWeight: 700, marginBottom: 8 }}>¡Revisa tu correo!</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Te enviamos un enlace de confirmación a <strong>{email}</strong>
            </p>
            <button className="btn-primary" style={{ marginTop: 20, width: '100%', justifyContent: 'center' }}
              onClick={() => { setMode('login'); setDone(false); }}>
              Volver al login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Correo electrónico
              </label>
              <input
                type="email"
                className="search-input"
                style={{ paddingLeft: 16 }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                autoFocus
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Contraseña
              </label>
              <input
                type="password"
                className="search-input"
                style={{ paddingLeft: 16 }}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && (
              <p style={{
                color: '#f87171', fontSize: '0.84rem',
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 8, padding: '10px 14px',
              }}>⚠️ {error}</p>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ justifyContent: 'center', marginTop: 4, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Cargando…' : mode === 'login' ? 'Entrar' : 'Registrarme'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--text-muted)', fontSize: '0.85rem',
                  cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
