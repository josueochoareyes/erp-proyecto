import { SupplierDetailsTrigger, matchesSupplier } from "./erp/suppliers";
import { Component, useEffect, useState, type ReactNode } from "react";
import { ErpProvider, useErp } from "./erp/store";
import { Operations, Quotes, routes, administrationRoutes } from "./erp/pages";
import { Catalogs } from "./erp/catalogs";
import { masterCatalogs, masterGroups, masterTabForPath } from "./erp/master-navigation";
import { AccessControl, ProfileDrawer, avatarToneClass, userInitials, type AccessSection } from "./erp/access-control";
import { Dashboard, Reports } from "./erp/reports";
import { Modal } from "./erp/ui";
import { Icon, moduleIcon } from "./erp/icons";
import { ToastHost } from "./erp/toast";
import { EnterpriseCloudLogo } from "./erp/brand-logo";
const aliases: Record<string, string> = {
  "/": "/dashboard",
  "/inventario/kardex": "/movimiento-kardex",
  "/inventario/productos": "/stock-productos",
  "/comercial/cotizaciones": "/cotizacion",
  "/comercial/ventas": "/orden-venta",
  "/comercial/facturacion": "/facturacion",
  "/compras/ordenes": "/orden-compra",
  "/compras/recepcion": "/ingreso-kardex",
  "/finanzas/cuentas-por-cobrar": "/estado-cuenta",
  "/usuarios-roles": "/administracion/usuarios",
  "/administracion": "/administracion/usuarios",
  "/maestros": "/mantenimientos",
};
function Shell() {
  const { state, storageError } = useErp();
  const [path, setPath] = useState(
    () => aliases[location.pathname] ?? location.pathname,
  );
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const [dark, setDark] = useState(
    () => localStorage.getItem("enterprisecloud-theme") === "dark",
  );
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const currentUser =
    state.users?.find((user) => user.id === state.currentUserId) ??
    state.users?.[0] ?? {
      id: "USR-001",
      name: "Administrador",
      email: "admin@enterprisecloud.pe",
      roleId: "ROL-ADMIN",
      active: true,
      lastAccess: new Date().toISOString(),
    };
  const currentRole = state.roles?.find((role) => role.id === currentUser.roleId);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const fn = () => setPath(aliases[location.pathname] ?? location.pathname);
    addEventListener("popstate", fn);
    return () => removeEventListener("popstate", fn);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("enterprisecloud-theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);
  const go = (next: string) => {
    history.pushState(null, "", next);
    setPath(next);
    setMobile(false);
    setSearch(false);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const a = (e.target as Element).closest("a");
      if (
        a?.getAttribute("href")?.startsWith("/") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        e.button === 0
      ) {
        e.preventDefault();
        go(a.getAttribute("href")!);
      }
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  const current = [...administrationRoutes, ...routes].find((r) => r.path === path);
  const masterTab = masterTabForPath(path);
  const activeMasterGroup = masterGroups.find((group) => masterTab && group.tabs.includes(masterTab));
  const isMastersPath = masterTab !== undefined;
  const currentGroup = path.startsWith("/administracion/")
    ? "Administración"
    : isMastersPath
      ? "Maestros"
    : routes.find((r) => r.path === path)?.group ?? "Inicio";
  useEffect(() => {
    const group = isMastersPath
      ? "Maestros"
      : routes.find((r) => r.path === path)?.group;
    if (group) setClosedGroups((list) => list.filter((g) => g !== group));
  }, [path]);
  const groups = [...new Set(routes.map((r) => r.group))].flatMap((group) =>
    group === "Administración" ? ["Maestros", group] : [group],
  );
  let page;
  if (path === "/dashboard") page = <Dashboard />;
  else if (path === "/cotizacion") page = <Quotes />;
  else if (path === "/reportes") page = <Reports />;
  else if (isMastersPath) page = <Catalogs key={path} initialTab={masterTab} onNavigate={go} />;
  else if (path.startsWith("/administracion/")) {
    const section: AccessSection = path.endsWith("/roles")
      ? "roles"
      : path.endsWith("/permisos")
        ? "matriz"
        : path.endsWith("/auditoria")
          ? "auditoria"
          : "usuarios";
    page = <AccessControl initialSection={section} />;
  }
  else if (current) page = <Operations key={path} view={path.slice(1)} />;
  else
    page = (
      <section className="card empty">
        <h1>Página no disponible</h1>
        <p>
          Los módulos anteriores fueron reemplazados por la nueva operación
          integrada.
        </p>
        <button className="btn" onClick={() => go("/dashboard")}>
          Abrir resumen ejecutivo
        </button>
      </section>
    );
  return (
    <div
      className={`app integrated-shell ${collapsed ? "is-collapsed" : ""} ${mobile ? "mobile-open" : ""}`}
    >
      <aside className="integrated-sidebar">
        <header>
          <a href="/dashboard" className="brand">
            <EnterpriseCloudLogo compact={collapsed} />
          </a>
          <button
            className="ic mobile-close"
            aria-label="Cerrar menú"
            onClick={() => setMobile(false)}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="company-card">
          <span className="company-icon">
            <Icon name="building" />
          </span>
          {!collapsed && (
            <span>
              <strong>{state.settings.company}</strong>
              <small>Espacio de trabajo</small>
            </span>
          )}
        </div>
        <nav aria-label="Módulos principales">
          {groups.map((group) => (
            <section key={group} className="navigation-group">
              {!collapsed && (
                <button
                  className="menu-group"
                  aria-expanded={!closedGroups.includes(group)}
                  aria-controls={`group-${group}`}
                  onClick={() =>
                    setClosedGroups((list) =>
                      list.includes(group)
                        ? list.filter((g) => g !== group)
                        : [...list, group],
                    )
                  }
                >
                  {group}
                  <Icon name="down" size={13} />
                </button>
              )}
              <div
                id={`group-${group}`}
                className={`navigation-submenu ${!collapsed && closedGroups.includes(group) ? "is-closed" : ""}`}
              >
                <div className="navigation-submenu-inner">
                  {group === "Maestros"
                    ? masterGroups.map((child) => (
                        <a
                          key={child.path}
                          href={child.path}
                          title={child.name}
                          className={activeMasterGroup === child ? "menu-link is-child active" : "menu-link is-child"}
                          aria-current={activeMasterGroup === child ? "page" : undefined}
                        >
                          <Icon name={child.icon} size={16} />
                          {!collapsed && child.name}
                        </a>
                      ))
                    : routes
                    .filter((r) => r.group === group && r.path !== "/mantenimientos")
                    .map((r) => {
                      const isAdministration = r.path === "/administracion/usuarios";
                      if (isAdministration) {
                        return (
                          <div className="menu-node" key={r.path}>
                            {administrationRoutes.map((child) => (
                              <a
                                key={child.path}
                                href={child.path}
                                className={path === child.path ? "menu-link active" : "menu-link"}
                                aria-current={path === child.path ? "page" : undefined}
                              >
                                <Icon name={moduleIcon[child.path]} size={18} />
                                {!collapsed && child.name}
                              </a>
                            ))}
                          </div>
                        );
                      }
                      return (
                        <div className="menu-node" key={r.path}>
                          <a
                            href={r.path}
                            title={r.name}
                            className={path === r.path ? "menu-link active" : "menu-link"}
                            aria-current={path === r.path ? "page" : undefined}
                          >
                            <Icon name={moduleIcon[r.path]} size={18} />
                            {!collapsed && r.name}
                          </a>
                        </div>
                      );
                    })}
                </div>
              </div>
            </section>
          ))}
        </nav>
        <footer>
          <button className="profile-button" onClick={() => setProfile(true)}>
            <span className={`av ${avatarToneClass(currentUser.avatar)}`}>{userInitials(currentUser.name)}</span>
            {!collapsed && (
              <span>
                {currentUser.name}<small>{currentRole?.name ?? "Perfil local"}</small>
              </span>
            )}
          </button>
          <button
            className="ic"
            aria-label="Cambiar tema"
            onClick={() => setDark((d) => !d)}
          >
            <Icon name={dark ? "sun" : "moon"} size={17} />
          </button>
          <button
            className="ic sidebar-toggle"
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
            onClick={() => setCollapsed((c) => !c)}
          >
            <Icon name="panel" size={17} />
          </button>
        </footer>
      </aside>
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Cerrar navegación"
          onClick={() => setMobile(false)}
        />
      )}
      <main>
        <header className="workspace-top">
          <button
            className="ic mobile-toggle"
            aria-label="Abrir o cerrar menú"
            onClick={() => setMobile((m) => !m)}
          >
            <Icon name="menu" />
          </button>
          <div className="breadcrumb">
              EnterpriseCloud <span>/</span> {currentGroup}{" "}
            <span>/</span> {activeMasterGroup?.name ?? current?.name ?? "Página"}
          </div>
          <div className="workspace-tools">
            <button
              className="search-trigger"
              onClick={() => {
                setQuery("");
                setSearch(true);
              }}
            >
              <Icon name="search" size={16} /> <span>Buscar en el sistema…</span>{" "}
              <kbd>Ctrl K</kbd>
            </button>
            <button className="header-user" onClick={() => setProfile(true)}>
              <span className={`header-user-avatar ${avatarToneClass(currentUser.avatar)}`}>{userInitials(currentUser.name)}</span>
              <span className="header-user-copy">
                <strong>{currentUser.name}</strong>
                <small>{currentRole?.name ?? "Perfil local"}</small>
              </span>
            </button>
            <time
              className="workspace-clock"
              dateTime={clock.toISOString()}
              title="Hora local del navegador"
            >
              <Icon name="clock" size={15} />
              <span>
                {new Intl.DateTimeFormat("es-PE", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                }).format(clock)}
              </span>
            </time>
          </div>
        </header>
        {storageError && (
          <p className="error" role="alert">
            {storageError}
          </p>
        )}
        {page}
        <footer className="workspace-footer">
          <span>
            © {new Date().getFullYear()} {state.settings.company}
          </span>
        </footer>
      </main>
      {search && (
        <Modal title="Buscar en el sistema" onClose={() => setSearch(false)}>
          <input
            className="global-query"
            autoFocus
            aria-label="Buscar módulos o documentos"
            placeholder="Módulo, documento, cliente o producto…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="search-results">
            {[...routes.filter((route) => route.path !== "/mantenimientos"), ...masterGroups.map((group) => ({ name: group.name, path: group.path, group: "Maestros" })), ...masterCatalogs.filter((catalog) => !masterGroups.some((group) => group.path === catalog.path)).map((catalog) => ({ name: catalog.label, path: catalog.path, group: "Maestros" }))]
              .filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
              .map((r) => (
                <button key={r.path} onClick={() => go(r.path)}>
                  <b>{r.name}</b>
                  <small>
                    {r.group} <Icon name="arrow" size={13} />
                  </small>
                </button>
              ))}
            {query &&
              state.documents
                .filter((d) =>
                  `${d.number} ${[...state.customers, ...state.suppliers].find((p) => p.id === d.partyId)?.name}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .slice(0, 8)
                .map((d) => (
                  <button
                    key={d.id}
                    onClick={() =>
                      go(
                        d.kind === "OC"
                          ? "/orden-compra"
                          : d.kind === "NI"
                            ? "/ingreso-kardex"
                            : d.kind === "OV"
                              ? "/orden-venta"
                              : "/facturacion",
                      )
                    }
                  >
                    <b>{d.number}</b>
                    <small>{d.status}</small>
                  </button>
                ))}
            {query &&
              state.suppliers
                .filter((s) => matchesSupplier(s, query))
                .slice(0, 8)
                .map((s) => (
                  <SupplierDetailsTrigger key={s.id} supplierId={s.id}>
                    <b>{s.name}</b>
                    <small>
                      Proveedor · RUC {s.taxId} · {s.id}
                    </small>
                  </SupplierDetailsTrigger>
                ))}
            {query &&
              state.products
                .filter((p) =>
                  `${p.id} ${p.name}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .slice(0, 5)
                .map((p) => (
                  <button key={p.id} onClick={() => go("/stock-productos")}>
                    <b>{p.name}</b>
                    <small>{p.id}</small>
                  </button>
                ))}
          </div>
        </Modal>
      )}
      {profile && <ProfileDrawer onClose={() => setProfile(false)} />}
    </div>
  );
}
class DataBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error)
      return (
        <main>
          <section className="card">
            <h1>No se pudo abrir la aplicación</h1>
            <p className="error" role="alert">
              {this.state.error}
            </p>
            <p>
              Los datos guardados se conservan. Reintenta después de revisar el
              almacenamiento de este navegador.
            </p>
            <button className="btn" onClick={() => location.reload()}>
              Reintentar
            </button>
          </section>
        </main>
      );
    return this.props.children;
  }
}
export default function App() {
  return (
    <DataBoundary>
      <ErpProvider>
        <ToastHost />
        <Shell />
      </ErpProvider>
    </DataBoundary>
  );
}
