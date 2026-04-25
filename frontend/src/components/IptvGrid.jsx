import { useState } from 'react';

function IptvCard({ channel, onClick }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      onClick={() => onClick(channel)}
      style={{
        background: 'var(--bg-card)',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        position: 'relative'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      }}
    >
      <div style={{ padding: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', height: 120, background: 'rgba(255,255,255,0.02)' }}>
        <img
          src={imgError ? 'https://via.placeholder.com/150?text=TV' : channel.logo}
          alt={channel.displayName}
          onError={() => setImgError(true)}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      </div>
      <div style={{ padding: '12px 16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {channel.displayName}
        </h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 4 }}>
            {channel.group}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#00e676', fontWeight: 600 }}>
            {channel.urls.length} links
          </span>
        </div>
      </div>
    </div>
  );
}

const SKELETON_COUNT = 12;

function SkeletonGrid() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: 20,
    }}>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 200, borderRadius: 12 }} />
      ))}
    </div>
  );
}

export default function IptvGrid({ channels, loading, error, onChannelClick }) {
  if (loading) return <SkeletonGrid />;

  if (error) {
    return (
      <div style={{
        textAlign: 'center', padding: '60px 20px',
        color: 'var(--text-muted)',
      }}>
        <p style={{ fontSize: '2rem', marginBottom: 12 }}>😕</p>
        <p style={{ fontSize: '1rem' }}>{error}</p>
      </div>
    );
  }

  if (!channels || channels.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '60px 20px',
        color: 'var(--text-muted)',
      }}>
        <p style={{ fontSize: '2.5rem', marginBottom: 12 }}>📡</p>
        <p style={{ fontSize: '1rem' }}>No se encontraron canales.</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: 20,
    }}>
      {channels.map((channel) => (
        <IptvCard
          key={channel.id}
          channel={channel}
          onClick={onChannelClick}
        />
      ))}
    </div>
  );
}
