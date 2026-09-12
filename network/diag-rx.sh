#!/usr/bin/env bash
# Diagnostic: listen on /dev/ttyUSB0 for raw incoming bytes only, sending
# nothing back. Helps tell apart "Palm never transmits over the tty at all"
# from "pppd's own protocol logic is what triggers the crash".
set -euo pipefail

DEVICE="${1:-/dev/ttyUSB0}"
SECONDS_TO_LISTEN="${2:-20}"

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
  echo "$DEVICE never appeared after 60s." >&2
  exit 1
fi

stty -F "$DEVICE" raw -echo 9600
echo "Listening on $DEVICE for ${SECONDS_TO_LISTEN}s (receive-only, sending nothing)..."
timeout "$SECONDS_TO_LISTEN" xxd "$DEVICE" || true
echo "Done."
