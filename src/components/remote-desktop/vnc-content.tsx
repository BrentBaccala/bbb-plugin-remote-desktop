import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import VncDisplay from './vnc-display';

interface VncContentProps {
  url: string;
  password: string;
  viewOnly: boolean;
  locked: boolean;
}

export function VncContent({
  url,
  password,
  viewOnly,
  locked,
}: VncContentProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const clipboardTextRef = useRef('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const effectiveViewOnly = viewOnly || locked;

  const transferClipboardText = useCallback(() => {
    if (typeof navigator.clipboard?.readText === 'function') {
      navigator.clipboard.readText().then((text) => {
        if (text !== clipboardTextRef.current) {
          if (playerRef.current?.rfb) {
            playerRef.current.rfb.clipboardPasteFrom(text);
          }
          clipboardTextRef.current = text;
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    document.addEventListener('cut', transferClipboardText);
    document.addEventListener('copy', transferClipboardText);
    return () => {
      document.removeEventListener('copy', transferClipboardText);
      document.removeEventListener('cut', transferClipboardText);
    };
  }, [transferClipboardText]);

  const onFullscreenChange = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const nowFullscreen = document.fullscreenElement === el;
    setIsFullscreen(nowFullscreen);
    if (playerRef.current?.rfb?._handleResize) {
      playerRef.current.rfb._handleResize();
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return () => {};
    el.addEventListener('fullscreenchange', onFullscreenChange);
    return () => el.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [onFullscreenChange]);

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  };

  const handleResize = useCallback(() => {
    if (playerRef.current?.rfb?._handleResize) {
      playerRef.current.rfb._handleResize();
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#000',
      }}
      onFocus={() => transferClipboardText()}
    >
      {/* Fullscreen button overlay */}
      <button
        type="button"
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 10,
          width: 32,
          height: 32,
          padding: 0,
          border: 'none',
          borderRadius: 4,
          background: 'rgba(0, 0, 0, 0.5)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isFullscreen ? (
            <>
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </>
          ) : (
            <>
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </>
          )}
        </svg>
      </button>

      <VncDisplay
        width="100%"
        height="100%"
        background="transparent"
        url={url}
        credentials={{ password: password || '' }}
        onConnect={handleResize}
        onClipboard={(event: any) => {
          if (typeof navigator.clipboard?.writeText === 'function') {
            navigator.clipboard.writeText(event.detail.text).catch(() => {});
          }
        }}
        viewOnly={effectiveViewOnly}
        shared
        scaleViewport
        ref={playerRef}
      />
    </div>
  );
}
