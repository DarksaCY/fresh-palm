#!/usr/bin/env bash
# Bring up the PPP link to the Palm and NAT it to the real internet.
# Run with sudo. Requires "net" mode already switched on in the dashboard
# (visor loaded, /dev/ttyUSB0 present) and pppd installed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVICE="${1:-/dev/ttyUSB0}"
PALM_IP="10.0.0.2"
EXT_IF="$(ip route show default | awk '{print $5; exit}')"

if [ -z "$EXT_IF" ]; then
  echo "Could not detect default network interface (ip route show default)." >&2
  exit 1
fi

if [ ! -d /sys/module/visor ]; then
  echo "visor module not loaded -- switch to 'net' mode first." >&2
  exit 1
fi

if [ ! -e "$DEVICE" ]; then
  echo "$DEVICE not present yet -- waiting up to 60s. Tap Connect on the Palm now."
  for _ in $(seq 1 60); do
    [ -e "$DEVICE" ] && break
    sleep 1
  done
fi

if [ ! -e "$DEVICE" ]; then
  echo "$DEVICE never appeared after 60s -- device didn't wake up over USB." >&2
  exit 1
fi

echo "$DEVICE is up."

echo "Uplink interface: $EXT_IF"
sysctl -w net.ipv4.ip_forward=1

iptables -t nat -C POSTROUTING -s "$PALM_IP/32" -o "$EXT_IF" -j MASQUERADE 2>/dev/null \
  || iptables -t nat -A POSTROUTING -s "$PALM_IP/32" -o "$EXT_IF" -j MASQUERADE
iptables -C FORWARD -i ppp0 -o "$EXT_IF" -j ACCEPT 2>/dev/null \
  || iptables -A FORWARD -i ppp0 -o "$EXT_IF" -j ACCEPT
iptables -C FORWARD -i "$EXT_IF" -o ppp0 -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null \
  || iptables -A FORWARD -i "$EXT_IF" -o ppp0 -m state --state ESTABLISHED,RELATED -j ACCEPT

echo "Starting pppd on $DEVICE ..."
exec pppd "$DEVICE" 2400 file "$SCRIPT_DIR/ppp-options"
