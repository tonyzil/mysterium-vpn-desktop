#!/bin/bash
# Runs update-resolv-conf against a fake networksetup. Usage: ci/update-resolv-conf.test.sh
set -u
dir=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fake="$tmp/networksetup"
# Fails -setdnsservers for every service listed in $FAIL.
cat > "$fake" <<'FAKE'
#!/bin/bash
case "$1" in
  -listallnetworkservices) printf 'An asterisk (*) denotes\nWi-Fi\nTailscale\n' ;;
  -getdnsservers) echo "There aren't any" ;;
  -setdnsservers) [[ ",$FAIL," == *",$2,"* ]] && exit 4; exit 0 ;;
esac
FAKE
chmod +x "$fake"
sed -e "s|^NETWORKSETUP=.*|NETWORKSETUP=$fake|" -e "s|/tmp/myst\.|$tmp/myst.|g" "$dir/update-resolv-conf" > "$tmp/script"
run() { FAIL="$2" dev=utun9 script_type="$1" foreign_option_1="${3-dhcp-option DNS 10.0.0.1}" bash "$tmp/script" > /dev/null 2>&1; echo $?; }
check() { [ "$2" = "$3" ] && echo "ok   $1" || { echo "FAIL $1: expected $3, got $2"; failed=1; }; }
failed=0
check "one adapter rejects"  "$(run up Tailscale)" 0
rm -f "$tmp"/myst.*
check "all adapters reject"  "$(run up Wi-Fi,Tailscale)" 1
rm -f "$tmp"/myst.*
check "no adapter rejects"   "$(run up '')" 0
rm -f "$tmp"/myst.*
check "no dns option"        "$(run up Wi-Fi,Tailscale 'dhcp-option FOO bar')" 0
check "down always succeeds" "$(run down Wi-Fi,Tailscale)" 0
exit $failed
