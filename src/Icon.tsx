const paths = {
  home: 'm3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9',
  calendar: 'M4 6h16v15H4zM8 3v6m8-6v6M4 11h16',
  team: 'M15 20v-2a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v2m18 0v-2a3 3 0 0 0-3-3M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7-7a3.5 3.5 0 0 1 0 7',
  stats: 'M3 21h18M6 17v-4m6 4V8m6 9V3',
  play: 'M7 4v16l13-8z',
  chevron: 'm9 6 6 6-6 6',
  back: 'm12 5-7 7 7 7M5 12h15',
  shield: 'm12 3 8 4v5c0 4-4 7-8 9-4-2-8-5-8-9V7z',
  basketball: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3v18M5.5 5.8a7.7 7.7 0 0 1 0 12.4m13-12.4a7.7 7.7 0 0 0 0 12.4',
  settings: 'M4 7h16M4 12h16M4 17h16M8 5v4m8 1v4m-6 1v4',
  undo: 'M8 5 3 10l5 5M3 10h11a5 5 0 0 1 0 10h-3',
  rotate: 'M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5m4-5v5',
  close: 'm6 6 12 12M18 6 6 18',
}

export type IconName = keyof typeof paths

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>
}
