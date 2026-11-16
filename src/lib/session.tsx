import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const KEY = "hinged.session";
const SessionContext = createContext<string | null>(null);

function newToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let stored = await SecureStore.getItemAsync(KEY);
      if (!stored) {
        stored = newToken();
        await SecureStore.setItemAsync(KEY, stored);
      }
      setToken(stored);
    })();
  }, []);

  if (!token) return null;
  return <SessionContext.Provider value={token}>{children}</SessionContext.Provider>;
}

export function useToken() {
  const token = useContext(SessionContext);
  if (!token) throw new Error("useToken must be used inside SessionProvider");
  return token;
}
