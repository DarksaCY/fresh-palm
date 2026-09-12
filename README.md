# fresh-palm

A web bridge for a Palm m505 (Palm OS 4.0.0d, USB HotSync cable/cradle,
160x160, no Wi-Fi/Bluetooth): file exchange, a device dashboard, and an
attempt at internet forwarding + a Claude bridge through it. Everything is a
local web dashboard rather than a native/desktop app, by design.

## Status

**Working, confirmed live against the device:**
- Web dashboard (Express) at `http://localhost:7373`
- HotSync/DLP over USB via [`palm-sync`](https://github.com/jichu4n/palm-sync)
  (built from source, vendored in `vendor/palm-sync` — not published to npm)
- File exchange: push any `.prc`/`.pdb` to the device, pull databases off it
- Memory panel (RAM used/free, ROM/RAM database counts) and an installed-apps
  list, both via custom DLP calls (`lib/palm-sync-fns.js`)
- Plucker (offline doc viewer) and EudoraWeb (live text browser) installed on
  the device via push
- Webcam screen-mirror panel (client-side `getUserMedia`, no server relay)
- sync/net mode toggle — HotSync and PPP can't use the port at the same time,
  see below

**Blocked, documented, not abandoned:** live internet (PPP) over the USB
HotSync port reproducibly crashes the device with a Fatal Exception, across
every connection-type/asyncmap/baud/flow-control variant tried. Full
postmortem and the two remaining hardware options (a USB IrDA dongle, or a
genuine serial cradle for the Universal Connector) are in
[`network/README.md`](network/README.md).

**Started, not wired up:** a minimal from-scratch Plucker document (`.pdb`)
writer (`lib/plucker-pdb.js`), meant as a fallback path for a "Claude bridge"
that doesn't need live PPP — push pre-fetched Claude replies as documents
instead of live browsing.

## Requirements

- Node.js 20+ (`palm-sync`'s dependencies require it; a system-wide Node 18
  won't work — use `nvm install 20 && nvm use 20`)
- Linux, with the Palm's USB HotSync cable/cradle connected

### One-time device/driver setup

`palm-sync` talks to the device over raw USB (libusb), not through a tty, so
the in-tree `visor` kernel module needs to be blacklisted and udev rules
added for non-root access:

```
sudo cp vendor/palm-sync/blacklist-visor.conf /etc/modprobe.d/
sudo cp vendor/palm-sync/60-palm-os-devices.rules /etc/udev/rules.d/
sudo modprobe -r visor
sudo udevadm control --reload-rules && sudo udevadm trigger
```

The dashboard's "Cable mode" panel re-loads `visor` on demand for the PPP
path (blocked, see above) — the blacklist only stops it auto-loading at
boot/hotplug, it doesn't stop `modprobe visor` working when asked for.

## Installation

```
git clone --depth 1 https://github.com/jichu4n/palm-sync.git vendor/palm-sync
cd vendor/palm-sync && npm install && npm run build && cd ../..
npm install
```

## Running

```
npm start
```

Dashboard: http://localhost:7373

HotSync-based actions (Info, List, memory, apps, push, pull) each open a
short listening window and print "waiting" — press the HotSync button on the
Palm once you see that, not before.

## Project layout

```
server.js              Express app + all /api/* routes
public/index.html       the dashboard (single page, no build step)
lib/palm-sync-fns.js    custom DLP calls (memory info, app list) run via
                        palm-sync's `run <module> --fn <name>` CLI command
lib/plucker-pdb.js      from-scratch Plucker document writer (unfinished)
network/                PPP/pppd setup, and the full crash postmortem +
                        next-hardware-options writeup
vendor/palm-sync/       palm-sync built from source (gitignored, see above
                        to reproduce)
```
