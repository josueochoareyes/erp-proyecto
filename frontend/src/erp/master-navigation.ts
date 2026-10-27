import type { IconName } from "./icons";

export type Catalog = "Empresas" | "Sucursales" | "Almacenes" | "Productos" | "Categorías" | "Marcas" | "Unidades" | "Conversiones" | "Clientes" | "Proveedores" | "Transportistas" | "Vendedores" | "Zonas" | "Monedas" | "Impuestos" | "Formas de pago" | "Listas de precios";

export const masterCatalogs: Array<{ tab: Catalog; path: string; label: string }> = [
  { tab: "Empresas", path: "/maestros/empresa", label: "Empresas" },
  { tab: "Sucursales", path: "/maestros/sucursales", label: "Sucursales" },
  { tab: "Almacenes", path: "/maestros/almacenes", label: "Almacenes" },
  { tab: "Productos", path: "/maestros/productos", label: "Catálogo" },
  { tab: "Categorías", path: "/maestros/categorias", label: "Categorías" },
  { tab: "Marcas", path: "/maestros/marcas", label: "Marcas" },
  { tab: "Unidades", path: "/maestros/unidades", label: "Unidades de medida" },
  { tab: "Conversiones", path: "/maestros/conversiones", label: "Conversiones" },
  { tab: "Clientes", path: "/maestros/clientes", label: "Clientes" },
  { tab: "Proveedores", path: "/maestros/proveedores", label: "Proveedores" },
  { tab: "Transportistas", path: "/maestros/transportistas", label: "Transportistas" },
  { tab: "Vendedores", path: "/maestros/vendedores", label: "Vendedores" },
  { tab: "Zonas", path: "/maestros/zonas", label: "Zonas" },
  { tab: "Listas de precios", path: "/maestros/listas-precios", label: "Listas de precios" },
  { tab: "Monedas", path: "/maestros/monedas", label: "Monedas y tipos de cambio" },
  { tab: "Impuestos", path: "/maestros/impuestos", label: "Impuestos" },
  { tab: "Formas de pago", path: "/maestros/formas-pago", label: "Formas de pago" },
];

export const masterGroups: Array<{ name: string; path: string; icon: IconName; description: string; tabs: Catalog[] }> = [
  { name: "Organización", path: "/maestros/organizacion", icon: "building", description: "Empresas, sucursales y almacenes de la operación.", tabs: ["Empresas", "Sucursales", "Almacenes"] },
  { name: "Productos", path: "/maestros/productos", icon: "empty", description: "Catálogo de productos, clasificación y unidades de medida.", tabs: ["Productos", "Categorías", "Marcas", "Unidades", "Conversiones"] },
  { name: "Terceros", path: "/maestros/terceros", icon: "users", description: "Datos compartidos de clientes, proveedores y transportistas.", tabs: ["Clientes", "Proveedores", "Transportistas"] },
  { name: "Gestión comercial", path: "/maestros/gestion-comercial", icon: "line", description: "Vendedores, zonas comerciales y listas de precios.", tabs: ["Vendedores", "Zonas", "Listas de precios"] },
  { name: "Monedas, impuestos y pagos", path: "/maestros/monedas-impuestos-pagos", icon: "wallet", description: "Monedas, tipos de cambio, tributos y formas de pago.", tabs: ["Monedas", "Impuestos", "Formas de pago"] },
];

export function masterTabForPath(path: string): Catalog | undefined {
  if (path === "/mantenimientos" || path === "/maestros") return "Empresas";
  return masterCatalogs.find((catalog) => catalog.path === path)?.tab
    ?? masterGroups.find((group) => group.path === path)?.tabs[0];
}
