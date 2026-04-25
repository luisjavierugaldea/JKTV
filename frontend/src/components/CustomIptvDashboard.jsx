import { useState, useEffect } from 'react';
import IptvDashboard from './IptvDashboard';
import { API_BASE_URL } from '../config';

export default function CustomIptvDashboard({ onPlay }) {
    const [credentials, setCredentials] = useState(null);
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Form states
    const [serverUrl, setServerUrl] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rawM3u, setRawM3u] = useState('');
    const [isM3uMode, setIsM3uMode] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('jktv_custom_iptv');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setCredentials(parsed);
                fetchCustomChannels(parsed.url);
            } catch (e) {
                localStorage.removeItem('jktv_custom_iptv');
            }
        }
    }, []);

    const fetchCustomChannels = async (url) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/iptv/channels?customUrl=${encodeURIComponent(url)}`);
            const data = await res.json();
            if (data.success) {
                setChannels(data.data);
            } else {
                setError(data.error?.message || 'Error cargando lista personal.');
            }
        } catch (err) {
            setError('Error de conexión al procesar la lista.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = (e) => {
        e.preventDefault();
        let finalUrl = '';
        if (isM3uMode) {
            if (!rawM3u) return setError('Ingresa una URL M3U válida.');
            finalUrl = rawM3u;
        } else {
            if (!serverUrl || !username || !password) return setError('Completa todos los campos Xtream.');
            const cleanUrl = serverUrl.replace(/\/$/, '');
            finalUrl = `${cleanUrl}/get.php?username=${username}&password=${password}&type=m3u_plus&output=m3u8`;
        }

        const creds = { url: finalUrl, date: new Date().toISOString() };
        localStorage.setItem('jktv_custom_iptv', JSON.stringify(creds));
        setCredentials(creds);
        fetchCustomChannels(finalUrl);
    };

    const handleClear = () => {
        if (window.confirm('¿Seguro que deseas borrar tu lista personal?')) {
            localStorage.removeItem('jktv_custom_iptv');
            setCredentials(null);
            setChannels([]);
        }
    };

    if (credentials && channels.length > 0) {
        return (
            <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 100 }}>
                    <button 
                        onClick={handleClear}
                        style={{ background: 'rgba(255,50,50,0.2)', color: '#ff4d4d', border: '1px solid #ff4d4d', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                        🗑️ Borrar Lista
                    </button>
                </div>
                <IptvDashboard 
                    channels={channels} 
                    loading={loading} 
                    error={error} 
                    onRemoveChannel={() => {}} 
                />
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 600, margin: '60px auto', padding: '30px', background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '10px' }}>⚙️ Mi Lista Personal IPTV</h2>
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', marginBottom: '30px', fontSize: '0.9rem' }}>
                Conecta tu cuenta privada de Xtream Codes o añade un enlace M3U directo. Tus datos solo se guardan en este dispositivo.
            </p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <button 
                    onClick={() => setIsM3uMode(false)}
                    style={{ flex: 1, padding: '10px', background: !isM3uMode ? '#00e676' : 'rgba(255,255,255,0.05)', color: !isM3uMode ? '#000' : '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}
                >
                    Xtream Codes API
                </button>
                <button 
                    onClick={() => setIsM3uMode(true)}
                    style={{ flex: 1, padding: '10px', background: isM3uMode ? '#00e676' : 'rgba(255,255,255,0.05)', color: isM3uMode ? '#000' : '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}
                >
                    URL M3U Directa
                </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                {!isM3uMode ? (
                    <>
                        <div>
                            <label style={{ display: 'block', marginBottom: 5, fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>URL del Servidor (Ej: http://tv.diablotv.net:8080)</label>
                            <input 
                                type="url" required 
                                value={serverUrl} onChange={e => setServerUrl(e.target.value)}
                                style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'white' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 5, fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>Usuario</label>
                            <input 
                                type="text" required 
                                value={username} onChange={e => setUsername(e.target.value)}
                                style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'white' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 5, fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>Contraseña</label>
                            <input 
                                type="password" required 
                                value={password} onChange={e => setPassword(e.target.value)}
                                style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'white' }}
                            />
                        </div>
                    </>
                ) : (
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>URL de la lista M3U</label>
                        <input 
                            type="url" required 
                            value={rawM3u} onChange={e => setRawM3u(e.target.value)}
                            placeholder="https://ejemplo.com/lista.m3u"
                            style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'white' }}
                        />
                    </div>
                )}

                {error && <div style={{ color: '#ff4d4d', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}

                <button 
                    type="submit" disabled={loading}
                    style={{ marginTop: 10, padding: '14px', background: '#e50914', color: 'white', border: 'none', borderRadius: 8, fontSize: '1rem', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
                >
                    {loading ? 'Cargando Canales...' : 'Conectar y Cargar Lista'}
                </button>
            </form>
        </div>
    );
}
