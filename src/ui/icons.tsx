// One 24-grid drawing per name, stroked in `currentColor` so a button's own colour carries into
// it. Drawn here rather than pulled from an icon package: the set is this small, and the
// dependency surface stays at react + react-dom.
const ICONS = {
  mark: (
    <g>
      <path d="M5 3h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM15 13h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z" fill="currentColor" stroke="none" />
      <path d="M15.5 3.9h3a1.6 1.6 0 0 1 1.6 1.6v3a1.6 1.6 0 0 1-1.6 1.6h-3A1.6 1.6 0 0 1 13.9 8.5v-3a1.6 1.6 0 0 1 1.6-1.6zM5.5 13.9h3a1.6 1.6 0 0 1 1.6 1.6v3a1.6 1.6 0 0 1-1.6 1.6h-3A1.6 1.6 0 0 1 3.9 18.5v-3a1.6 1.6 0 0 1 1.6-1.6z" />
    </g>
  ),
  brush: <path d="m4.5 19.5 1.7-5 8.4-8.4 3.3 3.3-8.4 8.4zM14.6 6.1 17 3.7a1.6 1.6 0 0 1 2.3 0l1 1a1.6 1.6 0 0 1 0 2.3l-2.4 2.4" />,
  outline: <path d="M6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4zM10 8.5h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 8.5 14v-4A1.5 1.5 0 0 1 10 8.5z" />,
  // A dot per subpath, each an arc drawn back onto its own start — the one shape a plain `d`
  // can spell that a stroked outline cannot fake at this size.
  scatter: <path d="M7 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3zM13.5 4.4a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 1 0 0-2.2zM17.5 8.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2zM10.5 10.7a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 1 0 0-2.6zM6 15.3a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 1 0 0-2.4zM14 16a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3zM19 15a1 1 0 1 0 0 2 1 1 0 1 0 0-2z" fill="currentColor" stroke="none" />,
  eraser: <path d="m8.5 20.5-4.6-4.6a2 2 0 0 1 0-2.8l9-9a2 2 0 0 1 2.8 0l4.6 4.6a2 2 0 0 1 0 2.8l-9 9zM8.3 8.7l7 7M8.5 20.5H20" />,
  fill: <path d="M12.4 4.2 4.9 11.7a2 2 0 0 0 0 2.8l5 5a2 2 0 0 0 2.8 0l7.5-7.5zM9.6 7 6.8 4.2M20 15.2c1 1.4 1.5 2.3 1.5 3a1.5 1.5 0 0 1-3 0c0-.7.5-1.6 1.5-3z" />,
  picker: <path d="M18.8 5.2a2.4 2.4 0 0 0-3.4 0l-2 2-1.1-1.1-1.5 1.5 1.1 1.1-6.4 6.4L5 19l3.9-.5 6.4-6.4 1.1 1.1 1.5-1.5-1.1-1.1 2-2a2.4 2.4 0 0 0 0-3.4z" />,
  stamp: <path d="M9.6 4.5h4.8a1.5 1.5 0 0 1 1.5 1.8l-.9 4.7h2.5a2 2 0 0 1 2 2v2.5h-15V13a2 2 0 0 1 2-2H9l-.9-4.7a1.5 1.5 0 0 1 1.5-1.8zM4 19.5h16" />,
  select: <rect x="4" y="4" width="16" height="16" rx="1.5" strokeDasharray="3.6 2.8" />,
  move: <path d="M12 3.2v17.6M3.2 12h17.6M12 3.2 9.4 5.8M12 3.2l2.6 2.6M12 20.8l-2.6-2.6M12 20.8l2.6-2.6M3.2 12l2.6-2.6M3.2 12l2.6 2.6M20.8 12l-2.6-2.6M20.8 12l-2.6 2.6" />,
  undo: <path d="M4 9h9.5a5.5 5.5 0 0 1 0 11H8M4 9l4.2-4.2M4 9l4.2 4.2" />,
  redo: <path d="M20 9h-9.5a5.5 5.5 0 0 0 0 11H16M20 9l-4.2-4.2M20 9l-4.2 4.2" />,
  import: <path d="M6 3.5h12a2.5 2.5 0 0 1 2.5 2.5v12a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5zM12 7v6.5M9.2 10.7 12 13.5l2.8-2.8" />,
  importLayer: <path d="M12 3.4 3.6 7.7 12 12l8.4-4.3zM3.6 13 12 17.3l3.6-1.8M18.5 13.6V19M15.8 16.3h5.4" />,
  export: <path d="M12 3.5v11M7.6 10.1 12 14.5l4.4-4.4M4.5 16.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" />,
  square: <rect x="5.5" y="5.5" width="13" height="13" rx="1" />,
  circle: <circle cx="12" cy="12" r="7" />,
  cutout: <path d="M6.2 15.7a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 1 0 0-4.6zM6.2 3.7a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 1 0 0-4.6zM8.2 7.2 19.5 19M8.2 16.8 19.5 5" />,
}

export type IconName = keyof typeof ICONS

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  )
}
