import { APP2 } from "@cc/core";

const config = {
  appId: "com.ilse.carespace",
  appName: APP2,
  webDir: "dist",
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          "@capacitor-firebase/authentication": {
            symlink: true,
          },
        },
      },
    },
  },
  plugins: {
    FirebaseAuthentication: {
      providers: ["google.com", "apple.com"],
      skipNativeAuth: true,
    },
  },
};

export default config;
