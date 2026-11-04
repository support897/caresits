import { APP1 } from "@cc/core";

const config = {
  appId: "com.ilse.caresits",
  appName: APP1,
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
