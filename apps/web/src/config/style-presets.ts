export const PRESET_STORAGE_KEY = "crm-style-preset";

export const STYLE_PRESETS = [
  {
    id: "claude_blue_2",
    label: "Claude Blue",
    description: "Soft blue surfaces",
  },
  {
    id: "logistic_one",
    label: "Logistic One",
    description: "Original brand tokens",
  },
  {
    id: "telesto",
    label: "Telesto",
    description: "Vibrant blue, flat dark",
  },
] as const;

export type StylePresetId = (typeof STYLE_PRESETS)[number]["id"];

export const DEFAULT_STYLE_PRESET: StylePresetId = "claude_blue_2";

export function isStylePresetId(value: string | null | undefined): value is StylePresetId {
  return STYLE_PRESETS.some((preset) => preset.id === value);
}
