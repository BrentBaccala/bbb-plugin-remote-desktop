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
  // Optional BBB button color variant (e.g. 'primary', 'default'). When
  // omitted, no color is set so the button renders 'primary' on every BBB
  // version. Only honored on BBB >= 3.0.30 (PR #24719); older servers
  // hardcode 'primary' and ignore this field.
  color?: string;
}
