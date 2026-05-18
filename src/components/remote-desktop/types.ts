export interface RemoteDesktopConfig {
  url: string;
  password: string;
  operators: string;
  sharedBy: string;
}

export interface RemoteDesktopPluginProps {
  pluginUuid: string;
  pluginName: string;
}

export interface ButtonConfig {
  label: string;
  icon: string;
  keysym: number;
  // Alt text for a custom-image (URL/path/data-URI) icon. Ignored for
  // built-in named icons. Falls back to `label` when omitted.
  alt?: string;
}
