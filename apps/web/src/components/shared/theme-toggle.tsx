"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * Light / dark / system switcher.
 *
 * The trigger swaps its icon with CSS rather than with React state. The server
 * cannot know the visitor's theme, so rendering the icon from `useTheme()`
 * would either mismatch on hydration or need a mounted flag that blanks the
 * button on first paint. Both icons are in the DOM and the `dark:` variant
 * decides which one is visible, so the markup is identical on both sides.
 *
 * The menu content only exists once opened, which is always after hydration, so
 * reading the active theme there is safe.
 */
export function ThemeToggle({
  className,
  align = "end",
}: {
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          aria-label="Change theme"
        >
          <Sun
            className="size-4 rotate-0 scale-100 transition-transform duration-200 dark:-rotate-90 dark:scale-0"
            aria-hidden
          />
          <Moon
            className="absolute size-4 rotate-90 scale-0 transition-transform duration-200 dark:rotate-0 dark:scale-100"
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="w-36">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon className="size-4" aria-hidden />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
