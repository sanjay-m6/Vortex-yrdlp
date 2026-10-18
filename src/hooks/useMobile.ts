import { useState, useEffect } from "react";

export function useMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const isSmallScreen = window.innerWidth < breakpoint;
    const isAndroid = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    return isSmallScreen || isAndroid;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkMobile = () => {
      const isSmallScreen = window.innerWidth < breakpoint;
      const isAndroid = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      setIsMobile(isSmallScreen || isAndroid);
    };

    window.addEventListener("resize", checkMobile);
    window.addEventListener("orientationchange", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("orientationchange", checkMobile);
    };
  }, [breakpoint]);

  return isMobile;
}

export default useMobile;
