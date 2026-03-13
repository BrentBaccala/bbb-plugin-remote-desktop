import { Component, createElement } from 'react';
import RFB from '@novnc/novnc/lib/rfb';

const events: Record<string, string> = {
  connect: 'onConnect',
  disconnect: 'onDisconnect',
  credentialsrequired: 'onCredentialsRequired',
  securityfailure: 'onSecurityFailure',
  clipboard: 'onClipboard',
  bell: 'onBell',
  desktopname: 'onDesktopName',
  capabilities: 'onCapabilities',
};

const passthroughProperties = [
  'viewOnly',
  'focusOnClick',
  'clipViewport',
  'dragViewport',
  'scaleViewport',
  'resizeSession',
  'showDotCursor',
  'background',
  'qualityLevel',
  'compressionLevel',
];

interface VncDisplayProps {
  url: string;
  style?: React.CSSProperties | null;
  width?: string | number;
  height?: string | number;
  wsProtocols?: string[];
  credentials?: { password?: string };
  shared?: boolean;
  viewOnly?: boolean;
  focusOnClick?: boolean;
  clipViewport?: boolean;
  dragViewport?: boolean;
  scaleViewport?: boolean;
  resizeSession?: boolean;
  showDotCursor?: boolean;
  background?: string;
  qualityLevel?: number;
  compressionLevel?: number;
  onConnect?: (e?: any) => void;
  onDisconnect?: (e?: any) => void;
  onCredentialsRequired?: (e?: any) => void;
  onSecurityFailure?: (e?: any) => void;
  onClipboard?: (e?: any) => void;
  onBell?: (e?: any) => void;
  onDesktopName?: (e?: any) => void;
  onCapabilities?: (e?: any) => void;
  [key: string]: any;
}

export default class VncDisplay extends Component<VncDisplayProps> {
  rfb: any = null;
  canvas: HTMLDivElement | null = null;
  intersectionObserver: IntersectionObserver | null = null;
  wasHidden: boolean = false;

  static defaultProps: Partial<VncDisplayProps> = {
    style: null,
    wsProtocols: ['binary'],
    width: 1280,
    height: 720,
  };

  componentDidMount() {
    this.connect();
    if (this.canvas) {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && this.wasHidden && this.rfb) {
            this.rfb._handleResize();
            // Request a full (non-incremental) framebuffer update
            if (this.rfb._rfbConnectionState === 'connected'
                && this.rfb._sock && this.rfb._fbWidth && this.rfb._fbHeight) {
              (RFB as any).messages.fbUpdateRequest(
                this.rfb._sock, false, 0, 0,
                this.rfb._fbWidth, this.rfb._fbHeight,
              );
            }
          }
          this.wasHidden = !entry.isIntersecting;
        }
      });
      this.intersectionObserver.observe(this.canvas);
    }
  }

  componentWillUnmount() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    this.disconnect();
  }

  componentDidUpdate(prevProps: VncDisplayProps) {
    if (!this.rfb) return;

    passthroughProperties.forEach((propertyName) => {
      if (
        propertyName in this.props &&
        (this.props as any)[propertyName] != null &&
        (this.props as any)[propertyName] !== (prevProps as any)[propertyName]
      ) {
        this.rfb[propertyName] = (this.props as any)[propertyName];
      }
    });

    if (this.props.scaleViewport || this.props.clipViewport) {
      this.rfb._screen.style.overflow = 'hidden';
    } else {
      this.rfb._screen.style.overflow = 'auto';
    }
  }

  disconnect = () => {
    if (!this.rfb) return;
    this.rfb.disconnect();
    this.rfb = null;
  };

  connect = () => {
    this.disconnect();
    if (!this.canvas) return;

    this.rfb = new RFB(this.canvas, this.props.url, this.props);

    if (this.props.scaleViewport || this.props.clipViewport) {
      this.rfb._screen.style.overflow = 'hidden';
      // Firefox can render scrollbars even with overflow:hidden on
      // flex containers.  scrollbar-width:none is the reliable fix.
      this.rfb._screen.style.scrollbarWidth = 'none';
      // Patch _fixScrollbars to keep overflow hidden.  The original
      // saves and restores _screen.style.overflow, but if anything
      // resets it to 'auto' between calls, the restore perpetuates
      // the unwanted value and scrollbars appear.
      const rfb = this.rfb;
      rfb._fixScrollbars = () => {
        rfb._screen.style.overflow = 'hidden';
        rfb._screen.getBoundingClientRect();
      };
    }

    passthroughProperties.forEach((propertyName) => {
      if (propertyName in this.props && (this.props as any)[propertyName] != null) {
        this.rfb[propertyName] = (this.props as any)[propertyName];
      }
    });

    Object.entries(events).forEach(([event, propertyName]) => {
      if (propertyName in this.props && (this.props as any)[propertyName] != null) {
        this.rfb.addEventListener(event, (this.props as any)[propertyName]);
      }
    });
  };

  registerChild = (ref: HTMLDivElement | null) => {
    this.canvas = ref;
  };

  render() {
    return createElement('div', {
      style: this.props.style || {
        width: this.props.width,
        height: this.props.height,
      },
      ref: this.registerChild,
    });
  }
}
