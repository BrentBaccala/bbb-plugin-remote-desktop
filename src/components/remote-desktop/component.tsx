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
  PluginApi,
  LayoutPresentationAreaUiDataNames,
  UiLayouts,
  RESET_DATA_CHANNEL,
} from 'bigbluebutton-html-plugin-sdk';

import { RemoteDesktopConfig, RemoteDesktopPluginProps } from './types';
import { RemoteDesktopModal } from './modal';
import { VncContent } from './vnc-content';
import { ButtonSubmenu } from './button-submenu';

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
  const currentLayout = pluginApi.useUiData(
    LayoutPresentationAreaUiDataNames.CURRENT_ELEMENT,
    [{ isOpen: true, currentElement: UiLayouts.WHITEBOARD }],
  );

  const [showModal, setShowModal] = useState(false);
  const [genericContentId, setGenericContentId] = useState<string>('');
  const [activeConfig, setActiveConfig] = useState<RemoteDesktopConfig | null>(null);
  const [showingContent, setShowingContent] = useState(false);
  const [locked, setLocked] = useState(true);
  const [reconnectCounter, setReconnectCounter] = useState(0);

  const isModerator = currentUser?.role === 'MODERATOR';
  const isPresenter = !!currentUser?.presenter;
  const userId = currentUser?.userId || '';
  const sessionToken = pluginApi.getSessionToken();
  const viewOnly = activeConfig ? !canOperate(activeConfig.operators || 'all', {
    presenter: isPresenter,
    isModerator,
    userId,
  }) : true;

  // Track whether our generic content is in the layout pile
  useEffect(() => {
    const isInPile = currentLayout.some(
      (gc: any) =>
        gc.currentElement === UiLayouts.GENERIC_CONTENT &&
        gc.genericContentId === genericContentId,
    );
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
        reconnectCounter={reconnectCounter}
      />,
    );
  };

  // Render VNC display via GenericContentMainArea when active
  useEffect(() => {
    if (activeConfig && activeConfig.url) {
      pluginApi.setGenericContentItems([]);
      const ids = pluginApi.setGenericContentItems([
        new GenericContentMainArea({
          contentFunction: (element: HTMLElement) => {
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
    }
  }, [activeConfig]);

  // Re-render VncContent when locked/viewOnly/reconnect changes without recreating the connection
  useEffect(() => {
    if (vncRootRef.current && activeConfig) {
      renderVnc(vncRootRef.current);
    }
  }, [viewOnly, locked, reconnectCounter]);

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

  // Set action bar lock/unlock button
  useEffect(() => {
    if (showingContent && activeConfig && !viewOnly) {
      const button = new ActionsBarButton({
        icon: { iconName: locked ? 'lock' : 'unlock' },
        tooltip: locked ? 'Unlock remote desktop controls' : 'Lock remote desktop controls',
        onClick: () => setLocked(!locked),
        position: ActionsBarPosition.RIGHT,
      });
      (button as any).color = locked ? 'default' : 'primary';
      pluginApi.setActionsBarItems([button]);
    } else {
      pluginApi.setActionsBarItems([]);
    }
  }, [showingContent, activeConfig, locked, viewOnly]);

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
