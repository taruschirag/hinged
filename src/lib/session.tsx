import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { colors } from "@/lib/theme";

const KEY = "hinged.session";
const SessionContext = createContext<string | null>(null);

function newToken() {
  return Array.from(Crypto.getRandomBytes(24), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadToken() {
  try {
    const stored = await SecureStore.getItemAsync(KEY);
    if (stored) return stored;
    const token = newToken();
    await SecureStore.setItemAsync(KEY, token);
    return token;
  } catch {
    const file = new File(Paths.document, KEY);
    if (file.exists) return file.textSync();
    const token = newToken();
    file.write(token);
    return token;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadToken().then(setToken, (e) => setError(String(e)));
  }, []);

  if (!token) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: 24 }}>
        {error ? <Text style={{ color: colors.danger, textAlign: "center" }}>{error}</Text> : <ActivityIndicator color={colors.accent} />}
      </View>
    );
  }
  return <SessionContext.Provider value={token}>{children}</SessionContext.Provider>;
}

export function useToken() {
  const token = useContext(SessionContext);
  if (!token) throw new Error("useToken must be used inside SessionProvider");
  return token;
}
