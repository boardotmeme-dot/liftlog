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


class _Tee:
    """Also writes everything printed to scripts/.probe-output.txt (git-ignored), so it survives a closed terminal."""

    def __init__(self, *streams):
        self.streams = streams

    def write(self, data):
        for s_ in self.streams:
            s_.write(data)
            s_.flush()

    def flush(self):
        for s_ in self.streams:
            s_.flush()


sys.stdout = _Tee(sys.stdout, open(__file__.rsplit("/", 1)[0] + "/.probe-output.txt", "w"))
REDIRECT = "https://www.google.com"
_scopes = ["activity_and_fitness.readonly", "health_metrics_and_measurements.readonly", "sleep.readonly"]
if "--write-test" in sys.argv:
    _scopes += ["activity_and_fitness.writeonly", "health_metrics_and_measurements.writeonly"]
SCOPES = " ".join("https://www.googleapis.com/auth/googlehealth." + s_ for s_ in _scopes)
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

if "--write-test" in sys.argv:
    print("\n=== write test ===")
    ans = input("Create ONE tiny test exercise (1 min, named 'liftlog test - delete me') in your Google Health and delete it right after? [y/N] ").strip().lower()
    if ans != "y":
        print("Skipped.")
    else:
        def post_json(url, payload):
            req = urllib.request.Request(url, json.dumps(payload).encode(), {"Authorization": "Bearer " + token, "Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    return r.status, json.load(r)
            except urllib.error.HTTPError as e:
                try:
                    return e.code, json.load(e)
                except Exception:
                    return e.code, {}

        end = (now - timedelta(minutes=5)).replace(microsecond=0)
        start = end - timedelta(minutes=1)
        S, E = start.strftime("%Y-%m-%dT%H:%M:%SZ"), end.strftime("%Y-%m-%dT%H:%M:%SZ")
        base = {"interval": {"startTime": S, "endTime": E}, "exerciseType": "STRENGTH_TRAINING", "displayName": "liftlog test - delete me", "notes": "Created by liftlog write test"}
        variants = [
            ("minimal", {"exercise": base}),
            ("with offsets", {"exercise": {**base, "interval": {"startTime": S, "startUtcOffset": "10800s", "endTime": E, "endUtcOffset": "10800s"}}}),
            ("with activeDuration", {"exercise": {**base, "interval": {"startTime": S, "startUtcOffset": "10800s", "endTime": E, "endUtcOffset": "10800s"}, "activeDuration": "60s"}}),
        ]
        created = None
        for label, payload in variants:
            status, body = post_json("%s/exercise/dataPoints" % BASE, payload)
            print("[exercise create | %s] HTTP %s %s" % (label, status, json.dumps(body, separators=(",", ":"))[:500]))
            if status == 200:
                created = body
                break
        if created:
            names = []
            def walk(o):
                if isinstance(o, dict):
                    for k_, v_ in o.items():
                        if k_ == "name" and isinstance(v_, str) and "/dataPoints/" in v_:
                            names.append(v_)
                        walk(v_)
                elif isinstance(o, list):
                    for v_ in o:
                        walk(v_)
            walk(created)
            if not names:
                st, lst = get("%s/exercise/dataPoints?pageSize=10" % BASE, token)
                for p_ in lst.get("dataPoints", []):
                    if (p_.get("exercise") or {}).get("displayName") == "liftlog test - delete me":
                        names.append(p_.get("name"))
            print("created data point names:", names)
            if names:
                st, body = post_json("%s/exercise/dataPoints:batchDelete" % BASE, {"names": names})
                print("[exercise batchDelete] HTTP %s %s" % (st, json.dumps(body, separators=(",", ":"))[:400]))
        # weight: write the SAME value as the latest existing weight, then delete it
        st, wl = get("%s/weight/dataPoints?pageSize=1" % BASE, token)
        if st == 200 and wl.get("dataPoints"):
            grams = wl["dataPoints"][0]["weight"]["weightGrams"]
            tnow = (now - timedelta(minutes=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
            status, body = post_json("%s/weight/dataPoints" % BASE, {"weight": {"sampleTime": {"physicalTime": tnow}, "weightGrams": grams}})
            print("[weight create] HTTP %s %s" % (status, json.dumps(body, separators=(",", ":"))[:500]))
            if status == 200:
                names = []
                def walk2(o):
                    if isinstance(o, dict):
                        for k_, v_ in o.items():
                            if k_ == "name" and isinstance(v_, str) and "/dataPoints/" in v_:
                                names.append(v_)
                            walk2(v_)
                    elif isinstance(o, list):
                        for v_ in o:
                            walk2(v_)
                walk2(body)
                if names:
                    st2, b2 = post_json("%s/weight/dataPoints:batchDelete" % BASE, {"names": names})
                    print("[weight batchDelete] HTTP %s %s" % (st2, json.dumps(b2, separators=(",", ":"))[:300]))
print("\nDone.")
