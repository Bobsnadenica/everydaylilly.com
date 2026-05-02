(function () {
  const APP_BASE_URL = "https://www.everydaylilly.com";
  const LOCAL_BASE_URL = "http://localhost:8000";
  const SESSION_KEY = "everydayLillyAuth:session";
  const PENDING_KEY = "everydayLillyAuth:pending";
  const EXPIRY_SKEW_MS = 60 * 1000;
  const PKCE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

  function getAppBaseUrl() {
    const { hostname, port } = window.location;

    if ((hostname === "localhost" || hostname === "127.0.0.1") && port === "8000") {
      return LOCAL_BASE_URL;
    }

    return APP_BASE_URL;
  }

  function getConfig(overrides = {}) {
    const data = document.body?.dataset ?? {};
    const appBaseUrl = getAppBaseUrl();

    return {
      appBaseUrl,
      baseUrl: overrides.baseUrl || data.authBaseUrl || "",
      clientId: overrides.clientId || data.authClientId || "",
      redirectUri:
        overrides.redirectUri ||
        data.authRedirectUri ||
        `${appBaseUrl}/auth/callback.html`,
      logoutUri:
        overrides.logoutUri ||
        data.authLogoutUri ||
        `${appBaseUrl}/`,
      scope: overrides.scope || data.authScope || "openid email profile",
    };
  }

  function getStoragePayload(storage, key) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("Unable to parse stored auth payload.", error);
      return null;
    }
  }

  function setStoragePayload(storage, key, value) {
    storage.setItem(key, JSON.stringify(value));
  }

  function clearPendingState() {
    sessionStorage.removeItem(PENDING_KEY);
  }

  function getPendingState() {
    return getStoragePayload(sessionStorage, PENDING_KEY);
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  function getStoredSession() {
    return (
      getStoragePayload(localStorage, SESSION_KEY) ||
      getStoragePayload(sessionStorage, SESSION_KEY)
    );
  }

  function isRememberedSession() {
    return Boolean(localStorage.getItem(SESSION_KEY));
  }

  function saveSession(session, remember) {
    clearSession();
    const storage = remember ? localStorage : sessionStorage;
    setStoragePayload(storage, SESSION_KEY, session);
  }

  function generateRandomString(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);

    let result = "";
    for (let index = 0; index < bytes.length; index += 1) {
      result += PKCE_CHARSET[bytes[index] % PKCE_CHARSET.length];
    }

    return result;
  }

  function toBase64Url(uint8Array) {
    const binary = String.fromCharCode(...uint8Array);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  async function createCodeChallenge(verifier) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(verifier)
    );

    return toBase64Url(new Uint8Array(digest));
  }

  function decodeJwt(token) {
    const parts = token.split(".");

    if (parts.length < 2) {
      return null;
    }

    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

    try {
      return JSON.parse(atob(padded));
    } catch (error) {
      console.warn("Unable to decode JWT payload.", error);
      return null;
    }
  }

  function getReturnPath() {
    return `${window.location.pathname}${window.location.search}${window.location.hash}` || "/";
  }

  async function startLogin(options = {}) {
    const config = getConfig(options);

    if (!config.baseUrl || !config.clientId) {
      throw new Error("Missing Cognito Hosted UI configuration.");
    }

    const verifier = generateRandomString(96);
    const challenge = await createCodeChallenge(verifier);
    const state = generateRandomString(48);
    const nonce = generateRandomString(48);

    setStoragePayload(sessionStorage, PENDING_KEY, {
      verifier,
      state,
      remember: Boolean(options.remember),
      returnTo: options.returnTo || getReturnPath(),
      createdAt: Date.now(),
    });

    const url = new URL(`${config.baseUrl}/oauth2/authorize`);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", config.scope);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);

    if (options.loginHint) {
      url.searchParams.set("login_hint", options.loginHint);
    }

    window.location.assign(url.toString());
  }

  async function requestTokens(params) {
    const response = await fetch(params.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params.body),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message = payload?.error_description || payload?.error || "Token request failed.";
      throw new Error(message);
    }

    return payload;
  }

  async function handleCallback(options = {}) {
    const config = getConfig(options);
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error");
    const oauthErrorDescription = searchParams.get("error_description");

    if (oauthError) {
      throw new Error(oauthErrorDescription || oauthError);
    }

    if (!code || !state) {
      throw new Error("Missing authorization code.");
    }

    const pending = getPendingState();

    if (!pending) {
      throw new Error("Missing stored login state.");
    }

    if (pending.state !== state) {
      clearPendingState();
      throw new Error("State mismatch during secure sign-in.");
    }

    const tokenResponse = await requestTokens({
      tokenUrl: `${config.baseUrl}/oauth2/token`,
      body: {
        grant_type: "authorization_code",
        client_id: config.clientId,
        code,
        code_verifier: pending.verifier,
        redirect_uri: config.redirectUri,
      },
    });

    const claims = tokenResponse.id_token ? decodeJwt(tokenResponse.id_token) : null;
    const session = {
      tokens: tokenResponse,
      claims,
      expiresAt: Date.now() + (tokenResponse.expires_in || 3600) * 1000,
      baseUrl: config.baseUrl,
      clientId: config.clientId,
      logoutUri: config.logoutUri,
    };

    saveSession(session, pending.remember);
    clearPendingState();

    return {
      session,
      returnTo: pending.returnTo || "/",
    };
  }

  async function refreshSession(session, options = {}) {
    if (!session?.tokens?.refresh_token) {
      return null;
    }

    const config = getConfig(options);
    const refreshed = await requestTokens({
      tokenUrl: `${config.baseUrl}/oauth2/token`,
      body: {
        grant_type: "refresh_token",
        client_id: config.clientId,
        refresh_token: session.tokens.refresh_token,
      },
    });

    const nextSession = {
      ...session,
      tokens: {
        ...session.tokens,
        ...refreshed,
        refresh_token: refreshed.refresh_token || session.tokens.refresh_token,
      },
      claims: refreshed.id_token ? decodeJwt(refreshed.id_token) : session.claims,
      expiresAt: Date.now() + (refreshed.expires_in || 3600) * 1000,
      baseUrl: config.baseUrl,
      clientId: config.clientId,
      logoutUri: config.logoutUri,
    };

    saveSession(nextSession, isRememberedSession());
    return nextSession;
  }

  async function getSession(options = {}) {
    const session = getStoredSession();

    if (!session) {
      return null;
    }

    if (session.expiresAt && session.expiresAt > Date.now() + EXPIRY_SKEW_MS) {
      return session;
    }

    try {
      return await refreshSession(session, options);
    } catch (error) {
      console.warn("Unable to refresh Cognito session.", error);
      clearSession();
      return null;
    }
  }

  function signOut(options = {}) {
    const config = getConfig(options);

    clearPendingState();
    clearSession();

    if (!config.baseUrl || !config.clientId) {
      window.location.assign(config.logoutUri || "/");
      return;
    }

    const url = new URL(`${config.baseUrl}/logout`);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("logout_uri", config.logoutUri);
    window.location.assign(url.toString());
  }

  window.EverydayLillyAuth = {
    clearPendingState,
    clearSession,
    getConfig,
    getSession,
    handleCallback,
    signOut,
    startLogin,
  };
})();
