import os, sys, hashlib
root = os.path.dirname(os.path.abspath(__file__))
def uid(s): return hashlib.md5(s.encode()).hexdigest()[:24].upper()
swift = sorted(f for f in os.listdir(os.path.join(root,'Sources')) if f.endswith('.swift'))
out=[]
A=out.append
files=[('Sources/'+f, 'sourcecode.swift') for f in swift]
res=[('Assets.xcassets','folder.assetcatalog'),('GoogleService-Info.plist','text.plist.xml'),('Fonts/Fraunces.ttf','file'),('Fonts/Atkinson-Regular.ttf','file'),('Fonts/Atkinson-Bold.ttf','file'),('ActivitiesCatalogue.json','file')]
other=[('Info.plist','text.plist.xml'),('App.entitlements','text.plist.entitlements')]
A('// !$*UTF8*$!\n{\n\tarchiveVersion = 1;\n\tclasses = {\n\t};\n\tobjectVersion = 60;\n\tobjects = {\n')
A('/* Begin PBXBuildFile section */')
for p,_ in files: A(f'\t\t{uid("b"+p)} /* {p} in Sources */ = {{isa = PBXBuildFile; fileRef = {uid("f"+p)}; }};')
for p,_ in res: A(f'\t\t{uid("b"+p)} /* {p} in Resources */ = {{isa = PBXBuildFile; fileRef = {uid("f"+p)}; }};')
uit=['UITests/CareSpaceFlowTests.swift']
for p in uit: A(f'\t\t{uid("b"+p)} /* {p} in Sources */ = {{isa = PBXBuildFile; fileRef = {uid("f"+p)}; }};')
pk=[('FirebaseAuth','fb'),('FirebaseFirestore','fb'),('GoogleSignIn','gs'),('FirebaseCore','fb'),('FirebaseAppCheck','fb'),('FirebaseMessaging','fb'),('FirebaseFunctions','fb')]
for n,_ in pk: A(f'\t\t{uid("bp"+n)} /* {n} in Frameworks */ = {{isa = PBXBuildFile; productRef = {uid("pd"+n)}; }};')
A('/* End PBXBuildFile section */\n')
A('/* Begin PBXFileReference section */')
for p,t in files+res+other+[(u,'sourcecode.swift') for u in uit]: A(f'\t\t{uid("f"+p)} /* {p} */ = {{isa = PBXFileReference; lastKnownFileType = {t}; path = "{p}"; sourceTree = "<group>"; }};')
A(f'\t\t{uid("uiproduct")} /* CareSpaceUITests.xctest */ = {{isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = CareSpaceUITests.xctest; sourceTree = BUILT_PRODUCTS_DIR; }};')
A(f'\t\t{uid("product")} /* CareSpace.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = CareSpace.app; sourceTree = BUILT_PRODUCTS_DIR; }};')
A('/* End PBXFileReference section */\n')
A('/* Begin PBXFrameworksBuildPhase section */')
A(f'\t\t{uid("fw")} /* Frameworks */ = {{\n\t\t\tisa = PBXFrameworksBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n'+''.join(f'\t\t\t\t{uid("bp"+n)},\n' for n,_ in pk)+'\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};')
A('/* End PBXFrameworksBuildPhase section */\n')
A('/* Begin PBXGroup section */')
kids=''.join(f'\t\t\t\t{uid("f"+p)},\n' for p,_ in files+res+other+[(u,'') for u in uit])
A(f'\t\t{uid("main")} = {{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n{kids}\t\t\t\t{uid("products")},\n\t\t\t);\n\t\t\tsourceTree = "<group>";\n\t\t}};')
A(f'\t\t{uid("products")} /* Products */ = {{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n\t\t\t\t{uid("product")},\n\t\t\t\t{uid("uiproduct")},\n\t\t\t);\n\t\t\tname = Products;\n\t\t\tsourceTree = "<group>";\n\t\t}};')
A('/* End PBXGroup section */\n')
A('/* Begin PBXNativeTarget section */')
A(f'\t\t{uid("target")} /* CareSpace */ = {{\n\t\t\tisa = PBXNativeTarget;\n\t\t\tbuildConfigurationList = {uid("tcl")};\n\t\t\tbuildPhases = (\n\t\t\t\t{uid("src")},\n\t\t\t\t{uid("fw")},\n\t\t\t\t{uid("rs")},\n\t\t\t);\n\t\t\tbuildRules = (\n\t\t\t);\n\t\t\tdependencies = (\n\t\t\t);\n\t\t\tname = CareSpace;\n\t\t\tpackageProductDependencies = (\n'+''.join(f'\t\t\t\t{uid("pd"+n)},\n' for n,_ in pk)+f'\t\t\t);\n\t\t\tproductName = CareSpace;\n\t\t\tproductReference = {uid("product")};\n\t\t\tproductType = "com.apple.product-type.application";\n\t\t}};')
A(f'\t\t{uid("uitarget")} /* CareSpaceUITests */ = {{\n\t\t\tisa = PBXNativeTarget;\n\t\t\tbuildConfigurationList = {uid("uicl")};\n\t\t\tbuildPhases = (\n\t\t\t\t{uid("uisrc")},\n\t\t\t);\n\t\t\tbuildRules = (\n\t\t\t);\n\t\t\tdependencies = (\n\t\t\t\t{uid("dep")},\n\t\t\t);\n\t\t\tname = CareSpaceUITests;\n\t\t\tproductName = CareSpaceUITests;\n\t\t\tproductReference = {uid("uiproduct")};\n\t\t\tproductType = "com.apple.product-type.bundle.ui-testing";\n\t\t}};')
A('/* End PBXNativeTarget section */\n')
A('/* Begin PBXContainerItemProxy section */')
A(f'\t\t{uid("proxy")} = {{\n\t\t\tisa = PBXContainerItemProxy;\n\t\t\tcontainerPortal = {uid("proj")};\n\t\t\tproxyType = 1;\n\t\t\tremoteGlobalIDString = {uid("target")};\n\t\t\tremoteInfo = CareSpace;\n\t\t}};')
A('/* End PBXContainerItemProxy section */\n')
A('/* Begin PBXTargetDependency section */')
A(f'\t\t{uid("dep")} = {{\n\t\t\tisa = PBXTargetDependency;\n\t\t\ttarget = {uid("target")};\n\t\t\ttargetProxy = {uid("proxy")};\n\t\t}};')
A('/* End PBXTargetDependency section */\n')
A('/* Begin PBXProject section */')
A(f'\t\t{uid("proj")} /* Project object */ = {{\n\t\t\tisa = PBXProject;\n\t\t\tattributes = {{\n\t\t\t\tBuildIndependentTargetsInParallel = 1;\n\t\t\t\tLastSwiftUpdateCheck = 1600;\n\t\t\t\tLastUpgradeCheck = 1600;\n\t\t\t\tTargetAttributes = {{\n\t\t\t\t\t{uid("target")} = {{\n\t\t\t\t\t\tProvisioningStyle = Automatic;\n\t\t\t\t\t}};\n\t\t\t\t}};\n\t\t\t}};\n\t\t\tbuildConfigurationList = {uid("pcl")};\n\t\t\tcompatibilityVersion = "Xcode 14.0";\n\t\t\tdevelopmentRegion = en;\n\t\t\thasScannedForEncodings = 0;\n\t\t\tknownRegions = (\n\t\t\t\ten,\n\t\t\t\tBase,\n\t\t\t);\n\t\t\tmainGroup = {uid("main")};\n\t\t\tpackageReferences = (\n\t\t\t\t{uid("rfb")},\n\t\t\t\t{uid("rgs")},\n\t\t\t);\n\t\t\tproductRefGroup = {uid("products")};\n\t\t\tprojectDirPath = "";\n\t\t\tprojectRoot = "";\n\t\t\ttargets = (\n\t\t\t\t{uid("target")},\n\t\t\t\t{uid("uitarget")},\n\t\t\t);\n\t\t}};')
A('/* End PBXProject section */\n')
A('/* Begin PBXResourcesBuildPhase section */')
A(f'\t\t{uid("rs")} /* Resources */ = {{\n\t\t\tisa = PBXResourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n'+''.join(f'\t\t\t\t{uid("b"+p)},\n' for p,_ in res)+'\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};')
A('/* End PBXResourcesBuildPhase section */\n')
A('/* Begin PBXSourcesBuildPhase section */')
A(f'\t\t{uid("src")} /* Sources */ = {{\n\t\t\tisa = PBXSourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n'+''.join(f'\t\t\t\t{uid("b"+p)},\n' for p,_ in files)+'\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};')
A(f'\t\t{uid("uisrc")} = {{\n\t\t\tisa = PBXSourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n'+''.join(f'\t\t\t\t{uid("b"+p)},\n' for p in uit)+'\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};')
A('/* End PBXSourcesBuildPhase section */\n')
def cfg(name, common, extra):
    s=f'\t\t{uid(name)} /* {name.split("-")[1]} */ = {{\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = {{\n'
    for k,v in {**common, **extra}.items(): s+=f'\t\t\t\t{k} = {v};\n'
    return s+f'\t\t\t}};\n\t\t\tname = {name.split("-")[1]};\n\t\t}};'
