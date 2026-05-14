# bbb-plugin-remote-desktop

A BigBlueButton 3.0 plugin that embeds a VNC remote-desktop session
into a meeting's presentation area. Participants see the remote
desktop in their browser via noVNC/WebSockets; the moderator chooses
who can interact with it.

## Use cases

The key difference from screen sharing: participants can *use* the
remote desktop, not just see it. This unlocks scenarios where a
screenshare falls short.

- **Software demos and training** — let participants drive a GUI
  application running on a prepared machine. The session survives
  reconnects and doesn't depend on the demonstrator's local network.
- **Pair programming / collaborative editing** — multiple participants
  can type into the same desktop in real time.
- **Lab environments** — provide a pre-configured Linux/Windows/macOS
  environment that participants couldn't easily install locally, and
  let them work in it directly from their browser.
- **Legacy or platform-specific apps** — use software that only runs
  on a particular OS without requiring participants to have that OS.
- **Persistent shared desktops** — the desktop keeps running between
  meetings; the next meeting reconnects to the same session.

## Features

- Share a VNC desktop in the presentation area (any participant can
  see it, regardless of their device)
- Choose who can interact: all users / moderators only / presenter
  only / just the moderator who shared
- Lock/unlock viewer interaction (per-user toggle in the action bar)
- Bidirectional clipboard sharing (opt-in, per-user)
- Configurable action-bar buttons that send X11 keysyms to the VNC
  server
- Survives screenshare interruptions and reconnects

## Server-side requirements

The plugin is a pure browser-side client. You need a WebSocket-capable
VNC endpoint reachable from participants' browsers. A typical setup
is one of:

- **`x11vnc` (or `Xtigervnc`, `TigerVNC`) + `websockify`** behind a
  TLS reverse proxy on the same host as your BBB server, exposed at
  `wss://your-bbb-host/vnc` (or similar).
- **A VNC server with native WebSocket support** (e.g., recent
  TigerVNC builds with `-rfbport` / `-websocketsPort`).
- **A noVNC deployment** in front of any standard VNC server.

The plugin does not include any server-side component. See
https://novnc.com for setup guidance.

Note: the URL must be `wss://` (not `ws://`) — the plugin enforces
this in the share dialog because BBB itself runs over HTTPS and
browsers will block mixed content.

## Installation

Install the Debian package on the BBB server:

```bash
sudo dpkg -i bbb-plugin-remote-desktop_*.deb
```

