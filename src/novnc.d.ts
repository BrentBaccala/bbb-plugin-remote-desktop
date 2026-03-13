declare module '@novnc/novnc/lib/rfb' {
  class RFB {
    constructor(target: HTMLElement, url: string, options?: Record<string, any>);
    viewOnly: boolean;
    focusOnClick: boolean;
    clipViewport: boolean;
    dragViewport: boolean;
    scaleViewport: boolean;
    resizeSession: boolean;
    showDotCursor: boolean;
    background: string;
    qualityLevel: number;
    compressionLevel: number;
    _screen: HTMLElement;
    disconnect(): void;
    focus(): void;
    blur(): void;
    sendKey(keysym: number, code: string | null, down?: boolean): void;
    clipboardPasteFrom(text: string): void;
    addEventListener(event: string, handler: (e?: any) => void): void;
    removeEventListener(event: string, handler: (e?: any) => void): void;
    _windowResize(): void;
    _handleResize(): void;
  }
  export default RFB;
}
