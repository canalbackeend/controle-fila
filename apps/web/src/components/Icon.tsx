const paths = {
  building: "M3 21h18M5 21V4h10v17m0-12h4v12M8 8h4m-4 4h4m-4 4h4",
  devices: "M3 4h18v11H3V4Zm5 16h8m-4-5v5",
  dashboard: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z",
  content: "M3 4h18v16H3V4Zm1 12 5-5 4 4 3-3 4 4M16 8h.01",
  chart: "M4 4v16h16M9 16v-4m5 4V7m5 9v-7",
  settings: "M4 7h16M4 17h16m-11-7V4m6 16v-6",
  headset:
    "M4 13v-1a8 8 0 0 1 16 0v5a3 3 0 0 1-3 3h-3M4 13h4v6H6a2 2 0 0 1-2-2v-4Zm16 0h-4v6h2",
  user: "M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21a8 8 0 0 1 16 0",
  logout: "M10 4H4v16h6m4-12 4 4-4 4m-6-4h10",
  services: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  desk: "M3 10h18v4H3v-4Zm2 4v7m14-7v7M8 10V5h8v5",
  team: "M15 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m10-13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm8 13v-2a4 4 0 0 0-3-4m-2-11a4 4 0 0 1 0 8",
  layers: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.5-11.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6m0 3h.01",
  plus: "M12 4v16M4 12h16",
  edit: "m15 5 4 4M4 20l5-1 11-11a2.8 2.8 0 0 0-4-4L5 15l-1 5Z",
  check: "m4 12 5 5L20 6",
  close: "m6 6 12 12M18 6 6 18",
  lock: "M5 10h14v11H5V10Zm3 0V7a4 4 0 0 1 8 0v3m-4 4v3",
  unlock: "M5 10h14v11H5V10Zm3 0V7a4 4 0 0 1 7-2m-3 9v3",
  key: "M15 14a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-4-1-7 7v-4l5-5",
  copy: "M8 8h12v12H8V8Zm8-4H4v12",
  external: "M13 4h7v7m0-7-9 9m7 0v7H4V6h7",
  download: "M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4",
  filter: "M3 5h18l-7 8v5l-4 2v-7L3 5Z",
  trash: "M3 6h18M7 6l1 14h8l1-14m-7 0V3h4v3",
} as const;

export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      className="ui-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
