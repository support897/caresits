#!/bin/zsh
# usage: rt181.sh <TestName>  (build for testing, then run on the iPhone 18 Pro simulator)
cd ~/cs181/caresits/native
D=77DE531F-B2CF-43E6-B5BC-0612A609FB30
L=~/cs181/logs; mkdir -p $L
xcodebuild build-for-testing -project Caresitters.xcodeproj -scheme Caresitters -destination "platform=iOS Simulator,id=$D" -derivedDataPath ~/cs181/dd-ui CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY="-" CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM="" PROVISIONING_PROFILE_SPECIFIER="" > $L/build-$1.log 2>&1
echo "BUILD EXIT" >> $L/build-$1.log
rm -rf $L/r-$1.xcresult
xcodebuild test-without-building -project Caresitters.xcodeproj -scheme Caresitters -destination "platform=iOS Simulator,id=$D" -derivedDataPath ~/cs181/dd-ui -resultBundlePath $L/r-$1.xcresult -only-testing:CaresittersUITests/RoleFlowTests/$1 > $L/test-$1.log 2>&1
echo "RT DONE" >> $L/test-$1.log
