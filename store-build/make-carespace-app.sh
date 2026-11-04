#!/bin/zsh
# Builds the second app (CareSpace, com.ilse.carespace) from the Caresitters project.
# Run from store-build/. Same web code; the app opens CareSpace directly (?app=cs).
set -e
cd "$(dirname "$0")"
rm -rf ../store-build-cs && cp -R . ../store-build-cs && cd ../store-build-cs
python3 - <<'PY'
import json,re
c=json.load(open('capacitor.config.json')); c['appId']='com.ilse.carespace'; c['appName']='CareSpace'
json.dump(c,open('capacitor.config.json','w'),indent=2)
open('www/index.html','w').write('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>CareSpace</title><meta http-equiv="refresh" content="0; url=app3/index.html?app=cs"></head><body><p><a href="app3/index.html?app=cs">Open CareSpace</a></p></body></html>')
p='ios/App/App.xcodeproj/project.pbxproj'; s=open(p).read()
s=s.replace('com.ilse.caresits','com.ilse.carespace'); s=re.sub(r'CURRENT_PROJECT_VERSION = \d+;','CURRENT_PROJECT_VERSION = 1;',s); open(p,'w').write(s)
p='ios/App/App/Info.plist'; s=open(p).read(); s=s.replace('<string>Caresitters</string>','<string>CareSpace</string>',1); open(p,'w').write(s)
PY
# CareSpace has its own Firebase iOS app (own Google sign-in key) and Sign in with Apple is on for its App ID
cp carespace-GoogleService-Info.plist ios/App/App/GoogleService-Info.plist
sed -i '' 's#com.googleusercontent.apps.908064912971-m38ejiid1tp1qlirbqefh9odhlpv5r2k#com.googleusercontent.apps.908064912971-1mqcckm55pdlu1qoo4mukudg9h8o7l97#' ios/App/App/Info.plist
cp carespace-icon-1024.png ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
npx cap sync ios
