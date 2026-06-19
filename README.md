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
- Forwards each user's BBB authentication to the VNC backend — when
  paired with an auth-aware gateway (such as `bbb-wss-proxy`),
  any user already authenticated to the meeting reaches the
  backend with valid credentials, no separate sign-in

## Server-side requirements

The plugin is a pure browser-side client. You need a WebSocket-capable
VNC endpoint reachable from participants' browsers. A typical setup
is one of:

- **`bbb-wss-proxy`** — a companion package shipped from the same
  source as this plugin (see [Installation](#bbb-wss-proxy-optional)).
  The fastest path if your VNC server lives on the BBB host itself.
- **`x11vnc` (or `Xtigervnc`, `TigerVNC`) + `websockify`** behind a
  TLS reverse proxy on the same host as your BBB server, exposed at
  `wss://your-bbb-host/vnc` (or similar).
- **A VNC server with native WebSocket support** (e.g., recent
  TigerVNC builds with `-rfbport` / `-websocketsPort`).
- **The [collaborate](https://github.com/BrentBaccala/collaborate)
  package suite** — a fuller turnkey deployment built around this
  plugin. Adds per-user on-demand Xtigervnc desktops, JWT-issued
  login URLs (`bbb-mklogin`), a GNOME-based default desktop, and
  AWS hibernate integration. Heavier than just running the plugin
  against a single VNC server, but appropriate if you want
  per-participant desktops rather than one shared desktop.

The plugin itself does not include any server-side component beyond
the optional `bbb-wss-proxy`; for the manual setups above, see the
[websockify](https://github.com/novnc/websockify) project's docs.

Note: the URL must be `wss://` (not `ws://`) — the plugin enforces
this in the share dialog because BBB itself runs over HTTPS and
browsers will block mixed content.

## Installation

Both `.deb`s — `bbb-plugin-remote-desktop` and the optional `bbb-wss-proxy` —
are in the apt repo's package directory:
<https://www.freesoft.org/jammy-300/pool/main/b/bbb-plugin-remote-desktop/>.
Download whichever versions you need from there.

### bbb-plugin-remote-desktop

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

After installation, run `bbb-conf --restart` so BBB picks up the
newly registered plugin.

### bbb-wss-proxy (optional)

`bbb-wss-proxy` is a small Python wrapper around websockify that
authenticates incoming WebSocket connections against BigBlueButton's
own session-token API, then relays them to a backend VNC server. It
ships in the same source package as the plugin (one
`dpkg-buildpackage` produces both `.deb`s).

```bash
sudo dpkg -i bbb-wss-proxy_*.deb
```

Once installed, a moderator's share URL is simply:

    wss://<your-bbb-host>/proxy/

The proxy relays anything that authenticates to `localhost:5900`
by default; set `DEFAULT_TARGET` in `/etc/default/bbb-wss-proxy` to
point elsewhere, or set `ALLOWED_TARGETS` (a regex) to let the
moderator pick a target via the `?target=host:port` query
parameter. With `ALLOWED_TARGETS` enabled, a share URL might be:

    wss://<your-bbb-host>/proxy/?target=192.168.1.50:5901

The proxy is **optional** — if you already have a WebSocket VNC
endpoint reachable from participant browsers, you can install just
`bbb-plugin-remote-desktop` and point its share dialog at your
existing endpoint.

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

> **Applying changes:** `bbb-html5.yml` is read by `bbb-apps-akka`
> (via `clientSettingsOverrideFilePath`), **not** by `bbb-web`. After
> editing it, restart that service:
>
> ```bash
> sudo systemctl restart bbb-apps-akka   # or: sudo bbb-conf --restart
> ```
>
> The settings are loaded when the service starts, so a browser
> reload or joining a new meeting is **not** enough to pick up an
> edit — the restart is required.

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

Each button has these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | yes | Tooltip text shown on hover |
| `keysym` | number | yes | X11 keysym to send when clicked |
| `icon` | string | no | Icon name or image URL/path/data-URI (see below). If omitted, a single-letter glyph is generated from `label` (or `alt`). |
| `alt` | string | no | Alt text for a custom-image icon (URL/path/data-URI). Falls back to `label`. Ignored for built-in named icons. |
| `color` | string | no | BBB button color variant, e.g. `primary` (blue) or `default` (white). If omitted, the button renders `primary`. Only honored on BBB ≥ 3.0.30; older servers hardcode `primary` and ignore it. |

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

A button can set its color to stand out from (or blend in with) the
others. `color` is honored on BBB ≥ 3.0.30; on older servers the button
falls back to the default blue:

```yaml
buttons:
  - label: "Workspace view"
    icon: "grid-2x2"
    keysym: 65491
    color: "default"        # white button (blue on BBB < 3.0.30)
  - label: "Next slide"
    icon: "arrow-right"
    keysym: 65366           # no color → blue (primary) everywhere
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
URI. The plugin renders it as a 24×24 `<img>`. Set `alt` for its
alt text (it falls back to `label` if omitted). Examples:

```yaml
buttons:
  - label: "Custom"
    icon: "https://example.com/icons/custom.png"
    alt: "Custom action"
    keysym: 65491
  - label: "Local"
    icon: "/plugins/remote-desktop-extras/star.svg"
    alt: "Star"
    keysym: 65492
  - label: "Inline"
    icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0i..."
    keysym: 65493
```

Custom images are rendered as raster/vector content and do **not**
inherit the action bar's text color the way the built-in SVGs do
(the built-in icons use `currentColor`). For best results in both
light and dark themes, ship an icon with its own colors baked in.

**No icon** — if a button omits `icon` entirely, the plugin renders
a single-letter glyph: the first character of `label`, or of `alt`
if `label` is empty (blank if neither is set). The glyph uses
`currentColor`, so it themes correctly in light and dark.

```yaml
buttons:
  - label: "Reboot"      # renders an "R" glyph
    keysym: 65493
```

### Resolution order

1. If no `icon` is set, a single-letter glyph is generated from the
   first character of `label` (or `alt` if `label` is empty; blank
   if neither is set).
2. If the icon value matches a built-in plugin icon name, the
   custom SVG is used.
3. Otherwise, if the value looks like a URL, path, data URI, or has
   an image file extension (`.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`,
   `.webp`, `.ico`), it is rendered as a 24×24 `<img>` with its
   `alt` (falling back to `label`).
4. Otherwise, the value is passed through to BBB's icon system as
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
off by default and must be explicitly enabled by each user in each
session — there is no global setting to force it on and it is not
retained between sessions.

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
