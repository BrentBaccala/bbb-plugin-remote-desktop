import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import RemoteDesktopPlugin from './components/remote-desktop/component';

const uuid = document.currentScript?.getAttribute('uuid') || 'root';
const pluginName = document.currentScript?.getAttribute('pluginName') || 'plugin';

const root = ReactDOM.createRoot(document.getElementById(uuid));
root.render(
  <RemoteDesktopPlugin
    pluginUuid={uuid}
    pluginName={pluginName}
  />,
);
