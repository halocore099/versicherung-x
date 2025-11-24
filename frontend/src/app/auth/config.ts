import { z } from "zod";

const configSchema = z.object({
  signInOptions: z.object({
    google: z.coerce.boolean({
      description: "Enable Google sign-in",
    }),
    github: z.coerce.boolean({ description: "Enable GitHub sign-in" }),
    facebook: z.coerce.boolean({ description: "Enable Facebook sign-in" }),
    twitter: z.coerce.boolean({ description: "Enable Twitter sign-in" }),
    emailAndPassword: z.coerce.boolean({
      description: "Enable email and password sign-in",
    }),
    magicLink: z.coerce.boolean({
      description: "Enable magic link sign-in",
    }),
  }),
  siteName: z.string({
    description: "The name of the site",
  }),
  signInSuccessUrl: z.preprocess(
    (it) => it || "/",
    z.string({
      description: "The URL to redirect to after a successful sign-in",
    }),
  ),
  tosLink: z
    .string({
      description: "Link to the terms of service",
    })
    .optional(),
  privacyPolicyLink: z
    .string({
      description: "Link to the privacy policy",
    })
    .optional(),
  firebaseConfig: z.object(
    {
      apiKey: z.string().default(""),
      authDomain: z.string().default(""),
      projectId: z.string().default(""),
      storageBucket: z.string().default(""),
      messagingSenderId: z.string().default(""),
      appId: z.string().default(""),
    },
    {
      description:
        "Firebase config as as describe in https://firebase.google.com/docs/web/learn-more#config-object",
    },
  ),
});

type FirebaseExtensionConfig = z.infer<typeof configSchema>;

// This is set by vite.config.ts
// Vite's define may pass it as a string or already parsed object
declare const __FIREBASE_CONFIG__: string | object;

// Parse Firebase config with error handling
// __FIREBASE_CONFIG__ is set by vite.config.ts and may be a string or already an object
let parsedConfig: FirebaseExtensionConfig;
try {
	let configData: any;
	
	// Check if it's already an object (Vite's define may pass it as-is)
	if (typeof __FIREBASE_CONFIG__ === "object" && __FIREBASE_CONFIG__ !== null) {
		configData = __FIREBASE_CONFIG__;
	} else if (typeof __FIREBASE_CONFIG__ === "string") {
		// If it's a string, try to parse it
		configData = JSON.parse(__FIREBASE_CONFIG__);
	} else {
		// Fallback to empty object
		configData = {};
	}
	
	parsedConfig = configSchema.parse(configData);
} catch (error) {
	console.error("Failed to parse Firebase config:", error);
	console.error("Config value:", __FIREBASE_CONFIG__);
	// Provide a minimal valid config to prevent app crash
	parsedConfig = configSchema.parse({
		firebaseConfig: {
			apiKey: "",
			authDomain: "",
			projectId: "",
			storageBucket: "",
			messagingSenderId: "",
			appId: "",
		},
		signInOptions: {
			google: false,
			github: false,
			facebook: false,
			twitter: false,
			emailAndPassword: true,
			magicLink: false,
		},
		siteName: "Versicherung X",
		signInSuccessUrl: "/",
	});
}

export const config: FirebaseExtensionConfig = parsedConfig;