proj={'ALWAYS_SEARCH_USER_PATHS':'NO','CLANG_ENABLE_MODULES':'YES','CLANG_ENABLE_OBJC_ARC':'YES','IPHONEOS_DEPLOYMENT_TARGET':'17.0','SDKROOT':'iphoneos','SWIFT_VERSION':'5.0','ENABLE_USER_SCRIPT_SANDBOXING':'NO'}
tgt={'ASSETCATALOG_COMPILER_APPICON_NAME':'AppIcon','CODE_SIGN_ENTITLEMENTS':'App.entitlements','CODE_SIGN_STYLE':'Automatic','CURRENT_PROJECT_VERSION':'29','DEVELOPMENT_TEAM':'GZ9Z6BPTFR','GENERATE_INFOPLIST_FILE':'NO','INFOPLIST_FILE':'Info.plist','MARKETING_VERSION':'1.0.0','PRODUCT_BUNDLE_IDENTIFIER':'com.ilse.carespace','PRODUCT_NAME':'CareSpace','TARGETED_DEVICE_FAMILY':'1','LD_RUNPATH_SEARCH_PATHS':'"$(inherited) @executable_path/Frameworks"','SWIFT_EMIT_LOC_STRINGS':'YES'}
A('/* Begin XCBuildConfiguration section */')
A(cfg('p-Debug',proj,{'ONLY_ACTIVE_ARCH':'YES','SWIFT_OPTIMIZATION_LEVEL':'"-Onone"','DEBUG_INFORMATION_FORMAT':'dwarf'}))
A(cfg('p-Release',proj,{'SWIFT_COMPILATION_MODE':'wholemodule','DEBUG_INFORMATION_FORMAT':'"dwarf-with-dsym"','VALIDATE_PRODUCT':'YES'}))
A(cfg('t-Debug',tgt,{'SWIFT_ACTIVE_COMPILATION_CONDITIONS':'DEBUG'}))
A(cfg('t-Release',tgt,{}))
uitg={'TEST_TARGET_NAME':'CareSpace','PRODUCT_BUNDLE_IDENTIFIER':'com.ilse.carespace.uitests','PRODUCT_NAME':'"$(TARGET_NAME)"','GENERATE_INFOPLIST_FILE':'YES','SWIFT_VERSION':'5.0','IPHONEOS_DEPLOYMENT_TARGET':'17.0','TARGETED_DEVICE_FAMILY':'1','DEVELOPMENT_TEAM':'GZ9Z6BPTFR','CODE_SIGN_STYLE':'Automatic','LD_RUNPATH_SEARCH_PATHS':'"$(inherited) @executable_path/Frameworks @loader_path/Frameworks"'}
A(cfg('u-Debug',uitg,{}))
A(cfg('u-Release',uitg,{}))
A('/* End XCBuildConfiguration section */\n')
A('/* Begin XCConfigurationList section */')
for n,a,b in [('pcl','p-Debug','p-Release'),('tcl','t-Debug','t-Release'),('uicl','u-Debug','u-Release')]:
    A(f'\t\t{uid(n)} = {{\n\t\t\tisa = XCConfigurationList;\n\t\t\tbuildConfigurations = (\n\t\t\t\t{uid(a)},\n\t\t\t\t{uid(b)},\n\t\t\t);\n\t\t\tdefaultConfigurationIsVisible = 0;\n\t\t\tdefaultConfigurationName = Release;\n\t\t}};')