The postinst script registers the plugin manifest in
`/etc/bigbluebutton/bbb-web.properties` and patches the BBB core
bundle to support plugin-specified button colors. The patch is a
one-line sed against the minified action-bar component and becomes
a no-op once the upstream change is merged — see
[bigbluebutton/bigbluebutton#24719](https://github.com/bigbluebutton/bigbluebutton/pull/24719).

After installation, run `bbb-conf --restart` to pick up the new
plugin in `bbb-web`.

## Sharing a desktop (moderator workflow)

1. In a meeting, open the action-bar "+" menu and select **Share a
   remote desktop**.
2. Enter the `wss://...` URL. If `remoteDesktopUrl` is configured
   (see below), the field is pre-filled.
3. Optionally enter a VNC password (sent to the VNC server during
   handshake; not stored).
4. Choose who can operate the desktop:
   - **All users** — every participant's mouse and keyboard reach
     the desktop.
   - **Moderators only** — only moderators can operate it.
   - **Presenter only** — only the current presenter (which can
     change during the meeting) can operate it.
   - **Only me** — only the moderator who started the share.

   Non-operators see the desktop but their input is suppressed.
5. Click **Share**.

Each user can additionally toggle a local "lock" (lock icon in the
action bar) that pauses *their own* input regardless of the
operator policy. This is useful for an operator who wants to step
back from a live desktop without changing the policy for everyone
else.

## Configuration

Plugin settings go in `/etc/bigbluebutton/bbb-html5.yml` under
`public.plugins`:

```yaml
public:
  plugins:
    - name: RemoteDesktop
      settings:
        remoteDesktopUrl: wss://your-server.example.com/vnc
        startLocked: true
        buttons:
          - label: "Send Ctrl+Alt+Del"
            icon: "settings"
            keysym: 65535
```

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `remoteDesktopUrl` | string | `""` | Default WebSocket URL pre-filled in the share dialog. If set, moderators can share with one click instead of typing a URL. |
| `startLocked` | boolean | `true` | Whether each viewer's local lock starts engaged. Per-user; does not affect the operator policy. |
| `buttons` | array | `[]` | Action-bar buttons that appear during an active session. Each button sends a keysym to the VNC server when clicked. |

### Buttons

The `buttons` array configures extra action-bar buttons that appear
while a remote desktop is being shared. Each button sends an X11
keysym to the VNC server — useful for triggering window-manager
shortcuts, keyboard-driven app commands, or anything else bound to
a keystroke on the remote machine.

Each button has three fields:

| Field | Type | Description |
|-------|------|-------------|
| `label` | string | Tooltip text shown on hover |
| `icon` | string | Icon name or image URL (see below) |
| `keysym` | number | X11 keysym to send when clicked |

A simple example — a button that sends Ctrl+Alt+Del-equivalent
behavior by triggering F22, with the remote machine's window manager
bound to do something on F22:

```yaml
buttons:
  - label: "Toggle workspace view"
    icon: "grid-2x2"
    keysym: 65491
```

Multiple buttons can be configured:

```yaml
buttons:
  - label: "Workspace view"
    icon: "grid-2x2"
    keysym: 65491
  - label: "Next slide"
    icon: "arrow-right"
    keysym: 65366
```

### Icons

Buttons can use built-in plugin icons, BBB's standard icon set, or
a custom image.

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

**Custom image (PNG, SVG, JPEG, GIF, WebP, or `data:` URI)** — supply
an absolute URL, an absolute path served by the BBB host, or a data
URI. The plugin renders it as a 24×24 `<img>`. Examples:

```yaml
buttons:
  - label: "Custom"
    icon: "https://example.com/icons/custom.png"
    keysym: 65491
  - label: "Local"
    icon: "/plugins/remote-desktop-extras/star.svg"
    keysym: 65492
  - label: "Inline"
    icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0i..."
    keysym: 65493
```

Custom images are rendered as raster/vector content and do **not**
inherit the action bar's text color the way the built-in SVGs do
(the built-in icons use `currentColor`). For best results in both
light and dark themes, ship an icon with its own colors baked in.

### Resolution order

1. If the icon value matches a built-in plugin icon name, the
   custom SVG is used.
2. Otherwise, if the value looks like a URL, path, data URI, or has
   an image file extension (`.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`,
   `.webp`, `.ico`), it is rendered as an `<img>`.
3. Otherwise, the value is passed through to BBB's icon system as
   an icon name.

### Common keysyms

| Keysym | Key |
|--------|-----|
| 65491 | F22 |
| 65492 | F23 |
| 65493 | F24 |

F22, F23, and F24 are not typically available on a keyboard, which
makes them well suited to a remote-desktop button: a window-manager
binding for one of these keysyms can be triggered from the button
without conflicting with anything the user might type.

The keysym values are standard X11 keysyms. The full list is in
`/usr/include/X11/keysymdef.h` or at
https://www.cl.cam.ac.uk/~mgk25/ucs/keysymdef.h

## Clipboard sharing

A clipboard toggle appears in the action-bar "Set options" dropdown
during an active session. When enabled (per user), text copied on
the remote desktop is written to the browser's clipboard, and text
copied locally is sent to the remote desktop. Clipboard sharing is
off by default and must be explicitly enabled by each user — there
is no global setting to force it on or off.

Browsers require a user gesture before granting clipboard access; on
first use the browser may prompt for permission.

## Building

```bash
npm install
npm run build
dpkg-buildpackage -us -uc -b -d
```

The webpack build appends the git commit hash to the JS filename
(`RemoteDesktop-<hash>.js`) and updates `manifest.json` to match,
ensuring browser caches are busted on each new version.
