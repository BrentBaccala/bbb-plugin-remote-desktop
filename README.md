# bbb-plugin-remote-desktop

A BigBlueButton 3.0 plugin that lets moderators share a remote desktop
(via VNC/WebSocket) into a BBB meeting.

## Features

- Share a VNC desktop as the presentation area
- Lock/unlock viewer interaction with the remote desktop
- Configurable action bar buttons that send keysyms to the VNC server
- Clipboard sharing toggle
- Reconnect support

## Installation

Install the Debian package on the BBB server:

```bash
sudo dpkg -i bbb-plugin-remote-desktop_*.deb
```

The postinst script registers the plugin manifest in
`/etc/bigbluebutton/bbb-web.properties` and patches the BBB core bundle
to support plugin-specified button colors.

## Configuration

Plugin settings go in `/etc/bigbluebutton/bbb-html5.yml` under
`public.plugins`:

```yaml
public:
  plugins:
    - name: RemoteDesktop
      settings:
        remoteDesktopUrl: wss://your-server.example.com/vnc
        startLocked: false
        buttons:
          - label: "Grid View"
            icon: "grid-2x2"
            keysym: 65491
```

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `remoteDesktopUrl` | string | `""` | Default WebSocket URL pre-filled in the share dialog. If set, moderators can share with one click instead of typing a URL. |
| `startLocked` | boolean | `true` | Whether the remote desktop starts in locked mode (users can see but not interact). Each user can toggle lock/unlock independently via the action bar button — this is a local setting that does not affect other users. |
| `buttons` | array | `[]` | Action bar buttons that appear during an active remote desktop session. Each button sends a keysym to the VNC server when clicked. |

### Buttons

The `buttons` array configures extra action bar buttons that appear when
a remote desktop is being shared. Each button sends an X11 keysym to
the VNC server, which can trigger actions in the remote desktop's window
manager.

Each button has three fields:

| Field | Type | Description |
|-------|------|-------------|
| `label` | string | Tooltip text shown on hover |
| `icon` | string | Icon name (see below) |
| `keysym` | number | X11 keysym to send when clicked |

Example: toggle between desktop view and a grid of student desktops
using F22 (keysym 65491), which the server-side FVWM config binds to
a grid toggle function:

```yaml
buttons:
  - label: "Grid View"
    icon: "grid-2x2"
    keysym: 65491
```

Multiple buttons can be configured:

```yaml
buttons:
  - label: "Grid View"
    icon: "grid-2x2"
    keysym: 65491
  - label: "Next Page"
    icon: "arrow-right"
    keysym: 65366
```

### Icons

Buttons can use either built-in plugin icons or BBB's standard icon set.

**Built-in plugin icons** (custom SVGs):
- `grid-2x2` — 2x2 grid (outline)
- `grid-2x2-filled` — 2x2 grid (solid)
- `grid-2x2-rounded` — 2x2 grid (rounded corners, solid)
- `grid-3x3` — 3x3 grid (outline)
- `grid-3x3-filled` — 3x3 grid (solid)
- `grid-panes` — 2x2 window panes
- `grid-panes-3x3` — 3x3 window panes
- `grid-mosaic` — asymmetric mosaic layout

**BBB standard icons** (any name from the BBB icon set):
- `lock`, `unlock`, `desktop`, `settings`, `clipboard`, `arrow-right`, etc.

If the icon name matches a built-in plugin icon, it uses the custom SVG.
Otherwise, it's passed through to BBB's icon system.

### Common keysyms

| Keysym | Key | Typical use |
|--------|-----|-------------|
| 65491 | F22 | Grid view toggle (FVWM teacher mode) |
| 65492 | F23 | Restore grid bindings |
| 65493 | F24 | Remove grid bindings |
| 65361 | Left | Arrow left |
| 65363 | Right | Arrow right |
| 65365 | Page Up | Previous page |
| 65366 | Page Down | Next page |

The keysym values are standard X11 keysyms. The full list is in
`/usr/include/X11/keysymdef.h` or at
https://www.cl.cam.ac.uk/~mgk25/ucs/keysymdef.h

## Building

```bash
npm install
npm run build
dpkg-buildpackage -us -uc -b -d
```

The webpack build appends the git commit hash to the JS filename
(`RemoteDesktop-<hash>.js`) and updates `manifest.json` to match,
ensuring browser caches are busted on each new version.
