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
}
