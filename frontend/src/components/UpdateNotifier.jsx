import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

/**
 * UpdateNotifier Component
 * Verifica si hay una nueva versión de la app disponible y notifica al usuario
 */
const UpdateNotifier = () => {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('1.0.0'); // 👈 Sincroniza con package.json

  useEffect(() => {
    checkForUpdates();
    
    // Verificar actualizaciones cada 6 horas
    const interval = setInterval(() => {
      checkForUpdates();
    }, 6 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const checkForUpdates = async () => {
    try {
      // 🌐 Solo funciona en APK, no en web
      const isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
      if (!isCapacitor) {
        console.log('🌐 UpdateNotifier deshabilitado: Solo funciona en APK Android');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/app-version`);
      if (!response.ok) return;

      const data = await response.json();
      
      // Obtener versión actual instalada
      const installedVersion = await getCurrentAppVersion();
      setCurrentVersion(installedVersion);

      // Comparar versiones
      if (compareVersions(data.version, installedVersion) > 0) {
        setUpdateInfo(data);
        
        // No mostrar modal si el usuario ya lo cerró en esta sesión
        const dismissed = sessionStorage.getItem('update-dismissed');
        if (!dismissed) {
          setShowModal(true);
        }
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  };

  const getCurrentAppVersion = async () => {
    try {
      // Intentar obtener versión de Capacitor (si está en Android)
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        const info = await window.Capacitor.Plugins.App.getInfo();
        return info.version;
      }
    } catch (err) {
      console.log('No se pudo obtener versión de Capacitor:', err);
    }
    
    // Fallback: versión hardcodeada (actualizar cuando cambies package.json)
    return '1.0.0'; // 👈 ACTUALIZA ESTO cuando incrementes la versión
  };

  const compareVersions = (v1, v2) => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    
    return 0;
  };

  const handleDownload = () => {
    if (updateInfo && updateInfo.downloadUrl) {
      // Si estamos en Android con Capacitor, usar Browser nativo
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
        window.Capacitor.Plugins.Browser.open({ url: updateInfo.downloadUrl });
      } else {
        // Web: abrir en nueva pestaña
        window.open(updateInfo.downloadUrl, '_blank');
      }
    }
  };

  const handleDismiss = () => {
    setShowModal(false);
    // Recordar que el usuario cerró el modal (solo durante esta sesión)
    sessionStorage.setItem('update-dismissed', 'true');
  };

  const handleForceUpdate = () => {
    // Si la actualización es obligatoria, no permitir cerrar
    handleDownload();
  };

  if (!showModal || !updateInfo) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
        borderRadius: '16px',
        padding: '2rem',
        maxWidth: '500px',
        width: '100%',
        border: '2px solid #3b82f6',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
        position: 'relative',
      }}>
        {/* Icono de actualización */}
        <div style={{
          fontSize: '4rem',
          textAlign: 'center',
          marginBottom: '1rem',
        }}>
          🚀
        </div>

        {/* Título */}
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: '#fff',
          textAlign: 'center',
          marginBottom: '0.5rem',
        }}>
          {updateInfo.forceUpdate ? '⚠️ Actualización Obligatoria' : '✨ Nueva Versión Disponible'}
        </h2>

        {/* Versiones */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
          color: '#9ca3af',
        }}>
          <div>
            <span style={{ color: '#ef4444' }}>Actual:</span> v{currentVersion}
          </div>
          <div>
            <span style={{ color: '#10b981' }}>Nueva:</span> v{updateInfo.version}
          </div>
        </div>

        {/* Notas de versión */}
        {updateInfo.releaseNotes && updateInfo.releaseNotes.length > 0 && (
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#3b82f6',
              marginBottom: '0.75rem',
            }}>
              📋 Novedades:
            </h3>
            <ul style={{
              margin: 0,
              paddingLeft: '1.25rem',
              color: '#e5e7eb',
              fontSize: '0.9rem',
              lineHeight: '1.6',
            }}>
              {updateInfo.releaseNotes.map((note, index) => (
                <li key={index} style={{ marginBottom: '0.5rem' }}>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Fecha de lanzamiento */}
        {updateInfo.releaseDate && (
          <div style={{
            textAlign: 'center',
            fontSize: '0.85rem',
            color: '#6b7280',
            marginBottom: '1.5rem',
          }}>
            📅 Lanzamiento: {new Date(updateInfo.releaseDate).toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        )}

        {/* Botones */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          flexDirection: updateInfo.forceUpdate ? 'column' : 'row',
        }}>
          <button
            onClick={updateInfo.forceUpdate ? handleForceUpdate : handleDownload}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
            }}
          >
            {updateInfo.forceUpdate ? '🔒 Actualizar Ahora (Obligatorio)' : '⬇️ Descargar Actualización'}
          </button>

          {!updateInfo.forceUpdate && (
            <button
              onClick={handleDismiss}
              style={{
                flex: 1,
                background: 'transparent',
                color: '#9ca3af',
                border: '2px solid #374151',
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#6b7280';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#374151';
                e.currentTarget.style.color = '#9ca3af';
              }}
            >
              ⏭️ Más Tarde
            </button>
          )}
        </div>

        {/* Warning para actualizaciones obligatorias */}
        {updateInfo.forceUpdate && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            fontSize: '0.85rem',
            color: '#fca5a5',
            textAlign: 'center',
          }}>
            ⚠️ Esta actualización es necesaria para continuar usando la app
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdateNotifier;
