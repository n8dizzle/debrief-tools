'use client';

import { useState, useEffect, useCallback } from 'react';
import { CelPost } from '@/lib/supabase';

interface PresentModeProps {
  posts: CelPost[];
  boardTitle: string;
  onClose: () => void;
}

export default function PresentMode({ posts, boardTitle, onClose }: PresentModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fadeIn, setFadeIn] = useState(true);
  const INTERVAL = 8000; // 8 seconds per slide

  const post = posts[currentIndex];

  const goTo = useCallback((index: number) => {
    setFadeIn(false);
    setTimeout(() => {
      setCurrentIndex(index);
      setFadeIn(true);
    }, 300);
  }, []);

  const next = useCallback(() => {
    goTo((currentIndex + 1) % posts.length);
  }, [currentIndex, posts.length, goTo]);

  const prev = useCallback(() => {
    goTo((currentIndex - 1 + posts.length) % posts.length);
  }, [currentIndex, posts.length, goTo]);

  // Auto-advance
  useEffect(() => {
    if (paused || posts.length <= 1) return;
    const timer = setInterval(next, INTERVAL);
    return () => clearInterval(timer);
  }, [paused, next, posts.length]);

  // Keyboard controls
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prev();
          break;
        case 'p':
          setPaused((p) => !p);
          break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [next, prev, onClose]);

  // Enter fullscreen on mount
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  if (!post) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: '#0a0f0c' }}
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 flex gap-1 px-2 pt-2 z-10">
        {posts.map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full overflow-hidden cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.15)' }}
            onClick={() => goTo(i)}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                background: i === currentIndex ? 'var(--christmas-green)' : i < currentIndex ? 'var(--christmas-gold)' : 'transparent',
                width: i === currentIndex ? '100%' : i < currentIndex ? '100%' : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* Board title */}
      <div className="pt-8 pb-2 text-center">
        <h2 className="text-sm font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {boardTitle}
        </h2>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center px-8 pb-4 min-h-0">
        <div
          className="max-w-4xl w-full transition-opacity duration-300"
          style={{ opacity: fadeIn ? 1 : 0 }}
        >
          {/* Text post */}
          {post.content_type === 'text' && (
            <div
              className="rounded-2xl p-12 text-center mx-auto"
              style={{
                background: post.background_color || 'var(--bg-card)',
                maxWidth: '800px',
              }}
            >
              <p
                className="leading-relaxed font-medium"
                style={{
                  fontSize: post.text_content && post.text_content.length < 60 ? '3rem' : post.text_content && post.text_content.length < 150 ? '2rem' : '1.5rem',
                  color: post.background_color && post.background_color !== '#1C231E' ? '#ffffff' : 'var(--text-primary)',
                  lineHeight: 1.3,
                }}
              >
                {post.text_content}
              </p>
            </div>
          )}

          {/* Photo post */}
          {post.content_type === 'photo' && post.media_url && (
            <div className="flex flex-col items-center">
              <img
                src={post.media_url}
                alt=""
                className="max-h-[60vh] rounded-2xl object-contain"
                style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
              />
              {post.text_content && (
                <p className="mt-6 text-xl text-center" style={{ color: 'var(--text-primary)' }}>
                  {post.text_content}
                </p>
              )}
            </div>
          )}

          {/* GIF post */}
          {post.content_type === 'gif' && post.media_url && (
            <div className="flex flex-col items-center">
              <img
                src={post.media_url}
                alt=""
                className="max-h-[60vh] rounded-2xl object-contain"
                style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
              />
              {post.text_content && (
                <p className="mt-6 text-xl text-center" style={{ color: 'var(--text-primary)' }}>
                  {post.text_content}
                </p>
              )}
            </div>
          )}

          {/* Video post */}
          {post.content_type === 'video' && post.media_url && (
            <div className="flex flex-col items-center">
              <video
                src={post.media_url}
                autoPlay
                loop
                muted
                className="max-h-[60vh] rounded-2xl"
                style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
              />
              {post.text_content && (
                <p className="mt-6 text-xl text-center" style={{ color: 'var(--text-primary)' }}>
                  {post.text_content}
                </p>
              )}
            </div>
          )}

          {/* Author */}
          <div className="flex items-center justify-center gap-3 mt-8">
            {post.author_avatar_url ? (
              <img src={post.author_avatar_url} alt="" className="w-10 h-10 rounded-full" />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
                style={{ background: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
              >
                {post.author_name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-lg font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {post.author_name}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="pb-6 flex items-center justify-center gap-4">
        <button
          onClick={prev}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={() => setPaused((p) => !p)}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}
        >
          {paused ? (
            <svg className="w-7 h-7 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          )}
        </button>

        <button
          onClick={next}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className="absolute right-6 bottom-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
          >
            ESC to exit
          </button>
        </div>

        {/* Slide counter */}
        <div className="absolute left-6 bottom-6">
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {currentIndex + 1} / {posts.length}
            {paused && ' (paused)'}
          </span>
        </div>
      </div>
    </div>
  );
}
