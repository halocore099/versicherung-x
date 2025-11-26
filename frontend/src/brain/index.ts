import { auth } from "app/auth";
import { API_HOST, API_PATH, API_PREFIX_PATH, API_URL, Mode, mode } from "../constants";
import { Brain } from "./Brain";
import type { RequestParams } from "./http-client";

const isDeployedToCustomApiPath = API_PREFIX_PATH !== API_PATH;

const constructBaseUrl = (): string => {
  // If API_URL is explicitly set, use it (for Cloudflare Tunnel or custom API domain)
  if (API_URL) {
    return `${API_URL}${API_PREFIX_PATH}`;
  }

  // In development mode, use relative path to leverage Vite's dev server proxy
  // The proxy is configured in vite.config.ts to forward /routes to http://127.0.0.1:8000
  if (typeof window !== "undefined" && (mode === Mode.DEV || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    // Use relative path so Vite proxy handles it
    return API_PREFIX_PATH;
  }

  if (isDeployedToCustomApiPath) {
    // Access via origin domain where webapp was hosted with given api prefix path
    const domain = window.location.origin || `https://${API_HOST}`;
    return `${domain}${API_PREFIX_PATH}`;
  }

  // Access at configured proxy domain
  return `https://${API_HOST}${API_PATH}`;
};

type BaseApiParams = Omit<RequestParams, "signal" | "baseUrl" | "cancelToken">;

const constructBaseApiParams = (): BaseApiParams => {
  return {
    credentials: "include",
    secure: true,
    format: "json", // Default to JSON parsing for all responses
  };
};

const constructClient = () => {
  const baseUrl = constructBaseUrl();
  const baseApiParams = constructBaseApiParams();

  return new Brain({
    baseUrl,
    baseApiParams,
    customFetch: (url, options) => {
      if (isDeployedToCustomApiPath) {
        // Remove /routes/ segment from path if the api is deployed and made accessible through
        // another domain with custom path different from the databutton proxy path
        return fetch(url.replace(API_PREFIX_PATH + "/routes", API_PREFIX_PATH), options);
      }

      return fetch(url, options);
    },
    securityWorker: async () => {
      return {
        headers: {
          Authorization: await auth.getAuthHeaderValue(),
        },
      };
    },
  });
};

const brain = constructClient();

export default brain;
