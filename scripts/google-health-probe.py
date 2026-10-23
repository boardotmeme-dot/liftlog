#!/usr/bin/env python3
"""Developer probe for the Google Health API: finds out which queries work for your device.

    python3 scripts/google-health-probe.py <CLIENT_ID>

Signs you in (you paste the address you land on, then the client secret, hidden), then runs a few
read-only list queries and prints status codes, counts and time ranges. It never prints tokens or the secret.
"""
import getpass
import json
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

if len(sys.argv) < 2:
    sys.exit("Usage: python3 scripts/google-health-probe.py <CLIENT_ID>")

CLIENT_ID = sys.argv[1]
REDIRECT = "https://www.google.com"
SCOPES = " ".join(
    "https://www.googleapis.com/auth/googlehealth." + s
    for s in ("activity_and_fitness.readonly", "health_metrics_and_measurements.readonly", "sleep.readonly")
)
BASE = "https://health.googleapis.com/v4/users/me/dataTypes"


def post(url, data):
    req = urllib.request.Request(url, urllib.parse.urlencode(data).encode())
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return json.load(e)


def get(url, token):
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.load(e)
        except Exception:
            return e.code, {}


auth_url = (
    "https://accounts.google.com/o/oauth2/v2/auth?"
    + urllib.parse.urlencode(
        {"client_id": CLIENT_ID, "redirect_uri": REDIRECT, "response_type": "code", "access_type": "offline", "prompt": "consent", "scope": SCOPES}
    )
)
print("Opening the Google consent page. Approve, then copy the FULL address you land on.\n")
subprocess.run(["open", auth_url], check=False, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
print("If it did not open:\n" + auth_url + "\n")
returned = input("Paste the full address you landed on: ").strip()
code = urllib.parse.parse_qs(urllib.parse.urlparse(returned).query).get("code", [""])[0]
if not code:
    sys.exit("No ?code= in that address.")
secret = getpass.getpass("Client secret (hidden): ")
tok = post("https://oauth2.googleapis.com/token", {"client_id": CLIENT_ID, "client_secret": secret, "code": code, "redirect_uri": REDIRECT, "grant_type": "authorization_code"})
del secret
token = tok.get("access_token")
if not token:
    sys.exit("Token exchange failed: %s %s" % (tok.get("error"), tok.get("error_description")))
print("\nSigned in.\n")

now = datetime.now(timezone.utc)
since = (now - timedelta(days=3)).strftime("%Y-%m-%d")
since_dt = (now - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S")
since_z = (now - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")


def pick(point, *path):
    for p in path:
        point = point.get(p) if isinstance(point, dict) else None
    return point


def report(label, dtype, query, timeof):
    url = "%s/%s/dataPoints?%s" % (BASE, dtype, urllib.parse.urlencode(query))
    status, body = get(url, token)
    if status != 200:
        err = body.get("error", {})
        print("%-34s HTTP %s %s %s" % (label, status, err.get("status", ""), err.get("message", "")[:160]))
        return None
    pts = body.get("dataPoints", [])
    times = [t for t in (timeof(p) for p in pts) if t]
    asc = times == sorted(times) if times else None
    print("%-34s HTTP 200  %d points  next=%s  first=%s  last=%s  ascending=%s" % (label, len(pts), "yes" if body.get("nextPageToken") else "no", times[0] if times else "-", times[-1] if times else "-", asc))
    return pts


hr_time = lambda p: pick(p, "heartRate", "sampleTime", "physicalTime")
ex_time = lambda p: pick(p, "exercise", "interval", "startTime")
sl_time = lambda p: pick(p, "sleep", "interval", "startTime")

print("--- heart rate")
report("hr pageSize=1000", "heart-rate", {"pageSize": 1000}, hr_time)
report("hr pageSize=10000", "heart-rate", {"pageSize": 10000}, hr_time)
report("hr civil_time filter", "heart-rate", {"pageSize": 1000, "filter": 'heart_rate.sample_time.civil_time >= "%s"' % since_dt}, hr_time)
report("hr physical_time filter", "heart-rate", {"pageSize": 1000, "filter": 'heart_rate.sample_time.physical_time >= "%s"' % since_z}, hr_time)

print("--- exercise")
pts = report("exercise pageSize=50", "exercise", {"pageSize": 50}, ex_time)
report("exercise civil_start filter", "exercise", {"pageSize": 50, "filter": 'exercise.interval.civil_start_time >= "%sT00:00:00"' % since}, ex_time)
if pts:
    print("    latest sessions (type, start -> end, has avgHR, has kcal):")
    for p in sorted(pts, key=lambda q: ex_time(q) or "")[-5:]:
        e = p.get("exercise", {})
        m = e.get("metricsSummary", {})
        print("    %-14s %s -> %s  avgHR=%s kcal=%s" % (e.get("exerciseType"), pick(e, "interval", "startTime"), pick(e, "interval", "endTime"), "yes" if m.get("averageHeartRateBeatsPerMinute") else "no", "yes" if m.get("caloriesKcal") is not None else "no"))

print("--- sleep")
pts = report("sleep pageSize=5", "sleep", {"pageSize": 5}, sl_time)
report("sleep civil_end filter", "sleep", {"pageSize": 5, "filter": 'sleep.interval.civil_end_time >= "%s"' % since}, sl_time)
if pts:
    print("    latest sleep (start -> end, minutesAsleep):")
    for p in sorted(pts, key=lambda q: sl_time(q) or "")[-3:]:
        s = p.get("sleep", {})
        print("    %s -> %s  asleep=%s min" % (pick(s, "interval", "startTime"), pick(s, "interval", "endTime"), pick(s, "summary", "minutesAsleep")))

if "--shapes" in sys.argv:
    print("\n=== response shapes (first record of each type, truncated) ===")
    for dtype in ("daily-resting-heart-rate", "daily-heart-rate-variability", "daily-oxygen-saturation", "daily-respiratory-rate",
                  "daily-vo2-max", "vo2-max", "weight", "body-fat", "active-zone-minutes", "time-in-heart-rate-zone", "daily-heart-rate-zones", "steps"):
        status, body = get("%s/%s/dataPoints?pageSize=2" % (BASE, dtype), token)
        if status != 200:
            err = body.get("error", {})
            print("\n[%s] HTTP %s %s" % (dtype, status, err.get("message", "")[:140]))
            continue
        pts = body.get("dataPoints", [])
        print("\n[%s] %d points; first:" % (dtype, len(pts)))
        print(json.dumps(pts[0], separators=(",", ":"))[:700] if pts else "  (none)")
    print("\n=== dailyRollUp attempts ===")
    d0 = (now - timedelta(days=3))
    d1 = (now + timedelta(days=1))
    civ = lambda d: {"date": {"year": d.year, "month": d.month, "day": d.day}, "time": {"hours": 0, "minutes": 0, "seconds": 0, "nanos": 0}}
    for dtype in ("steps", "total-calories", "active-zone-minutes", "distance"):
        for label, rng in (("civil date+time", {"start": civ(d0), "end": civ(d1)}), ("date only", {"start": {"date": civ(d0)["date"]}, "end": {"date": civ(d1)["date"]}})):
            req = urllib.request.Request("%s/%s/dataPoints:dailyRollUp" % (BASE, dtype), json.dumps({"range": rng, "windowSizeDays": 1}).encode(),
                                         {"Authorization": "Bearer " + token, "Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    body = json.load(r)
                print("[%s | %s] HTTP 200: %s" % (dtype, label, json.dumps(body, separators=(",", ":"))[:600]))
                break
            except urllib.error.HTTPError as e:
                try:
                    err = json.load(e).get("error", {})
                except Exception:
                    err = {}
                print("[%s | %s] HTTP %s %s" % (dtype, label, e.code, err.get("message", "")[:200]))
print("\nDone.")
