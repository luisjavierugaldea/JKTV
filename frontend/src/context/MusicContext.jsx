import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const MusicContext = createContext(null);

export function MusicProvider({ children }) {
  const [queue, setQueue] = useState([]);          // Lista de canciones
  const [currentIndex, setCurrentIndex] = useState(-1); // Índice actual
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const audioRef = useRef(new Audio());

  const currentSong = currentIndex >= 0 ? queue[currentIndex] : null;

  // Sync volume
  useEffect(() => {
    audioRef.current.volume = volume;
  }, [volume]);

  // Cleanup on unmount
  useEffect(() => {
    const audio = audioRef.current;
    return () => { audio.pause(); audio.src = ''; };
  }, []);

  const fetchAndPlay = useCallback(async (song, newQueue, idx) => {
    const audio = audioRef.current;
    audio.pause();
    setLoadingAudio(true);
    setIsPlaying(false);
    try {
      // Usamos el endpoint /stream/ que actúa como proxy para evitar bloqueos de Google
      const streamUrl = `${API_BASE_URL}/music/stream/${song.id}`;
      audio.src = streamUrl;
      audio.volume = volume;
      await audio.play();
      setIsPlaying(true);
      if (newQueue) setQueue(newQueue);
      setCurrentIndex(idx);
    } catch (err) {
      console.error('[Music] Error reproduciendo:', err.message);
    } finally {
      setLoadingAudio(false);
    }
  }, [volume]);

  // Time tracking
  useEffect(() => {
    const audio = audioRef.current;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      // Auto-next
      setCurrentIndex(prev => {
        const next = prev + 1;
        if (next < queue.length) {
          fetchAndPlay(queue[next], null, next);
          return next;
        }
        setIsPlaying(false);
        return prev;
      });
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, [queue, fetchAndPlay]);

  const playSong = useCallback((song, allSongs = []) => {
    const q = allSongs.length > 0 ? allSongs : [song];
    const idx = q.findIndex(s => s.id === song.id);
    fetchAndPlay(song, q, idx >= 0 ? idx : 0);
  }, [fetchAndPlay]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio.src) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play(); setIsPlaying(true); }
  }, [isPlaying]);

  const seek = useCallback((time) => {
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const playNext = useCallback(() => {
    const next = currentIndex + 1;
    if (next < queue.length) fetchAndPlay(queue[next], null, next);
  }, [currentIndex, queue, fetchAndPlay]);

  const playPrev = useCallback(() => {
    const prev = currentIndex - 1;
    if (prev >= 0) fetchAndPlay(queue[prev], null, prev);
  }, [currentIndex, queue, fetchAndPlay]);

  return (
    <MusicContext.Provider value={{
      queue, currentSong, currentIndex, isPlaying, currentTime, duration,
      volume, loadingAudio, playSong, togglePlay, seek, playNext, playPrev, setVolume
    }}>
      {children}
    </MusicContext.Provider>
  );
}

export const useMusic = () => useContext(MusicContext);
