#!/bin/zsh
# Archive native Caresitters, sign, export, upload to TestFlight only.
B=~/Apps/caresits-native-push/ship176; mkdir -p $B; rm -rf $B/*.xcarchive $B/export
K="-authenticationKeyPath $HOME/.appstoreconnect/private_keys/AuthKey_C3X28S5366.p8 -authenticationKeyID C3X28S5366 -authenticationKeyIssuerID ae2251a2-85e6-42f5-9071-4f4be62f3b6e"
cd ~/Apps/caresits-native-push/native
xcodebuild archive -project Caresitters.xcodeproj -scheme Caresitters -configuration Release -destination 'generic/platform=iOS' -archivePath $B/C.xcarchive -derivedDataPath ~/Apps/nativeproj/dd-rel CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO DEVELOPMENT_TEAM=GZ9Z6BPTFR > $B/archive.log 2>&1
echo "ARCHIVE EXIT $?" >> $B/archive.log
APP=$B/C.xcarchive/Products/Applications/Caresitters.app
for f in $APP/Frameworks/*.framework; do codesign -f -s - "$f" >> $B/ent.log 2>&1; done
codesign -f -s - --entitlements ~/Apps/caresits-native-push/native/App.entitlements --preserve-metadata=identifier "$APP" >> $B/ent.log 2>&1
echo "ENT EXIT $?" >> $B/ent.log
xcodebuild -exportArchive -archivePath $B/C.xcarchive -exportPath $B/export -exportOptionsPlist ~/Apps/build/ExportOptions.plist -allowProvisioningUpdates ${=K} > $B/export.log 2>&1
echo "EXPORT EXIT $?" >> $B/export.log
IPA=$(ls $B/export/*.ipa 2>/dev/null | head -1)
[ -n "$IPA" ] && xcrun altool --upload-app -f "$IPA" -t ios --apiKey C3X28S5366 --apiIssuer ae2251a2-85e6-42f5-9071-4f4be62f3b6e > $B/upload.log 2>&1
echo "SHIP DONE" >> $B/upload.log
