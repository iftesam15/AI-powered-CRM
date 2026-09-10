"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_STYLE_PRESET,
  PRESET_STORAGE_KEY,
  isStylePresetId,
  type StylePresetId,
} from "@/config/style-presets";

type StylePresetContextValue = {
  preset: StylePresetId;
  setPreset: (preset: StylePresetId) => void;
};

const StylePresetContext = createContext<StylePresetContextValue | null>(null);

function applyPresetToDocument(preset: StylePresetId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-preset", preset);
}

export function StylePresetProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<StylePresetId>(DEFAULT_STYLE_PRESET);

  useEffect(() => {
    const stored = window.localStorage.getItem(PRESET_STORAGE_KEY);
    const next = isStylePresetId(stored) ? stored : DEFAULT_STYLE_PRESET;
    setPresetState(next);
    applyPresetToDocument(next);
  }, []);

  const setPreset = useCallback((next: StylePresetId) => {
    setPresetState(next);
    applyPresetToDocument(next);
    window.localStorage.setItem(PRESET_STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ preset, setPreset }), [preset, setPreset]);

  return <StylePresetContext.Provider value={value}>{children}</StylePresetContext.Provider>;
}

export function useStylePreset() {
  const ctx = useContext(StylePresetContext);
  if (!ctx) {
    throw new Error("useStylePreset must be used within StylePresetProvider");
  }
  return ctx;
}
