import type { SVGProps } from "react";
const paths = {
  dashboard: ["M3 3h7v7H3z", "M14 3h7v5h-7z", "M3 14h7v7H3z", "M14 12h7v9h-7z"],
  purchase: [
    "M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7h9a2 2 0 0 0 2-1.7L22 7H6",
    "M10 21h.01",
    "M19 21h.01",
  ],
  receive: [
    "M3 7l9-5 9 5-9 5z",
    "M3 7v10l9 5 4-2",
    "M12 12v10",
    "M21 7v5",
    "M16 17l2 2 4-4",
  ],
  quote: ["M9 4H5v17h14V4h-4", "M9 2h6v4H9z", "M8 11h8", "M8 15h5"],
  sale: ["M5 3h14v18l-3-2-4 2-4-2-3 2z", "M8 8h8", "M8 12h5", "M8 16h8"],
  invoice: [
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
    "M14 2v6h6",
    "M8 13h8",
    "M8 17h5",
  ],
  wallet: [
    "M21 8H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14v5",
    "M3 6v13a2 2 0 0 0 2 2h16V8",
    "M21 12h-5v5h5",
    "M17.5 14.5h.01",
  ],
  movement: ["M3 7h17", "M16 3l4 4-4 4", "M21 17H4", "M8 13l-4 4 4 4"],
  stock: [
    "M3 7l9-5 9 5-9 5z",
    "M3 7v10l9 5 9-5V7",
    "M12 12v10",
    "M7.5 4.5l9 5",
  ],
  report: ["M3 3v18h18", "M7 16v-5", "M12 16V7", "M17 16v-8"],
  route: ["M5 20V10", "M5 10c0-3 5-3 5 0s5 3 5 0 5-3 5 0v10", "M5 20h14", "M9 4h6"],
  commission: ["M4 20V4h16v16z", "M8 15l2-3 3 2 3-5", "M8 8h.01", "M16 16h.01"],
  settings: [
    "M4 7h5",
    "M13 7h7",
    "M4 17h9",
    "M17 17h3",
    "M9 4v6h4V4z",
    "M13 14v6h4v-6z",
  ],
  search: ["M21 21l-4.6-4.6", "M18 10a8 8 0 1 0-16 0 8 8 0 0 0 16 0"],
  chevron: ["M9 5l7 7-7 7"],
  down: ["M6 9l6 6 6-6"],
  close: ["M6 6l12 12", "M18 6 6 18"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  moon: ["M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13z"],
  sun: [
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
    "M12 2v2",
    "M12 20v2",
    "M2 12h2",
    "M20 12h2",
    "M4.9 4.9l1.4 1.4",
    "M17.7 17.7l1.4 1.4",
    "M4.9 19.1l1.4-1.4",
    "M17.7 6.3l1.4-1.4",
  ],
  building: [
    "M6 21V3h12v18",
    "M2 21h20",
    "M10 21v-4h4v4",
    "M10 7h4",
    "M10 11h4",
  ],
  plus: ["M12 5v14", "M5 12h14"],
  download: ["M12 3v12", "M7 10l5 5 5-5", "M4 16v5h16v-5"],
  arrow: ["M5 12h14", "M14 7l5 5-5 5"],
  calendar: ["M8 2v4", "M16 2v4", "M3 10h18", "M3 4h18v18H3z"],
  eye: [
    "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7",
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  ],
  alert: ["M12 3 2 21h20z", "M12 9v5", "M12 17h.01"],
  check: ["M5 12l4 4L19 6"],
  empty: ["M4 4h16v16H4z", "M4 13h4l2 3h4l2-3h4"],
  line: ["M3 3v18h18", "M6 15l5-6 4 3 5-7"],
  panel: ["M3 3h18v18H3z", "M9 3v18", "M5 7h2", "M5 11h2"],
  users: [
    "M8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
    "M2 21v-3a6 6 0 0 1 12 0v3",
    "M17 3a4 4 0 0 1 0 8",
    "M17 15a5 5 0 0 1 5 5v1",
  ],
  shield: ["M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6z", "M8 12l3 3 5-6"],
  clock: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18", "M12 7v5l3 2"],
  mail: ["M3 4h18v16H3z", "M3 4l9 8 9-8"],
  filter: ["M4 6h16", "M7 12h10", "M10 18h4"],
  external: ["M14 3h7v7", "M21 3 10 14", "M10 3H3v18h18v-7"],
  edit: ["M15 4l5 5", "M3 21l5-1 13-13-5-5L3 15z"],
  lock: ["M6 10h12v11H6z", "M8 10V6a4 4 0 0 1 8 0v4"],
  brand: ["M4 5h7v7H4z", "M14 5h6v4h-6z", "M4 15h7v4H4z", "M14 12h6v7h-6z"],
} as const;
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 18,
  ...props
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name].map((d, i) => (
        <path d={d} key={i} />
      ))}
    </svg>
  );
}
export const moduleIcon: Record<string, IconName> = {
  "/dashboard": "dashboard",
  "/orden-compra": "purchase",
  "/ingreso-kardex": "receive",
  "/cotizacion": "quote",
  "/orden-venta": "sale",
  "/facturacion": "invoice",
  "/estado-cuenta": "wallet",
  "/movimiento-kardex": "movement",
  "/stock-productos": "stock",
  "/logistica": "route",
  "/comisiones": "commission",
  "/reportes": "report",
  "/mantenimientos": "settings",
  "/administracion/usuarios": "shield",
  "/administracion/roles": "shield",
  "/administracion/permisos": "shield",
  "/administracion/auditoria": "report",
};
