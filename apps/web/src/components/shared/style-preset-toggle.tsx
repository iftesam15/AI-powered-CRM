"use client";

import { Palette } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STYLE_PRESETS, type StylePresetId } from "@/config/style-presets";
import { useStylePreset } from "@/providers/style-preset-provider";
import { cn } from "@/lib/utils";

export function StylePresetToggle({
  className,
  align = "end",
}: {
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const { preset, setPreset } = useStylePreset();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(className)}
          aria-label="Change style preset"
          title="Style preset"
        >
          <Palette className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="w-52">
        <DropdownMenuLabel>Style preset</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={preset}
          onValueChange={(value) => setPreset(value as StylePresetId)}
        >
          {STYLE_PRESETS.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id} className="items-start py-2">
              <span className="flex flex-col gap-0.5">
                <span className="leading-none">{option.label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
