import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import VncDisplay from './vnc-display';

interface VncContentProps {
  url: string;
  password: string;
  viewOnly: boolean;
  onStop: () => void;
  isModerator: boolean;
}

export function VncContent({
  url,
  password,
  viewOnly,
  onStop,
  isModerator,
}: VncContentProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const clipboardTextRef = useRef('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [locked, setLocked] = useState(true);

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

  const buttonStyle: React.CSSProperties = {
    padding: '6px 12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#fff',
  };

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
      {/* Toolbar overlay */}
      <div style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 10,
        display: 'flex',
        gap: '4px',
      }}>
        {!viewOnly && (
          <button
            type="button"
            onClick={() => setLocked(!locked)}
            style={{
              ...buttonStyle,
              background: locked ? '#e74c3c' : '#27ae60',
            }}
            title={locked ? 'Unlock controls (currently view-only)' : 'Lock controls (currently interactive)'}
          >
            {locked ? '\uD83D\uDD12 Locked' : '\uD83D\uDD13 Unlocked'}
          </button>
        )}
        <button
          type="button"
          onClick={toggleFullscreen}
          style={{ ...buttonStyle, background: '#555' }}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? '\u2716 Exit' : '\u26F6 Fullscreen'}
        </button>
        {isModerator && (
          <button
            type="button"
            onClick={onStop}
            style={{ ...buttonStyle, background: '#c0392b' }}
            title="Stop sharing remote desktop"
          >
            \u25A0 Stop
          </button>
        )}
      </div>

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
