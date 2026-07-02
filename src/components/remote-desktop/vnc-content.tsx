import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import VncDisplay from './vnc-display';

interface VncContentProps {
  url: string;
  password: string;
  viewOnly: boolean;
  locked: boolean;
  clipboardEnabled: boolean;
  reconnectCounter: number;
  onRfbReady?: (rfb: any) => void;
  onDesktopName?: (e: any) => void;
  onReconnect?: () => void;
}

export function VncContent({
  url,
  password,
  viewOnly,
  locked,
  clipboardEnabled,
  reconnectCounter,
  onRfbReady,
  onDesktopName,
  onReconnect,
}: VncContentProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const clipboardTextRef = useRef('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const onRfbReadyRef = useRef(onRfbReady);
  onRfbReadyRef.current = onRfbReady;

  // Connection-error overlay. `reason` is the server-supplied string from an
  // RFB SecurityResult failure (noVNC 'securityfailure' event), when present;
  // a plain 'disconnect' carries no message so we show generic text. This keeps
  // the plugin general — it renders whatever reason a VNC server chose to send,
  // with no assumptions about the host/auth service.
  const [connError, setConnError] = useState<{ reason: string | null } | null>(null);
  // A fresh connection attempt (key/reconnectCounter change) clears the overlay.
  useEffect(() => { setConnError(null); }, [reconnectCounter]);
  const handleSecurityFailure = useCallback((e: any) => {
    const reason = (e?.detail?.reason ?? '').toString().trim();
    setConnError({ reason: reason || null });
  }, []);
  const handleDisconnect = useCallback(() => {
    // Show the overlay on any unexpected disconnect. We deliberately do NOT gate
    // on e.detail.clean: noVNC's _rfbCleanDisconnect defaults to true and is only
    // set false on an internal RFB _fail(), so a *server-side* drop (the VNC
    // server going away — the case we most want to surface) arrives as a "clean"
    // disconnect. Intentional teardowns don't show a stray overlay: stop-sharing
    // unmounts this component, and a reconnect clears the error via the
    // reconnectCounter effect + handleConnect. 'securityfailure' fires first with
    // a specific reason, so don't clobber it.
    setConnError((prev) => prev || { reason: null });
  }, []);

  // Reconnect is handled by changing VncDisplay's key (below),
  // which forces React to unmount/remount the component cleanly.

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

  // Browser → VNC: listen for copy/cut events
  useEffect(() => {
    if (!clipboardEnabled) return () => {};
    document.addEventListener('cut', transferClipboardText);
    document.addEventListener('copy', transferClipboardText);
    return () => {
      document.removeEventListener('copy', transferClipboardText);
      document.removeEventListener('cut', transferClipboardText);
    };
  }, [transferClipboardText, clipboardEnabled]);

  // VNC → Browser: listen for clipboard events from remote desktop
  useEffect(() => {
    if (!clipboardEnabled) return () => {};
    const rfb = playerRef.current?.rfb;
    if (!rfb) return () => {};
    const handler = (event: any) => {
      if (typeof navigator.clipboard?.writeText === 'function') {
        navigator.clipboard.writeText(event.detail.text).catch(() => {});
      }
    };
    rfb.addEventListener('clipboard', handler);
    return () => {
      rfb.removeEventListener('clipboard', handler);
    };
  }, [clipboardEnabled]);

  const onFullscreenChange = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const nowFullscreen = document.fullscreenElement === el;
    setIsFullscreen(nowFullscreen);
    if (playerRef.current?.rfb) {
      // Invalidate noVNC's cached expected client size so that
      // _handleResize() doesn't bail out when the container returns
      // to its pre-fullscreen dimensions (which match the size saved
      // at connection time).
      playerRef.current.rfb._expectedClientWidth = null;
      playerRef.current.rfb._expectedClientHeight = null;
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

  const handleConnect = useCallback(() => {
    setConnError(null);   // successful (re)connect clears any error overlay
    if (playerRef.current?.rfb?._handleResize) {
      playerRef.current.rfb._handleResize();
    }
    if (onRfbReadyRef.current && playerRef.current?.rfb) {
      onRfbReadyRef.current(playerRef.current.rfb);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--color-background, #06172A)',
      }}
      onFocus={() => { if (clipboardEnabled) transferClipboardText(); }}
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
          background: 'rgba(6, 23, 42, 0.7)',
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
              {/* Four inward arrows */}
              <polyline points="4 14 10 14 10 20" />
              <line x1="3" y1="21" x2="10" y2="14" />
              <polyline points="20 14 14 14 14 20" />
              <line x1="21" y1="21" x2="14" y2="14" />
              <polyline points="4 10 10 10 10 4" />
              <line x1="3" y1="3" x2="10" y2="10" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="21" y1="3" x2="14" y2="10" />
            </>
          ) : (
            <>
              {/* Four outward arrows */}
              <polyline points="15 3 21 3 21 9" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="3" y1="21" x2="10" y2="14" />
              <polyline points="15 21 21 21 21 15" />
              <line x1="21" y1="21" x2="14" y2="14" />
              <polyline points="9 3 3 3 3 9" />
              <line x1="3" y1="3" x2="10" y2="10" />
            </>
          )}
        </svg>
      </button>

      <VncDisplay
        key={reconnectCounter}
        width="100%"
        height="100%"
        background="transparent"
        url={url}
        credentials={{ password: password || '' }}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onSecurityFailure={handleSecurityFailure}
        onDesktopName={onDesktopName}
        viewOnly={effectiveViewOnly}
        shared
        scaleViewport
        ref={playerRef}
      />

      {/* Connection-error overlay: turns a blank panel into a message. Shows the
          server's reason (RFB security failure) when available, else generic. */}
      {connError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            textAlign: 'center',
            background: 'rgba(6, 23, 42, 0.92)',
            color: '#fff',
          }}
        >
          <div style={{ fontSize: 15, maxWidth: 480, lineHeight: 1.4 }}>
            {connError.reason || 'The connection to the remote desktop was lost.'}
          </div>
          {onReconnect && (
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => onReconnect()} style={overlayBtnStyle}>
                Reconnect
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const overlayBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  border: '1px solid rgba(255, 255, 255, 0.4)',
  borderRadius: 4,
  background: 'rgba(255, 255, 255, 0.1)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
};
