import react from "@vitejs/plugin-react";
import "dotenv/config";
import { loadEnv } from "vite";
import path from "node:path";
import { defineConfig, splitVendorChunkPlugin } from "vite";
import injectHTML from "vite-plugin-html-inject";
import tsConfigPaths from "vite-tsconfig-paths";

// Get Firebase config from environment variables
const getFirebaseConfig = (): string => {
	// Try to get Firebase config from environment variable
	const firebaseConfigJson = process.env.VITE_FIREBASE_CONFIG;
	
	if (firebaseConfigJson) {
		try {
			const firebaseConfig = JSON.parse(firebaseConfigJson);
			// Build the full config object that matches config.ts schema
			const fullConfig = {
				firebaseConfig: firebaseConfig,
				signInOptions: {
					google: process.env.VITE_FIREBASE_SIGNIN_GOOGLE === "true",
					github: process.env.VITE_FIREBASE_SIGNIN_GITHUB === "true",
					facebook: process.env.VITE_FIREBASE_SIGNIN_FACEBOOK === "true",
					twitter: process.env.VITE_FIREBASE_SIGNIN_TWITTER === "true",
					emailAndPassword: process.env.VITE_FIREBASE_SIGNIN_EMAIL !== "false", // default true
					magicLink: process.env.VITE_FIREBASE_SIGNIN_MAGICLINK === "true",
				},
				siteName: process.env.VITE_FIREBASE_SITE_NAME || "Versicherung X",
				signInSuccessUrl: process.env.VITE_FIREBASE_SIGNIN_SUCCESS_URL || "/",
				tosLink: process.env.VITE_FIREBASE_TOS_LINK || undefined,
				privacyPolicyLink: process.env.VITE_FIREBASE_PRIVACY_LINK || undefined,
			};
			return JSON.stringify(fullConfig);
		} catch (err) {
			console.error("Error parsing VITE_FIREBASE_CONFIG", err);
			return JSON.stringify({});
		}
	}
	
	// Return empty config if not provided
	return JSON.stringify({});
};

const buildVariables = () => {
	// Environment variables with defaults
	const apiUrl = process.env.VITE_API_URL || "";
	const apiPath = process.env.VITE_API_PATH || "";
	const apiHost = process.env.VITE_API_HOST || "";
	const apiPrefixPath = process.env.VITE_API_PREFIX_PATH || "/routes";
	const appBasePath = process.env.VITE_APP_BASE_PATH || "/";
	const appTitle = process.env.VITE_APP_TITLE || "Versicherung X";
	
	// WebSocket URL: convert http/https to ws/wss, or use empty for relative
	const wsApiUrl = apiUrl 
		? apiUrl.replace(/^http/, "ws").replace(/^https/, "wss")
		: "";

	const defines: Record<string, string> = {
		__APP_ID__: JSON.stringify(""),
		__API_PATH__: JSON.stringify(apiPath),
		__API_HOST__: JSON.stringify(apiHost),
		__API_PREFIX_PATH__: JSON.stringify(apiPrefixPath),
		__API_URL__: JSON.stringify(apiUrl),
		__WS_API_URL__: JSON.stringify(wsApiUrl),
		__APP_BASE_PATH__: JSON.stringify(appBasePath),
		__APP_TITLE__: JSON.stringify(appTitle),
		__APP_FAVICON_LIGHT__: JSON.stringify("/favicon-light.svg"),
		__APP_FAVICON_DARK__: JSON.stringify("/favicon-dark.svg"),
		__APP_DEPLOY_USERNAME__: JSON.stringify(""),
		__APP_DEPLOY_APPNAME__: JSON.stringify(""),
		__APP_DEPLOY_CUSTOM_DOMAIN__: JSON.stringify(""),
		__STACK_AUTH_CONFIG__: JSON.stringify({}),
		__FIREBASE_CONFIG__: getFirebaseConfig(),
	};

	return defines;
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	// Load env file based on `mode` in the current working directory.
	// Load .env.development when mode is 'development', etc.
	// This ensures mode-specific env files take precedence over .env
	const env = loadEnv(mode, process.cwd(), '');
	
	// Override process.env with Vite's loaded env (mode-specific files have higher priority)
	Object.assign(process.env, env);
	
	return {
		define: buildVariables(),
		plugins: [react(), splitVendorChunkPlugin(), tsConfigPaths(), injectHTML()],
		server: {
			proxy: {
				"/routes": {
					target: process.env.VITE_DEV_PROXY_TARGET || "http://127.0.0.1:8000",
					changeOrigin: true,
				},
			},
		},
		resolve: {
			alias: {
				resolve: {
					alias: {
						"@": path.resolve(__dirname, "./src"),
					},
				},
			},
		},
	};
});
