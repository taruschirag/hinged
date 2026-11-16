import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { DOMProps } from "expo/dom";

export type ClayzoStatus = "loading" | "ready" | "failed";

export const DOM_PROPS: DOMProps = {
  scrollEnabled: false,
  bounces: false,
  overScrollMode: "never",
  contentInsetAdjustmentBehavior: "never",
  automaticallyAdjustsScrollIndicatorInsets: false,
  style: { flex: 1, backgroundColor: "transparent" },
  containerStyle: { flex: 1, backgroundColor: "transparent" },
};

export function useClayzoStatus(timeoutMs = 8000) {
  const [status, setStatus] = useState<ClayzoStatus>("loading");

  useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => setStatus((s) => (s === "loading" ? "failed" : s)), timeoutMs);
    return () => clearTimeout(timer);
  }, [status, timeoutMs]);

  const onReady = useCallback(async () => setStatus((s) => (s === "failed" ? s : "ready")), []);
  const onFailed = useCallback(async (_message: string) => setStatus("failed"), []);
  return { status, onReady, onFailed };
}

export class DomBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function ClayzoLayer({ status, onFailed, style, fallback, children }: {
  status: ClayzoStatus;
  onFailed: (message: string) => Promise<void>;
  style?: StyleProp<ViewStyle>;
  fallback: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={style} pointerEvents="none">
      {status !== "ready" ? <View style={StyleSheet.absoluteFill}>{fallback}</View> : null}
      {status !== "failed" ? (
        <View style={[StyleSheet.absoluteFill, status === "loading" && styles.hidden]}>
          <DomBoundary onError={() => void onFailed("render error")}>{children}</DomBoundary>
        </View>
      ) : null}
    </View>
  );
}

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => mounted && setReduce(value), () => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

export function useLoop(duration: number, enabled: boolean) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    value.setValue(0);
    if (!enabled) return;
    const loop = Animated.loop(Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [value, duration, enabled]);
  return value;
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
});
