# Phase 4: PPP / internet forwarding -- BLOCKED on this hardware

**Status: abandoned after 5 reproducible Fatal Exception crashes.** Tried, in
order: `PC Direct Serial` connection type, `Cradle/Cable` + Service `Unix` +
`Script: End` (the guruthree/PalmGET recipe), `silent` vs. active `passive`,
`asyncmap 0xffffffff`, baud rates from 115200 down to 2400, and `nocrtscts`.
Every variant that had pppd actually transmit LCP ConfReq crashed the device
within 3-5 retransmissions; every variant where nobody transmitted just hung
at "Signing on" until a clean timeout. Not once did the Palm send a single
byte back (confirmed with a receive-only `diag-rx.sh` capture).

**Working theory**: the m505's HotSync port is a proprietary USB link, not a
real UART (unlike older serial-cradle Palms such as the III/V that
guruthree/PalmGET may have been tested on -- their README doesn't say). Its
Serial Manager / Network stack over that port is likely a compatibility shim
built only for the specific HotSync (CMP/PADP/DLP) byte pattern that
`palm-sync` uses via raw USB -- generic PPP framing over the `visor` tty
falls outside what that shim was built/tested for, and crashes it at the ROM
level. This isn't something fixable from the Linux/pppd side.

**If revisiting this**: the one untried variable is a genuine serial cradle
(not USB) for the m500 series, if one can be sourced -- a real UART path
might not share this failure mode. Everything below is kept for reference /
in case that changes.

## Next hardware options (researched, not yet acted on)

Decision pending -- nothing bought/built yet. Two real paths identified,
both requiring hardware we don't currently have:

### Option A: IR (Infrared)

The m505's IR port is separate hardware from the USB HotSync port -- it's
the DragonBall's own on-chip UART, optically modulated, with no dependency
on the same USB-bridging chip that the crash-prone HotSync port uses. This
is a genuinely different code path on both the Palm and the Linux side.

- Palm OS supports IR HotSync and IR-based Network connections natively
  (documented in the official m500 series handbook, "IR HotSync
  Operations"). Connection prefs: Via = Infrared.
- Linux has a mature IrDA stack (`irda-utils`, `irattach`, `/dev/ircomm0`)
  with a **documented working example of exactly this** -- PPP between a
  Palm III and Linux over IrCOMM, in the
  [Linux Infrared HOWTO](https://tldp.org/HOWTO/html_single/Infrared-HOWTO/)
  ("3.5. Palm III Connection - IrCOMM"). `pilot-link`'s `pilot-xfer -p
  /dev/ircomm0` is mentioned as working "flawlessly" for HotSync over IR
  there too -- order matters: start HotSync on the Palm *before* the PC-side
  tool, same lesson as our USB `--usb` flow.
- Requirement: this laptop has no built-in IrDA hardware (modern
  laptops don't). Need a **USB IrDA (SIR) adapter** -- must be a real
  computer IrDA adapter (Actisys, Belkin, IOGEAR-style), NOT a generic "USB
  IR blaster" for remote controls, which doesn't speak IrDA/IrCOMM at all.
  Cheap (~$5-15) and still findable secondhand.
- If pursued: `irda-utils` + `irattach`, confirm `/dev/ircomm0` appears, then
  the same `pppd`-over-serial-device approach we already have in
  `start-ppp.sh`, just pointed at `/dev/ircomm0` instead of `/dev/ttyUSB0`,
  probably at a lower baud like 57600 (per the HOWTO's example) or 9600 to
  start conservatively given what happened on USB.

### Option B: genuine serial cradle/cable (bypass USB entirely)

Confirmed via [pinout references](https://allpinouts.org/pinouts/connectors/pda/palm-universal-m505/)
that the m505's **Palm Universal Connector physically carries real RS-232
signals** (RxD pin 10, TxD pin 11, CTS pin 13, RTS pin 14, DTR pin 15) at
RS-232-compatible levels, entirely separate from the USB data pins (2-3).
This means there's a real UART in the device, wired straight to the
connector -- a genuine serial link, if we can physically get to it, would
bypass the suspect USB-tunnel path completely.

- Sourcing options: an original m500-series serial cradle/cable from that
  era (secondhand market), or building a breakout cable to the known pinout
  (needs a Universal Connector plug -- e.g. salvaged from a cheap/broken
  cradle -- wired to a USB-to-RS232 (FTDI-style) adapter).
  This is a physical build/sourcing task, not something resolvable in
  software.

### Also considered and ruled out

- **SD card Wi-Fi**: the m500-series SD slot is storage-only (SPI), no SDIO
  pins -- a Wi-Fi SD card (which needs SDIO, introduced on later models like
  the Tungsten T3) will not work here.
- **Bluetooth**: no BT radio in the m505, and no SDIO slot to add one.

## Also kept from this round: a battle-tested known-good on-Palm PPP recipe

Even though it crashed on this specific device/port, the following
configuration is confirmed (via
[guruthree/PalmGET](https://github.com/guruthree/PalmGET)) to be the right
*procedure* for getting Palm OS 4 into a PPP-ready state, and will likely
still apply once/if we're on IR or a real serial link instead of USB:
Connection = Cradle/Cable (or Infrared, once relevant) with Details > Speed
matching pppd; Network > Service = Unix; Details: uncheck Query DNS (enter a
DNS manually), uncheck IP Address (enter a static IP); Script > first line
action = End (skips the modem login script, which doesn't apply here).

---

*Original draft notes follow, now superseded by the above:*

These configs are written but **not yet validated against the real device** --
we don't have a way to exercise the on-device Network Preferences UI while
writing this. Treat as a first draft to iterate on once you can sit with the
Palm and a stylus.

## Why "mode" matters

`palm-sync` (HotSync / file exchange) wants the `visor` kernel module
**unloaded** and talks raw USB directly. PPP needs a POSIX serial device
(`/dev/ttyUSB0`), which only exists while `visor` **is loaded**. Palm OS itself
only ever does one of these at a time (HotSync button vs. Network prefs
"Connect"), so this maps cleanly onto a "sync" vs "net" toggle -- see the
dashboard's "Режим кабеля" panel, or manually:

```
sudo modprobe -r visor   # sync mode (HotSync/files)
sudo modprobe visor      # net mode (PPP)
```

## On the Palm (one-time setup, via Graffiti)

**Do not use "PC Direct Serial"** as the connection type -- on the m505 (a
USB-cradle device, no real UART) that path triggered a Fatal Exception crash
on the first attempt. Use the same **Cradle/Cable** connection that HotSync
already uses -- confirmed working (with occasional crash risk acknowledged)
by [guruthree/PalmGET](https://github.com/guruthree/PalmGET), which actually
got an HTTP GET working over this exact setup.

1. **Prefs > Connection**: make sure **Cradle/Cable** is selected (the
   default HotSync one, not a new profile). Tap **Details** and set Speed to
   **115200** (baud) -- must match `ppp-options`.
2. **Prefs > Network**: Service = **Unix** (a stock built-in preset). User
   Name: anything (not checked, `noauth` on the PC side).
3. Tap **Details**:
   - Uncheck **Query DNS** -- manually enter a DNS server, e.g. `8.8.8.8`.
   - Uncheck **IP Address** (automatic) -- manually enter `10.0.0.2`.
4. Tap **Script** -- change the first line's action dropdown to **End**. This
   skips Palm OS's modem AT-command login script entirely, which doesn't
   apply to a direct PPP link and may be what caused the crash.
5. Leave the Network panel open -- don't tap Connect yet.

## On the PC, each session

1. Switch to **net mode** (dashboard button, or the manual `modprobe` command
   above).
2. `sudo ./network/start-ppp.sh` -- brings up NAT + starts `pppd` listening on
   `/dev/ttyUSB0`.
3. Only now tap **Connect** on the Palm's Network panel.
4. To stop: kill `pppd` (Ctrl-C, or `sudo pkill pppd`), then
   `sudo ./network/stop-ppp.sh` to remove the iptables rules, then switch back
   to sync mode if you want HotSync/files again.

## Known unknowns / risks

- **Fatal Exception crashes are a known risk of this exact hack**, not
  necessarily a sign of misconfiguration -- guruthree/PalmGET's README says
  so explicitly even with a working setup. Soft-reset (recessed button on the
  back) recovers the device; nothing about it is destructive.
- **Sustained power**: HotSync only needs the device awake for a short
  request/response burst (the button press keeps it alive for a timeout
  window). A PPP session needs the device powered for the whole browsing
  session -- unclear if the current battery holds up for that long. If it
  doesn't, this phase is blocked on the battery, not the software.
- **Baud rate**: `ppp-options` requests 115200. If the link stalls, try a
  lower rate (9600) both in the `pppd` command line and in the Palm's
  Connection > Details > Speed setting -- they must match.
- **Browsers are installed** (Plucker -- offline reader, works today over
  HotSync; EudoraWeb -- live text browser, needs this PPP link working).
