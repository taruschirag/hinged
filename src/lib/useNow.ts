import { useEffect, useState } from "react";

export function useNow(stepMs = 15000) {
  const round = () => Math.floor(Date.now() / stepMs) * stepMs;
  const [now, setNow] = useState(round);
  useEffect(() => {
    const id = setInterval(() => setNow(round()), 1000);
    return () => clearInterval(id);
  }, [stepMs]);
  return now;
}
