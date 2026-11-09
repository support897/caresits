#!/bin/zsh
# usage: rt176.sh <TestName or ALL> ; build for testing then run UI tests on the iPhone 17 simulator
cd ~/Apps/caresits-native-push/native
D=8A71238E-0C22-4D47-9E3E-45479021BD52
L=~/Apps/caresits-native-push/build176; mkdir -p $L
xcodebuild build-for-testing -project Caresitters.xcodeproj -scheme Caresitters -destination "platform=iOS Simulator,id=$D" -derivedDataPath ~/Apps/nativeproj/dd CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY="-" CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM="" PROVISIONING_PROFILE_SPECIFIER="" > $L/build.log 2>&1 || { echo "BUILD FAIL" > $L/test-$1.log; grep "error:" $L/build.log | sort -u >> $L/test-$1.log; echo "RT DONE" >> $L/test-$1.log; exit 1; }
rm -rf $L/r-$1.xcresult
ONLY=""; [ "$1" != "ALL" ] && ONLY="-only-testing:CaresittersUITests/RoleFlowTests/$1"
xcodebuild test-without-building -project Caresitters.xcodeproj -scheme Caresitters -destination "platform=iOS Simulator,id=$D" -derivedDataPath ~/Apps/nativeproj/dd -resultBundlePath $L/r-$1.xcresult $=ONLY > $L/test-$1.log 2>&1
echo "RT DONE" >> $L/test-$1.log
