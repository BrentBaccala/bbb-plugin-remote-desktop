import * as React from 'react';
import { useEffect, useState } from 'react';
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

  // Render VNC display via GenericContentMainArea when active
  useEffect(() => {
    if (activeConfig && activeConfig.url) {
      pluginApi.setGenericContentItems([]);
      const ids = pluginApi.setGenericContentItems([
        new GenericContentMainArea({
          contentFunction: (element: HTMLElement) => {
            const root = ReactDOM.createRoot(element);
            root.render(
              <VncContent
                url={`${activeConfig.url}${activeConfig.url.includes('?') ? '&' : '?'}sessionToken=${sessionToken}`}
                password={activeConfig.password || ''}
                viewOnly={viewOnly}
                locked={locked}
              />,
            );
            return root;
          },
        }),
      ]);
      setGenericContentId(ids[0]);
    } else {
      pluginApi.setGenericContentItems([]);
      setGenericContentId('');
    }
  }, [activeConfig, viewOnly, locked]);

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
      const lockSvg = {
        svgContent: locked
          ? (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>) as any
          : (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>) as any,
      };
      pluginApi.setActionsBarItems([
        new ActionsBarButton({
          icon: lockSvg,
          tooltip: locked ? 'Unlock remote desktop controls' : 'Lock remote desktop controls',
          onClick: () => setLocked(!locked),
          position: ActionsBarPosition.RIGHT,
        }),
      ]);
    } else {
      pluginApi.setActionsBarItems([]);
    }
  }, [showingContent, activeConfig, locked, viewOnly]);

  const handleShare = (config: RemoteDesktopConfig) => {
    deleteEntry([RESET_DATA_CHANNEL]);
    pushEntry(config);
    setShowModal(false);
  };

  return (
    <RemoteDesktopModal
      isOpen={showModal}
      onClose={() => setShowModal(false)}
      onShare={handleShare}
      currentUserId={userId}
    />
  );
}

export default RemoteDesktopPlugin;
