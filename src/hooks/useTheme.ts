import { useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { useSettingsStore, ThemeMode } from "../stores/settingsStore";

export type ThemeTriggerEvent =
  | React.MouseEvent<any>
  | MouseEvent
  | { clientX?: number; clientY?: number; currentTarget?: any }
  | null
  | undefined;

/**
 * Applies the dark or light class and color-scheme properties directly to the DOM root element.
 */
export function applyThemeToDom(isDark: boolean) {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
    root.setAttribute("data-theme", "dark");
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    root.setAttribute("data-theme", "light");
  }
}

/**
 * Spawns a tactile glowing droplet ripple wave at the origin coordinates.
 */
function spawnDropletRipple(x: number, y: number, isTargetDark: boolean) {
  if (typeof document === "undefined") return;

  const ripple = document.createElement("div");
  ripple.className = "theme-splash-droplet";
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  ripple.style.borderColor = isTargetDark
    ? "rgba(129, 140, 248, 0.75)"
    : "rgba(245, 158, 11, 0.75)";
  ripple.style.boxShadow = isTargetDark
    ? "0 0 20px 4px rgba(99, 102, 241, 0.45)"
    : "0 0 20px 4px rgba(245, 158, 11, 0.45)";

  document.body.appendChild(ripple);
  setTimeout(() => {
    ripple.remove();
  }, 600);
}

/**
 * Fallback splash animation overlay when Document View Transitions API is not available.
 */
function runFallbackSplash(
  x: number,
  y: number,
  endRadius: number,
  targetTheme: ThemeMode,
  targetIsDark: boolean,
  setTheme: (t: ThemeMode) => void
) {
  const splash = document.createElement("div");
  splash.style.position = "fixed";
  splash.style.inset = "0";
  splash.style.zIndex = "999999";
  splash.style.pointerEvents = "none";
  splash.style.backgroundColor = targetIsDark ? "#0B0F19" : "#F8FAFC";
  splash.style.clipPath = `circle(0px at ${x}px ${y}px)`;
  splash.style.transition = "clip-path 480ms cubic-bezier(0.22, 1, 0.36, 1)";
  document.body.appendChild(splash);

  // Force style calculation
  splash.getBoundingClientRect();
  splash.style.clipPath = `circle(${endRadius}px at ${x}px ${y}px)`;

  setTimeout(() => {
    setTheme(targetTheme);
    applyThemeToDom(targetIsDark);
    splash.style.transition = "opacity 200ms ease";
    splash.style.opacity = "0";
    setTimeout(() => splash.remove(), 220);
  }, 440);
}

export function useTheme() {
  const { theme, setTheme } = useSettingsStore();

  // Keep DOM synchronized on initial render and system preference changes
  useEffect(() => {
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      applyThemeToDom(mediaQuery.matches);

      const listener = (e: MediaQueryListEvent) => {
        applyThemeToDom(e.matches);
      };

      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    } else {
      applyThemeToDom(theme === "dark");
    }
  }, [theme]);

  const resolveTargetIsDark = useCallback((target: ThemeMode): boolean => {
    if (target === "system") {
      return (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    }
    return target === "dark";
  }, []);

  /**
   * Switches theme with a circular splash ripple animation starting from the click position.
   */
  const switchThemeWithSplash = useCallback(
    (targetTheme: ThemeMode, event?: ThemeTriggerEvent) => {
      if (targetTheme === theme) return;

      const targetIsDark = resolveTargetIsDark(targetTheme);

      // 1. Calculate origin coordinates (x, y)
      let x = typeof window !== "undefined" ? window.innerWidth / 2 : 0;
      let y = typeof window !== "undefined" ? window.innerHeight / 2 : 0;

      if (event) {
        if (
          typeof event.clientX === "number" &&
          typeof event.clientY === "number" &&
          (event.clientX !== 0 || event.clientY !== 0)
        ) {
          x = event.clientX;
          y = event.clientY;
        } else if (
          event.currentTarget &&
          typeof (event.currentTarget as HTMLElement).getBoundingClientRect === "function"
        ) {
          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          x = rect.left + rect.width / 2;
          y = rect.top + rect.height / 2;
        }
      }

      // 2. Calculate maximum radius to cover the entire viewport
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      // Spawn droplet wave
      spawnDropletRipple(x, y, targetIsDark);

      // 3. View Transitions API (Native Chromium / WebView2)
      const doc = document as unknown as {
        startViewTransition?: (cb: () => void | Promise<void>) => {
          ready: Promise<void>;
          finished: Promise<void>;
        };
      };

      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!doc.startViewTransition || prefersReducedMotion) {
        // Fallback smooth splash overlay
        runFallbackSplash(x, y, endRadius, targetTheme, targetIsDark, setTheme);
        return;
      }

      // Prevent transient CSS property transitions from glitching the transition snapshot
      document.documentElement.classList.add("theme-transitioning");

      const transition = doc.startViewTransition(() => {
        flushSync(() => {
          setTheme(targetTheme);
          applyThemeToDom(targetIsDark);
        });
      });

      transition.ready
        .then(() => {
          const animation = document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 480,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              pseudoElement: "::view-transition-new(root)",
            }
          );
          return animation.finished;
        })
        .catch(() => {})
        .finally(() => {
          document.documentElement.classList.remove("theme-transitioning");
        });
    },
    [theme, setTheme, resolveTargetIsDark]
  );

  /**
   * Cycles theme in order: light -> dark -> system -> light with splash animation.
   */
  const cycleThemeWithSplash = useCallback(
    (event?: ThemeTriggerEvent) => {
      let nextTheme: ThemeMode = "light";
      if (theme === "light") nextTheme = "dark";
      else if (theme === "dark") nextTheme = "system";
      else nextTheme = "light";

      switchThemeWithSplash(nextTheme, event);
    },
    [theme, switchThemeWithSplash]
  );

  /**
   * Toggles directly between light and dark modes with splash animation.
   */
  const toggleThemeWithSplash = useCallback(
    (event?: ThemeTriggerEvent) => {
      const isCurrentlyDark = resolveTargetIsDark(theme);
      const nextTheme: ThemeMode = isCurrentlyDark ? "light" : "dark";
      switchThemeWithSplash(nextTheme, event);
    },
    [theme, resolveTargetIsDark, switchThemeWithSplash]
  );

  const isDark = resolveTargetIsDark(theme);

  return {
    theme,
    isDark,
    setTheme,
    switchThemeWithSplash,
    setThemeWithSplash: switchThemeWithSplash,
    cycleThemeWithSplash,
    toggleThemeWithSplash,
  };
}
