#!/usr/bin/env bash
# Tear down the iptables rules added by start-ppp.sh. Run with sudo.
set -euo pipefail

PALM_IP="10.0.0.2"
EXT_IF="$(ip route show default | awk '{print $5; exit}')"

iptables -t nat -D POSTROUTING -s "$PALM_IP/32" -o "$EXT_IF" -j MASQUERADE 2>/dev/null || true
iptables -D FORWARD -i ppp0 -o "$EXT_IF" -j ACCEPT 2>/dev/null || true
iptables -D FORWARD -i "$EXT_IF" -o ppp0 -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || true

echo "Rules removed (if they existed). pppd itself: kill it separately (pkill pppd) if still running."
