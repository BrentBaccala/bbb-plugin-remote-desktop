import * as React from 'react';
import { useState } from 'react';
import ReactModal from 'react-modal';
import { RemoteDesktopConfig } from './types';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: (config: RemoteDesktopConfig) => void;
  currentUserId: string;
}

const modalStyle: ReactModal.Styles = {
  overlay: {
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    position: 'relative',
    inset: 'auto',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    width: '28rem',
    maxWidth: '90vw',
    background: '#fff',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  },
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '0.9rem',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '1rem',
  fontSize: '0.9rem',
  fontWeight: 600,
};

const labelTextStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.25rem',
};

export function RemoteDesktopModal({
  isOpen,
  onClose,
  onShare,
  currentUserId,
}: ModalProps): React.ReactElement {
  const defaultUrl = (window as any).meetingClientSettings?.public?.remoteDesktop?.defaultUrl || '';
  const [url, setUrl] = useState('');
  const [password, setPassword] = useState('');
  const [operators, setOperators] = useState('all');

  const effectiveUrl = url || defaultUrl;
  const isValid = typeof effectiveUrl === 'string' && effectiveUrl.startsWith('wss:');

  const handleShare = () => {
    const resolvedOperators = operators === 'me' ? currentUserId : operators;
    onShare({
      url: effectiveUrl.trim(),
      password,
      operators: resolvedOperators,
      sharedBy: currentUserId,
    });
  };

  return (
    <ReactModal
      isOpen={isOpen}
      onRequestClose={onClose}
      style={modalStyle}
      ariaHideApp={false}
      parentSelector={() => document.querySelector('#modals-container') || document.body}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Share a remote desktop</h2>
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '0 0.25rem' }}
        >
          &times;
        </button>
      </div>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Remote Desktop URL</span>
        <input
          style={inputStyle}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={defaultUrl || "wss://vnc-server/websockify"}
          onPaste={(e) => e.stopPropagation()}
          onCut={(e) => e.stopPropagation()}
          onCopy={(e) => e.stopPropagation()}
        />
      </label>

      {!isValid && effectiveUrl ? (
        <div style={{ color: '#c00', fontSize: '0.8rem', marginTop: '-0.75rem', marginBottom: '0.75rem' }}>
          URL must start with wss:
        </div>
      ) : null}

      <label style={labelStyle}>
        <span style={labelTextStyle}>Password</span>
        <input
          style={inputStyle}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Who can operate the desktop</span>
        <select
          style={inputStyle}
          value={operators}
          onChange={(e) => setOperators(e.target.value)}
        >
          <option value="all">All users</option>
          <option value="moderators">Moderators only</option>
          <option value="presenter">Presenter only</option>
          <option value="me">Only me</option>
        </select>
      </label>

      <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '1rem' }}>
        Users will connect directly to this VNC server from their browser.
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={!isValid || !effectiveUrl}
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            background: !isValid || !effectiveUrl ? '#ccc' : '#0f70d7',
            color: '#fff',
            cursor: !isValid || !effectiveUrl ? 'default' : 'pointer',
            fontWeight: 600,
          }}
        >
          Share
        </button>
      </div>
    </ReactModal>
  );
}
