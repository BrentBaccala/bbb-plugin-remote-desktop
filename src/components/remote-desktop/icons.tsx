import * as React from 'react';

const pluginIcons: Record<string, React.ReactElement> = {
  'grid-2x2': (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
      <rect x="2.5" y="2.5" width="8" height="8" rx="1" />
      <rect x="13.5" y="2.5" width="8" height="8" rx="1" />
      <rect x="2.5" y="13.5" width="8" height="8" rx="1" />
      <rect x="13.5" y="13.5" width="8" height="8" rx="1" />
    </svg>
  ),
  'grid-2x2-filled': (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="24" height="24">
      <rect x="2" y="2" width="9" height="9" rx="1" />
      <rect x="13" y="2" width="9" height="9" rx="1" />
      <rect x="2" y="13" width="9" height="9" rx="1" />
      <rect x="13" y="13" width="9" height="9" rx="1" />
    </svg>
  ),
  'grid-3x3': (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
      <rect x="2.5" y="2.5" width="5" height="5" rx="0.5" />
      <rect x="9.5" y="2.5" width="5" height="5" rx="0.5" />
      <rect x="16.5" y="2.5" width="5" height="5" rx="0.5" />
      <rect x="2.5" y="9.5" width="5" height="5" rx="0.5" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
      <rect x="16.5" y="9.5" width="5" height="5" rx="0.5" />
      <rect x="2.5" y="16.5" width="5" height="5" rx="0.5" />
      <rect x="9.5" y="16.5" width="5" height="5" rx="0.5" />
      <rect x="16.5" y="16.5" width="5" height="5" rx="0.5" />
    </svg>
  ),
  'grid-3x3-filled': (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="24" height="24">
      <rect x="2" y="2" width="5.5" height="5.5" rx="1" />
      <rect x="9.25" y="2" width="5.5" height="5.5" rx="1" />
      <rect x="16.5" y="2" width="5.5" height="5.5" rx="1" />
      <rect x="2" y="9.25" width="5.5" height="5.5" rx="1" />
      <rect x="9.25" y="9.25" width="5.5" height="5.5" rx="1" />
      <rect x="16.5" y="9.25" width="5.5" height="5.5" rx="1" />
      <rect x="2" y="16.5" width="5.5" height="5.5" rx="1" />
      <rect x="9.25" y="16.5" width="5.5" height="5.5" rx="1" />
      <rect x="16.5" y="16.5" width="5.5" height="5.5" rx="1" />
    </svg>
  ),
  'grid-2x2-rounded': (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="24" height="24">
      <rect x="2" y="2" width="9" height="9" rx="1.5" />
      <rect x="13" y="2" width="9" height="9" rx="1.5" />
      <rect x="2" y="13" width="9" height="9" rx="1.5" />
      <rect x="13" y="13" width="9" height="9" rx="1.5" />
    </svg>
  ),
  'grid-panes': (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  ),
  'grid-panes-3x3': (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
  'grid-mosaic': (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="24" height="24">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
    </svg>
  ),
};

export function resolveIcon(name: string): { svgContent?: React.ReactElement; iconName?: string } {
  if (name in pluginIcons) {
    return { svgContent: pluginIcons[name] };
  }
  return { iconName: name };
}
