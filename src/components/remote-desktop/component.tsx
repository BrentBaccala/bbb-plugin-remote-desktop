import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import {
  ActionButtonDropdownOption,
  ActionButtonDropdownSeparator,
  ActionsBarButton,
  ActionsBarPosition,
  BbbPluginSdk,
  GenericContentMainArea,
  OptionsDropdownOption,
  OptionsDropdownSeparator,
  PluginApi,
  LayoutPresentationAreaUiDataNames,
  UiLayouts,
  RESET_DATA_CHANNEL,
  UserListItemLabel,
  DataChannelPushEntryFunctionUserRole,
} from 'bigbluebutton-html-plugin-sdk';

import { RemoteDesktopConfig, RemoteDesktopPluginProps, ButtonConfig } from './types';
import { RemoteDesktopModal } from './modal';
import { VncContent } from './vnc-content';
import { ButtonSubmenu } from './button-submenu';
import { resolveIcon } from './icons';

function canOperate(operators: string, user: { presenter: boolean; isModerator: boolean; userId: string }): boolean {
  if (operators === 'all') return true;
  if (operators === 'moderators') return user.isModerator;
  if (operators === 'presenter') return user.presenter;
  return user.userId === operators;
}

function RemoteDesktopPlugin({ pluginUuid }: RemoteDesktopPluginProps): React.ReactElement {
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  const { data: currentUser } = pluginApi.useCurrentUser();
  const {
    data: channelData,
    pushEntry,
    deleteEntry,
  } = pluginApi.useDataChannel<RemoteDesktopConfig>('remoteDesktop');
  // Per-user "which desktop am I viewing" channel. Every user may push their
  // own entry (pushPermission "all"); each entry is targeted at moderators
  // only (receivers: MODERATOR), so the desktop name is visible to moderators
  // but never reaches other viewers. Gated by the showDesktopName setting.
  const {
    data: modeChannel,
    pushEntry: pushMode,
    replaceEntry: replaceMode,
  } = pluginApi.useDataChannel<{ name: string }>('desktopMode');
  const currentLayout = pluginApi.useUiData(
    LayoutPresentationAreaUiDataNames.CURRENT_ELEMENT,
    [{ isOpen: true, currentElement: UiLayouts.WHITEBOARD }],
  );

  const { data: settings } = pluginApi.usePluginSettings();
  const startLocked = (settings as any)?.startLocked ?? true;
  const defaultUrl = (settings as any)?.remoteDesktopUrl || '';
  const buttons: ButtonConfig[] = (settings as any)?.buttons || [];
  const showDesktopName = (settings as any)?.showDesktopName ?? false;

  const [showModal, setShowModal] = useState(false);
  const [genericContentId, setGenericContentId] = useState<string>('');
  const [activeConfig, setActiveConfig] = useState<RemoteDesktopConfig | null>(null);
  // Name of the desktop this user is currently viewing, as reported by the
  // VNC server via the RFB DesktopName update (noVNC 'desktopname' event).
  // Empty string = on own desktop / not viewing anything -> no label shown.
  const [myDesktopName, setMyDesktopName] = useState<string>('');
  // Tracks a pushMode() whose created entry has not yet round-tripped back
  // through the channel (so `mine` is still undefined). It exists only to
  // avoid a duplicate create while the first push is in flight; it is NOT a
  // value-guard (an earlier value-guard, lastPublishedName, could swallow a
  // dropped blank and freeze the label). Set on push, cleared once `mine`
  // appears. See the publish effect below.
  const pushInFlight = useRef(false);
  const [showingContent, setShowingContent] = useState(false);
  const [locked, setLocked] = useState(startLocked);
  const settingsLoaded = useRef(false);
  useEffect(() => {
    if (settings && !settingsLoaded.current) {
      settingsLoaded.current = true;
      setLocked(startLocked);
    }
  }, [settings, startLocked]);
  const [clipboardEnabled, setClipboardEnabled] = useState(false);
  const [reconnectCounter, setReconnectCounter] = useState(0);
  // The noVNC RFB object lives inside VncContent, which is rendered in a
  // separate React root (GenericContentMainArea).  rfbRef bridges that
  // boundary so the action bar buttons can call rfb.sendKey() to send
  // keysyms (e.g. F22 for grid toggle) to the VNC server.
  const rfbRef = useRef<any>(null);

  const isModerator = currentUser?.role === 'MODERATOR';
  const isPresenter = !!currentUser?.presenter;
  const userId = currentUser?.userId || '';
  // Obtain the BBB session token version-agnostically. BBB 3.0.30 (PR #25219)
  // strips `sessionToken` from the URL at client startup and moves it to
  // sessionStorage['BBB_sessionToken']; the SDK's getSessionToken() only reads
  // the URL, so it returns undefined on 3.0.30+. Try the URL first (3.0.27/29
  // and the brief pre-strip window), then sessionStorage (3.0.30+), then the
  // SDK as a last resort. One build covers all three server versions.
  const sessionToken = new URLSearchParams(window.location.search).get('sessionToken')
    || window.sessionStorage.getItem('BBB_sessionToken')
    || pluginApi.getSessionToken()
    || '';
  const viewOnly = activeConfig ? !canOperate(activeConfig.operators || 'all', {
    presenter: isPresenter,
    isModerator,
    userId,
  }) : true;

  // Track whether our generic content is in the layout pile
  const wasShowingContent = useRef(false);
  // Distinguish the initial mount (when content first enters the layout —
  // VncContent is about to be rendered for the first time, no VNC connection
  // yet exists) from subsequent re-entries (after a screenshare interrupted
  // and the layout swapped our content out, then back in). Only the latter
  // case needs a forced reconnect; on the initial mount, incrementing
  // reconnectCounter causes VncDisplay's `key` to change from 0 to 1,
  // React treats that as unmount-then-remount, and the server sees two
  // back-to-back websocket opens — which races websockify's check-and-spawn
  // (and, for VNC servers that spawn a session per connection, the
  // per-connection spawn mechanism upstream of websockify, which the
  // websockify-level lock does not cover).
  const hasEverShownContent = useRef(false);
  useEffect(() => {
    const isInPile = currentLayout.some(
      (gc: any) =>
        gc.currentElement === UiLayouts.GENERIC_CONTENT &&
        gc.genericContentId === genericContentId,
    );
    if (isInPile !== wasShowingContent.current) {
      console.log(`[RemoteDesktop] showingContent: ${wasShowingContent.current} → ${isInPile}, locked=${locked}, viewOnly=${viewOnly}, activeConfig=${!!activeConfig}`);
    }
    // When content RETURNS to the layout (after a prior removal, e.g. a
    // screenshare replaced us and then ended), force a VNC reconnect so
    // noVNC picks up the current viewOnly state. Skip this on the first
    // appearance — nothing to reconnect yet.
    if (isInPile && !wasShowingContent.current && hasEverShownContent.current && activeConfig) {
      console.log('[RemoteDesktop] content returned to layout, forcing VNC reconnect');
      setReconnectCounter((c) => c + 1);
    }
    if (isInPile) hasEverShownContent.current = true;
    wasShowingContent.current = isInPile;
    setShowingContent(isInPile);
  }, [currentLayout, genericContentId]);

  // React to data channel updates
  useEffect(() => {
    if (channelData.data && channelData.data.length > 0) {
      const lastEntry = channelData.data[channelData.data.length - 1];
      if (lastEntry?.payloadJson) {
        setActiveConfig(lastEntry.payloadJson);
      } else {
        setActiveConfig(null);
      }
    } else {
      setActiveConfig(null);
    }
  }, [channelData]);

  const vncRootRef = useRef<ReactDOM.Root | null>(null);

  const renderVnc = (root: ReactDOM.Root) => {
    root.render(
      <VncContent
        url={`${activeConfig!.url}${activeConfig!.url.includes('?') ? '&' : '?'}sessionToken=${sessionToken}`}
        password={activeConfig!.password || ''}
        viewOnly={viewOnly}
        locked={locked}
        clipboardEnabled={clipboardEnabled}
        reconnectCounter={reconnectCounter}
        onRfbReady={(rfb: any) => { rfbRef.current = rfb; }}
        onDesktopName={(e: any) => setMyDesktopName(e?.detail?.name ?? '')}
        onReconnect={() => setReconnectCounter((c) => c + 1)}
      />,
    );
  };

  // Render VNC display via GenericContentMainArea when active
  useEffect(() => {
    if (activeConfig && activeConfig.url) {
      // A new/changed desktop config builds a fresh React root with a brand-new
      // VNC connection (contentFunction below). Reset the layout-return tracking
      // so this fresh content's first entry into the presentation pile is treated
      // as a first appearance, NOT as a "returned after screenshare" — otherwise
      // the forced-reconnect effect fires while the fresh websocket is still
      // handshaking, aborts it, and opens a second one (two desktops spawn, one
      // torn down; the aborted socket surfaces as "connection lost"). The
      // screenshare-return case leaves activeConfig unchanged, so it still resets
      // to true on entry and reconnects on a later return, as intended.
      hasEverShownContent.current = false;
      wasShowingContent.current = false;
      pluginApi.setGenericContentItems([]);
      const ids = pluginApi.setGenericContentItems([
        new GenericContentMainArea({
          contentFunction: (element: HTMLElement) => {
            console.log('[RemoteDesktop] contentFunction called, element:', element.tagName, 'connected:', element.isConnected);
            const root = ReactDOM.createRoot(element);
            vncRootRef.current = root;
            renderVnc(root);
            return root;
          },
        }),
      ]);
      setGenericContentId(ids[0]);
    } else {
      pluginApi.setGenericContentItems([]);
      setGenericContentId('');
      vncRootRef.current = null;
      rfbRef.current = null;
      // Not viewing any desktop anymore -> clear our reported desktop name.
      setMyDesktopName('');
    }
  }, [activeConfig]);

  // Publish our own desktop name to the desktopMode channel for moderators.
  // One entry per user: create it on first report, then reconcile in place so
  // the persisted entry always *converges* to the current desktop name.
  //
  // This effect is level-triggered, not edge-triggered: on every run it
  // compares the persisted value against the current name and issues a replace
  // whenever they differ, regardless of how we got here. A dropped or
  // late-arriving update (e.g. a blank that landed while our create was still
  // in flight) therefore self-heals on the next channel update instead of
  // freezing the label — the failure mode of the previous edge-triggered
  // design, which gated writes on a single lastPublishedName ref and could
  // strand ANY value (default hostname, screenshare presenter, grid label).
  //
  // The only guard is pushInFlight, which prevents a duplicate *create* while
  // our first push has not yet round-tripped back as `mine`. It is not a
  // value-guard and never suppresses a replace.
  //
  // Receivers are MODERATOR *and* this user's own userId. The own-userId
  // target is essential, not redundant: the BBB core delivers a data-channel
  // entry back to a subscriber only when that subscriber matches one of the
  // entry's receivers (v_pluginDataChannelEntry joins on toRoles/toUserIds —
  // the creator is NOT auto-included). A non-moderator (student) publishing
  // with MODERATOR-only targeting therefore never sees its own entry, so
  // `mine` stays undefined, the reconcile path is unreachable, and the label
  // freezes. Adding our own userId lets the entry round-trip back so the
  // reconcile can track every transition — without exposing the name to any
  // other viewer.
  useEffect(() => {
    if (!showDesktopName || !userId) return;
    const name = (myDesktopName || '').trim();
    const entries = modeChannel?.data || [];
    const mine = entries.find((e: any) => e.createdBy === userId);
    if (mine) {
      // Our entry now exists in the channel; any in-flight create has landed.
      pushInFlight.current = false;
      const persisted = ((mine.payloadJson?.name || '') as string).trim();
      if (persisted !== name) {
        replaceMode(mine.entryId, { name });
      }
    } else if (name && !pushInFlight.current) {
      // No entry yet and we have a non-empty name to show: create it once.
      // pushInFlight blocks a second create until this one round-trips; the
      // reconcile branch above takes over from then on.
      pushInFlight.current = true;
      pushMode(
        { name },
        {
          receivers: [
            { role: DataChannelPushEntryFunctionUserRole.MODERATOR },
            { userId },
          ],
        },
      );
    }
  }, [showDesktopName, myDesktopName, modeChannel, userId]);

  // Moderators render one user-list sub-label per user reporting a non-empty
  // desktop name. The core only renders a label whose userId matches a user
  // currently in the list, so stale entries from departed users are ignored.
  useEffect(() => {
    if (!showDesktopName || !isModerator) {
      pluginApi.setUserListItemAdditionalInformation([]);
      return;
    }
    const entries = modeChannel?.data || [];
    const items = entries
      .filter((e: any) => ((e.payloadJson?.name || '') as string).trim())
      .map((e: any) => new UserListItemLabel({
        userId: e.createdBy,
        label: e.payloadJson.name,
        icon: 'desktop',
      }));
    pluginApi.setUserListItemAdditionalInformation(items);
  }, [showDesktopName, isModerator, modeChannel]);

  // Re-render VncContent when locked/viewOnly/reconnect changes without recreating the connection
  useEffect(() => {
    if (vncRootRef.current && activeConfig) {
      console.log(`[RemoteDesktop] re-render VncContent: viewOnly=${viewOnly}, locked=${locked}, reconnect=${reconnectCounter}, showingContent=${showingContent}`);
      renderVnc(vncRootRef.current);
    }
  }, [viewOnly, locked, clipboardEnabled, reconnectCounter, showingContent]);

  // Set action button dropdown items
  useEffect(() => {
    if (isModerator || isPresenter) {
      const items: any[] = [new ActionButtonDropdownSeparator()];

      if (showingContent && activeConfig) {
        items.push(
          new ActionButtonDropdownOption({
            label: 'Stop sharing remote desktop',
            icon: 'desktop',
            tooltip: 'Stop sharing the remote desktop',
            allowed: true,
            onClick: () => {
              deleteEntry([RESET_DATA_CHANNEL]);
            },
          }),
        );
      } else {
        items.push(
          new ActionButtonDropdownOption({
            label: 'Share a remote desktop',
            icon: 'desktop',
            tooltip: 'Share a VNC remote desktop in the presentation area',
            allowed: true,
            onClick: () => {
              setShowModal(true);
            },
          }),
        );
      }

      pluginApi.setActionButtonDropdownItems(items);
    } else {
      pluginApi.setActionButtonDropdownItems([]);
    }
  }, [currentUser, showingContent, activeConfig]);

  // Set action bar lock/unlock button and configurable keysym buttons
  useEffect(() => {
    if (showingContent && activeConfig && !viewOnly) {
      const items: any[] = [];

      // Lock/unlock button
      const lockButton = new ActionsBarButton({
        icon: { iconName: locked ? 'lock' : 'unlock' },
        tooltip: locked ? 'Unlock remote desktop controls' : 'Lock remote desktop controls',
        onClick: () => setLocked(!locked),
        position: ActionsBarPosition.RIGHT,
      });
      (lockButton as any).color = locked ? 'default' : 'primary';
      items.push(lockButton);

      // Configurable buttons from settings
      for (const btnConfig of buttons) {
        const iconDef = resolveIcon(btnConfig.icon, {
          label: btnConfig.label,
          alt: btnConfig.alt,
        });
        const keysym = btnConfig.keysym;
        const btn = new ActionsBarButton({
          icon: iconDef.svgContent
            ? { svgContent: iconDef.svgContent } as any
            : { iconName: iconDef.iconName || 'settings' },
          tooltip: btnConfig.label || 'Button',
          onClick: () => {
            if (rfbRef.current) {
              // Temporarily disable viewOnly so sendKey isn't silently
              // dropped — the lock controls direct mouse/keyboard interaction,
              // but plugin-triggered keysyms should always go through.
              const wasViewOnly = rfbRef.current._viewOnly;
              rfbRef.current._viewOnly = false;
              rfbRef.current.sendKey(keysym, null);
              rfbRef.current._viewOnly = wasViewOnly;
            }
          },
          position: ActionsBarPosition.RIGHT,
        });
        // Optional per-button color. Only set when configured, so an
        // unspecified button renders 'primary' on every BBB version; the
        // field is honored on BBB >= 3.0.30 and ignored on older servers.
        if (btnConfig.color) {
          (btn as any).color = btnConfig.color;
        }
        items.push(btn);
      }

      pluginApi.setActionsBarItems(items);
    } else {
      pluginApi.setActionsBarItems([]);
    }
  }, [showingContent, activeConfig, locked, viewOnly, buttons]);

  // Set options dropdown clipboard toggle
  useEffect(() => {
    if (showingContent && activeConfig) {
      pluginApi.setOptionsDropdownItems([
        new OptionsDropdownSeparator(),
        new OptionsDropdownOption({
          label: clipboardEnabled ? 'Disable clipboard' : 'Enable clipboard',
          icon: clipboardEnabled ? 'clipboard' : 'clipboard',
          onClick: () => setClipboardEnabled((prev) => !prev),
        }),
      ]);
    } else {
      pluginApi.setOptionsDropdownItems([]);
    }
  }, [showingContent, activeConfig, clipboardEnabled]);

  const handleShare = (config: RemoteDesktopConfig) => {
    deleteEntry([RESET_DATA_CHANNEL]);
    pushEntry(config);
    setShowModal(false);
  };

  const showSubmenu = showingContent && activeConfig && !viewOnly;

  return (
    <>
      <RemoteDesktopModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onShare={handleShare}
        currentUserId={userId}
        defaultUrl={defaultUrl}
      />
      {showSubmenu && (
        <ButtonSubmenu
          buttonLabel={locked ? 'Lock remote desktop controls' : 'Unlock remote desktop controls'}
          onReconnect={() => setReconnectCounter((c) => c + 1)}
        />
      )}
    </>
  );
}

export default RemoteDesktopPlugin;
