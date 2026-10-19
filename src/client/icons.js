// Inner SVG markup for the step icons, drawn on a 24×24 viewBox with stroke 2.
// Shapes follow lucide (ISC licence): circle-ellipsis, circle-dashed, circle-check.

export const ICON_PATHS = {
  in_progress:
    '<circle cx="12" cy="12" r="10"/><path d="M17 12h.01"/><path d="M12 12h.01"/><path d="M7 12h.01"/>',
  pending:
    '<path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/>' +
    '<path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/>' +
    '<path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/>' +
    '<path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/>',
  completed: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
}

// Waiting-for-input ring: outline circle with a filled centre dot.
export const WAIT_RING =
  '<circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
  '<circle cx="8" cy="8" r="4.5" fill="currentColor"/>'
