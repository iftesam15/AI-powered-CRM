import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * Adapted from the shadcn/ui default, which set state inside an effect and so
 * rendered once at the wrong breakpoint before correcting itself. Reading the
 * media query through `useSyncExternalStore` gives the right answer on the
 * first client render and keeps the server snapshot explicit.
 */
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

/** The server has no viewport, so it renders the desktop layout. */
function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
