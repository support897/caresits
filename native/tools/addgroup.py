import os, sys, time, json, urllib.request, jwt
KID=os.environ["KEY_ID"]; ISS=os.environ["ISSUER_ID"]; P8=open(os.environ["KEY_PATH"]).read()
BUILD=os.environ["BUILD_NO"]; APP="6823577907"; GROUPS=[g.strip() for g in os.environ.get("GROUPS_TO_ADD","Review Recordings").split(",")]
def tok(): return jwt.encode({"iss":ISS,"exp":int(time.time())+1100,"aud":"appstoreconnect-v1"},P8,algorithm="ES256",headers={"kid":KID})
def api(path,method="GET",body=None):
    r=urllib.request.Request("https://api.appstoreconnect.apple.com"+path,method=method,data=json.dumps(body).encode() if body else None,headers={"Authorization":"Bearer "+tok(),"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(r) as f: t=f.read(); return json.loads(t) if t else {}
    except urllib.error.HTTPError as e: print("HTTP",e.code,e.read()[:400]); return None
bid=None
for i in range(60):
    j=api(f"/v1/builds?filter[app]={APP}&filter[version]={BUILD}&limit=5")
    if j and j["data"]:
        d=j["data"][0]; print("build",d["id"],d["attributes"]["processingState"])
        if d["attributes"]["processingState"]=="VALID": bid=d["id"]; break
    time.sleep(30)
if not bid: print("build not ready"); sys.exit(0)
gs=api(f"/v1/apps/{APP}/betaGroups?limit=50")
for g in (gs or {"data":[]})["data"]:
    n=g["attributes"]["name"]; print("group",n,g["id"],"internal" if g["attributes"].get("isInternalGroup") else "external")
    if n in GROUPS:
        r=api(f"/v1/betaGroups/{g['id']}/relationships/builds","POST",{"data":[{"type":"builds","id":bid}]})
        print("added to",n, "ok" if r is not None else "failed")