A('/* End XCConfigurationList section */\n')
A('/* Begin XCRemoteSwiftPackageReference section */')
A(f'\t\t{uid("rfb")} = {{\n\t\t\tisa = XCRemoteSwiftPackageReference;\n\t\t\trepositoryURL = "https://github.com/firebase/firebase-ios-sdk";\n\t\t\trequirement = {{\n\t\t\t\tkind = upToNextMajorVersion;\n\t\t\t\tminimumVersion = 11.0.0;\n\t\t\t}};\n\t\t}};')
A(f'\t\t{uid("rgs")} = {{\n\t\t\tisa = XCRemoteSwiftPackageReference;\n\t\t\trepositoryURL = "https://github.com/google/GoogleSignIn-iOS";\n\t\t\trequirement = {{\n\t\t\t\tkind = upToNextMajorVersion;\n\t\t\t\tminimumVersion = 8.0.0;\n\t\t\t}};\n\t\t}};')
A('/* End XCRemoteSwiftPackageReference section */\n')
A('/* Begin XCSwiftPackageProductDependency section */')
for n,k in pk: A(f'\t\t{uid("pd"+n)} = {{\n\t\t\tisa = XCSwiftPackageProductDependency;\n\t\t\tpackage = {uid("rfb" if k=="fb" else "rgs")};\n\t\t\tproductName = {n};\n\t\t}};')
A('/* End XCSwiftPackageProductDependency section */\n')
A(f'\t}};\n\trootObject = {uid("proj")};\n}}')
os.makedirs(os.path.join(root,'CareSpace.xcodeproj','xcshareddata','xcschemes'),exist_ok=True)
scheme=f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.7">
 <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES">
  <BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">
   <BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{uid("target")}" BuildableName="CareSpace.app" BlueprintName="CareSpace" ReferencedContainer="container:CareSpace.xcodeproj"/>
  </BuildActionEntry></BuildActionEntries>
 </BuildAction>
 <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES">
  <Testables><TestableReference skipped="NO"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{uid("uitarget")}" BuildableName="CareSpaceUITests.xctest" BlueprintName="CareSpaceUITests" ReferencedContainer="container:CareSpace.xcodeproj"/></TestableReference></Testables>
 </TestAction>
 <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES">
  <BuildableProductRunnable runnableDebuggingMode="0"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{uid("target")}" BuildableName="CareSpace.app" BlueprintName="CareSpace" ReferencedContainer="container:CareSpace.xcodeproj"/></BuildableProductRunnable>
 </LaunchAction>
 <ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>'''
open(os.path.join(root,'CareSpace.xcodeproj','xcshareddata','xcschemes','CareSpace.xcscheme'),'w').write(scheme)
open(os.path.join(root,'CareSpace.xcodeproj','project.pbxproj'),'w').write('\n'.join(out))
print('generated', len(swift),'swift files')
