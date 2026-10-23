#!/usr/bin/env bash
# Manual check of your Google Health API setup. Nothing is stored or printed that is secret.
#
#   bash scripts/google-health-check.sh <YOUR_CLIENT_ID>
#
# 1. opens the Google consent page, 2. you paste back the address you land on,
# 3. it exchanges the code for tokens (asks for the client secret, hidden),
# 4. calls users/me/identity and prints only the result status.
set -euo pipefail

CLIENT_ID="${1:?Usage: bash scripts/google-health-check.sh <CLIENT_ID>}"
REDIRECT="https://www.google.com"
SCOPES="https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly https://www.googleapis.com/auth/googlehealth.sleep.readonly"

enc() { python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$1"; }
json() { python3 -c 'import sys,json
d=json.loads(sys.stdin.read() or "{}")
v=d
for k in sys.argv[1].split("."):
    v=v.get(k,"") if isinstance(v,dict) else ""
print(v if not isinstance(v,(dict,list)) else json.dumps(v))' "$1"; }

URL="https://accounts.google.com/o/oauth2/v2/auth?client_id=$(enc "$CLIENT_ID")&redirect_uri=$(enc "$REDIRECT")&response_type=code&access_type=offline&prompt=consent&scope=$(enc "$SCOPES")"

echo "1) Sign in with the Google account linked to your Fitbit and approve access."
echo "   Google may say the app is unverified: Advanced -> Continue (it is your own app)."
echo "   You will land on google.com. Copy the FULL address from the browser bar."
echo
open "$URL" >/dev/null 2>&1 || xdg-open "$URL" >/dev/null 2>&1 || true
echo "If the browser did not open, open this address:"; echo "$URL"; echo

read -r -p "2) Paste the full address you landed on: " RETURNED
CODE="$(python3 -c 'import sys,urllib.parse as u;q=u.parse_qs(u.urlparse(sys.argv[1]).query);print(q.get("code",[""])[0])' "$RETURNED")"
[ -n "$CODE" ] || { echo "No ?code= found in that address. Start again."; exit 1; }

read -r -s -p "3) Client secret (hidden): " SECRET; echo

RESP="$(curl -s https://oauth2.googleapis.com/token \
  --data-urlencode "client_id=$CLIENT_ID" --data-urlencode "client_secret=$SECRET" \
  --data-urlencode "code=$CODE" --data-urlencode "redirect_uri=$REDIRECT" --data-urlencode "grant_type=authorization_code")"
unset SECRET

ACCESS="$(json access_token <<<"$RESP")"
if [ -z "$ACCESS" ]; then
  echo "Token exchange failed: $(json error <<<"$RESP") - $(json error_description <<<"$RESP")"
  exit 1
fi
echo "Token exchange OK."
echo "  refresh token received : $([ -n "$(json refresh_token <<<"$RESP")" ] && echo yes || echo NO)"
echo "  access token lifetime  : $(json expires_in <<<"$RESP") s"
echo "  refresh token lifetime : $(json refresh_token_expires_in <<<"$RESP") s (blank = not reported)"
echo "  granted scopes         :"; json scope <<<"$RESP" | tr ' ' '\n' | sed 's#https://www.googleapis.com/auth/#    - #'

OUT="$(curl -s -w '\n%{http_code}' -H "Authorization: Bearer $ACCESS" https://health.googleapis.com/v4/users/me/identity)"
CODE_HTTP="$(tail -n1 <<<"$OUT")"
BODY="$(sed '$d' <<<"$OUT")"
echo
echo "4) users/me/identity -> HTTP $CODE_HTTP"
if [ "$CODE_HTTP" = "200" ]; then
  echo "   Account is linked. Setup works."
else
  echo "   $(json error.status <<<"$BODY") $(json error.message <<<"$BODY")"
fi
if [ "$CODE_HTTP" = "200" ]; then
  echo
  echo "5) What does your device return? (counts only, no values are printed)"
  for T in steps heart-rate exercise sleep total-calories; do
    R="$(curl -s -w '\n%{http_code}' -H "Authorization: Bearer $ACCESS" "https://health.googleapis.com/v4/users/me/dataTypes/$T/dataPoints?pageSize=50")"
    H="$(tail -n1 <<<"$R")"; B="$(sed '$d' <<<"$R")"
    if [ "$H" = "200" ]; then
      N="$(python3 -c 'import sys,json
d=json.loads(sys.stdin.read() or "{}")
print(len(d.get("dataPoints",[])), "points; fields:", ",".join(sorted((d.get("dataPoints") or [{}])[0].keys())) if d.get("dataPoints") else "no data points")' <<<"$B")"
      printf '   %-16s HTTP %s  %s\n' "$T" "$H" "$N"
    else
      printf '   %-16s HTTP %s  %s\n' "$T" "$H" "$(json error.status <<<"$B") $(json error.message <<<"$B")"
    fi
  done
fi
unset ACCESS RESP
