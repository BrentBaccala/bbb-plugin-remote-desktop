import * as React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import * as ReactDOM from 'react-dom';

interface ButtonSubmenuProps {
  buttonLabel: string;
  onReconnect: () => void;
}

export function ButtonSubmenu({ buttonLabel, onReconnect }: ButtonSubmenuProps): React.ReactElement | null {
  const [buttonEl, setButtonEl] = useState<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chevronEl, setChevronEl] = useState<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Find the action bar button by its aria-label
  useEffect(() => {
    const findButton = () => {
      const buttons = Array.from(document.querySelectorAll('[class*="buttonWrapper"]'));
      for (let i = 0; i < buttons.length; i++) {
        const ariaLabel = buttons[i].getAttribute('aria-label') || '';
        if (ariaLabel.toLowerCase().includes('remote desktop')) {
          setButtonEl(buttons[i] as HTMLElement);
          return;
        }
      }
      setButtonEl(null);
    };

    findButton();
    const observer = new MutationObserver(findButton);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [buttonLabel]);

  // Inject the chevron button into the found action bar button
  useEffect(() => {
    if (!buttonEl) {
      if (chevronEl) {
        chevronEl.remove();
        setChevronEl(null);
      }
      return;
    }

    // Check if chevron already exists
    let chevron = buttonEl.querySelector('[data-submenu-chevron]') as HTMLElement;
    if (!chevron) {
      chevron = document.createElement('button');
      chevron.setAttribute('data-submenu-chevron', 'true');
      chevron.setAttribute('type', 'button');
      chevron.setAttribute('aria-label', 'Remote desktop options');
      Object.assign(chevron.style, {
        position: 'absolute',
        borderRadius: '50%',
        width: '1em',
        height: '1em',
        right: '-.2em',
        bottom: '0',
        backgroundColor: '#4E5A66',
        overflow: 'hidden',
        zIndex: '2',
        border: 'none',
        padding: '0',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 150ms',
      });
      // SVG chevron icon
      chevron.innerHTML = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
      // Make the parent position relative if not already
      buttonEl.style.position = 'relative';
      buttonEl.appendChild(chevron);
    }

    // Hover effect
    chevron.onmouseenter = () => { chevron.style.transform = 'scale(1.5)'; };
    chevron.onmouseleave = () => { chevron.style.transform = 'scale(1)'; };

    // Click handler - stop propagation so the main button's onClick isn't triggered
    chevron.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      setMenuOpen((prev) => !prev);
    };

    setChevronEl(chevron);

    return () => {
      chevron.remove();
      setChevronEl(null);
    };
  }, [buttonEl]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)
          && chevronEl && !chevronEl.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    // Delay to avoid catching the chevron click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick, true);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick, true);
    };
  }, [menuOpen, chevronEl]);

  // Close menu on escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const handleReconnect = useCallback(() => {
    setMenuOpen(false);
    onReconnect();
  }, [onReconnect]);

  if (!menuOpen || !buttonEl) return null;

  // Position the dropdown above the button
  const rect = buttonEl.getBoundingClientRect();
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: window.innerHeight - rect.top + 4,
    left: rect.left + rect.width / 2,
    transform: 'translateX(-50%)',
    zIndex: 99999,
    background: '#1B2A3A',
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    padding: '4px 0',
    minWidth: '200px',
    color: '#fff',
    fontSize: '14px',
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    color: '#fff',
    width: '100%',
    textAlign: 'left',
    fontSize: '14px',
    whiteSpace: 'nowrap',
  };

  return ReactDOM.createPortal(
    <div ref={menuRef} style={menuStyle}>
      <button
        type="button"
        style={itemStyle}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#2B3E50'; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none'; }}
        onClick={handleReconnect}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        Reconnect remote desktop
      </button>
    </div>,
    document.body,
  );
}
