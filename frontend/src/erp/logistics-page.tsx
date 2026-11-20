import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Box,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  Navigation,
  PackageCheck,
  Plus,
  RotateCw,
  Route as RouteIcon,
  Truck,
  UserRound,
  Warehouse,
  X,
} from "lucide-react";
import { Modal, Metrics, Records, Tag } from "./ui";
import { SalesDocumentDetailsModal } from "./sales-documents";
import { useErp } from "./store";
import { toast } from "./toast";
import {
  addDriver,
  addTracking,
  addVehicle,
  assignRoute,
  cancelRoute,
  closeRoute,
  confirmDelivery,
  createDispatch,
  createRoute,
  markDeliveryFailed,
  receiveRouteReturn,
  registerRouteReturn,
  saveLiquidation,
  startRoute,
  setDispatchCoordinates,
  setRouteOriginCoordinates,
} from "./logistics";
import { money, today, type Dispatch, type Route } from "./model";
import "./logistics.css";

type Tab =
  | "dispatches"
  | "routes"
  | "tracking"
  | "returns"
  | "liquidations"
  | "resources";
type GeoPoint = { lat: number; lng: number };
type RouteMapStop = {
  id: string;
  number: string;
  address: string;
  geoLabel?: string;
  status: string;
  lat?: number;
  lng?: number;
};
type MapTarget = { id: string; label: string; point?: GeoPoint };
type MapDrag = { pointerId: number; startX: number; startY: number; worldX: number; worldY: number; moved: boolean };
type TrafficLevel = "Fluido" | "Moderado" | "Intenso";
type RouteDemo = { routeId: string; progress: number; traffic: TrafficLevel; etaSeconds: number; remainingMeters: number; updatedAt: number; trafficChangedAt: number };
type RoadRoute = { routeId: string; points: GeoPoint[]; snappedPoints: GeoPoint[]; distanceMeters: number; durationSeconds: number; fetchedAt: number };
type PlaceResult = { label: string; point: GeoPoint; country?: string };

const INITIAL_MAP_CENTER = { lat: -12.0464, lng: -77.0428 };
const TILE_SIZE = 256;
const OSRM_ROUTING_URL = import.meta.env.VITE_OSRM_ROUTING_URL || "https://router.project-osrm.org";

function project(point: GeoPoint, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.sin((point.lat * Math.PI) / 180);
  return {
    x: ((point.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function unproject(x: number, y: number, zoom: number): GeoPoint {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return {
    lat: (180 / Math.PI) * Math.atan(Math.sinh(n)),
    lng: longitude,
  };
}

function RouteMap({
  origin,
  stops,
  originAddress,
  originGeoLabel,
  vehicleDescription,
  roadRoute,
  roadRoutePending,
  roadRouteError,
  editable,
  simulation,
  onSetOrigin,
  onSetStop,
}: {
  origin?: GeoPoint;
  stops: RouteMapStop[];
  originAddress?: string;
  originGeoLabel?: string;
  vehicleDescription?: string;
  roadRoute?: RoadRoute;
  roadRoutePending: boolean;
  roadRouteError: string;
  editable: boolean;
  simulation?: RouteDemo;
  onSetOrigin: (point: GeoPoint, geoLabel?: string) => void;
  onSetStop: (id: string, point: GeoPoint, geoLabel?: string) => void;
}) {
  const node = useRef<HTMLDivElement>(null);
  const drag = useRef<MapDrag | null>(null);
  const suppressClick = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [panProgress, setPanProgress] = useState<number | null>(null);
  const [size, setSize] = useState({ width: 900, height: 315 });
  const sizeRef = useRef(size);
  const [hasMeasured, setHasMeasured] = useState(false);
  const resizeTimer = useRef<number | undefined>(undefined);
  const simulationProgress = useRef(simulation?.progress ?? null);
  simulationProgress.current = simulation?.progress ?? null;
  const [center, setCenter] = useState<GeoPoint>(() => {
    const firstStop = stops.find((stop) => stop.lat != null && stop.lng != null);
    return origin ?? (firstStop ? { lat: firstStop.lat!, lng: firstStop.lng! } : INITIAL_MAP_CENTER);
  });
  const [zoom, setZoom] = useState(12);
  const [targetId, setTargetId] = useState("origin");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeSearchState, setPlaceSearchState] = useState<"idle" | "loading">("idle");
  const targets: MapTarget[] = [
    { id: "origin", label: "Origen", point: origin },
    ...stops.map((stop, index) => ({
      id: stop.id,
      label: `${String(index + 1).padStart(2, "0")} · ${stop.number}`,
      point: stop.lat != null && stop.lng != null ? { lat: stop.lat, lng: stop.lng } : undefined,
    })),
  ];
  const locationSignature = targets
    .map((target) => `${target.id}:${target.point?.lat ?? ""},${target.point?.lng ?? ""}`)
    .join("|");

  useEffect(() => {
    if (!node.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const nextSize = {
        width: Math.max(1, entry.contentRect.width),
        height: Math.max(1, entry.contentRect.height),
      };
      const previousSize = sizeRef.current;
      if (previousSize.width !== nextSize.width || previousSize.height !== nextSize.height) {
        setIsResizing(true);
        setPanProgress(simulationProgress.current);
        window.clearTimeout(resizeTimer.current);
        resizeTimer.current = window.setTimeout(() => {
          setIsResizing(false);
          setPanProgress(null);
        }, 180);
      }
      sizeRef.current = nextSize;
      setSize(nextSize);
      setHasMeasured(true);
    });
    observer.observe(node.current);
    return () => {
      observer.disconnect();
      window.clearTimeout(resizeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!targets.some((target) => target.id === targetId)) setTargetId("origin");
  }, [locationSignature, targetId]);
  const activeAddress = targetId === "origin"
    ? originGeoLabel || originAddress || ""
    : stops.find((stop) => stop.id === targetId)?.geoLabel || stops.find((stop) => stop.id === targetId)?.address || "";
  useEffect(() => {
    setPlaceQuery(activeAddress);
    setPlaceResults([]);
    setPlaceSearchState("idle");
  }, [targetId, activeAddress]);

  useEffect(() => {
    if (!hasMeasured) return;
    const points = targets.flatMap((target) => target.point ? [target.point] : []);
    if (!points.length) return;
    let fitZoom = 3;
    let fitCenter = points[0];
    for (let candidateZoom = 18; candidateZoom >= 3; candidateZoom -= 1) {
      const projected = points.map((point) => project(point, candidateZoom));
      const minX = Math.min(...projected.map((point) => point.x));
      const maxX = Math.max(...projected.map((point) => point.x));
      const minY = Math.min(...projected.map((point) => point.y));
      const maxY = Math.max(...projected.map((point) => point.y));
      if (maxX - minX <= Math.max(100, size.width - 100) && maxY - minY <= Math.max(100, size.height - 80)) {
        fitZoom = candidateZoom;
        fitCenter = unproject((minX + maxX) / 2, (minY + maxY) / 2, candidateZoom);
        break;
      }
    }
    setZoom(fitZoom);
    setCenter(fitCenter);
  }, [locationSignature, hasMeasured]);

  const centerPixel = project(center, zoom);
  const leftPixel = centerPixel.x - size.width / 2;
  const topPixel = centerPixel.y - size.height / 2;
  const firstTileX = Math.floor(leftPixel / TILE_SIZE);
  const firstTileY = Math.floor(topPixel / TILE_SIZE);
  const tilesX = Math.ceil(size.width / TILE_SIZE) + 1;
  const tilesY = Math.ceil(size.height / TILE_SIZE) + 1;
  const visiblePoints = targets.flatMap((target, index) => {
    const point = roadRoute?.snappedPoints[index] ?? target.point;
    return point
      ? [{ ...point, target, index, x: project(point, zoom).x - leftPixel, y: project(point, zoom).y - topPixel }]
      : [];
  });
  const routeGeometry = roadRoute?.points;
  const roadPixels = routeGeometry?.map((point) => {
    const projected = project(point, zoom);
    return `${projected.x - leftPixel},${projected.y - topPixel}`;
  }).join(" ");
  const fallbackPath = visiblePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const mapRoutePoints = targets.map((target) => target.point);
  const vehiclePath = roadRoute?.points.length ? roadRoute.points : mapRoutePoints as GeoPoint[];
  const canShowSimulatedVehicle = Boolean(simulation && vehiclePath.length > 1 && mapRoutePoints.every(Boolean));
  const vehiclePoint = canShowSimulatedVehicle
    ? pointAlongRoute(vehiclePath, (isPanning || isResizing) && panProgress != null ? panProgress : simulation!.progress)
    : undefined;
  const vehiclePixel = vehiclePoint
    ? { x: project(vehiclePoint, zoom).x - leftPixel, y: project(vehiclePoint, zoom).y - topPixel }
    : undefined;

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (!editable) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = unproject(
      centerPixel.x + event.clientX - bounds.left - bounds.width / 2,
      centerPixel.y + event.clientY - bounds.top - bounds.height / 2,
      zoom,
    );
    if (targetId === "origin") onSetOrigin(point);
    else onSetStop(targetId, point);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("a")) return;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      worldX: centerPixel.x,
      worldY: centerPixel.y,
      moved: false,
    };
    setIsPanning(false);
    setPanProgress(simulation?.progress ?? null);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const activeDrag = drag.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    const dx = event.clientX - activeDrag.startX;
    const dy = event.clientY - activeDrag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) activeDrag.moved = true;
    if (activeDrag.moved) {
      setIsPanning(true);
      setCenter(unproject(activeDrag.worldX - dx, activeDrag.worldY - dy, zoom));
    }
  };
  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    suppressClick.current = drag.current.moved;
    drag.current = null;
    setIsPanning(false);
    setPanProgress(null);
  };

  const selectedTarget = targets.find((target) => target.id === targetId);
  const searchAddress = async () => {
    const query = placeQuery.trim();
    if (!query || query.length < 4) {
      setPlaceSearchState("idle");
      setPlaceResults([]);
      toast.warning("Escribe una dirección de al menos 4 caracteres.");
      return;
    }
    setPlaceSearchState("loading");
    setPlaceResults([]);
    try {
      const parameters = new URLSearchParams({
        q: `${query}, Perú`,
        limit: "5",
        lang: "es",
        lat: String(center.lat),
        lon: String(center.lng),
        bbox: "-81.5,-18.5,-68.0,0.2",
      });
      const response = await fetch(`https://photon.komoot.io/api/?${parameters}`);
      if (!response.ok) throw new Error("No se pudo consultar el buscador de lugares.");
      const data = await response.json() as { features?: Array<{ geometry?: { coordinates?: number[] }; properties?: Record<string, string | undefined> }> };
      const results = (data.features ?? []).flatMap((feature) => {
        const coordinates = feature.geometry?.coordinates;
        const properties = feature.properties ?? {};
        if (!coordinates || coordinates.length < 2) return [];
        const [longitude, latitude] = coordinates;
        const country = (properties.country ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        if ((country && country !== "peru") || longitude < -81.5 || longitude > -68 || latitude < -18.5 || latitude > 0.2) return [];
        const placeParts = [
          [properties.housenumber, properties.street].filter(Boolean).join(" "),
          properties.name,
          properties.district,
          properties.city,
          properties.state,
        ].filter((part, index, all) => Boolean(part) && all.indexOf(part) === index);
        return [{ label: placeParts.join(", ") || "Ubicación en Perú", point: { lat: latitude, lng: longitude }, country: properties.country }];
      });
      setPlaceResults(results);
      setPlaceSearchState("idle");
      if (!results.length) toast.info("No encontramos esa ubicación en Perú. Prueba con calle, distrito y ciudad.");
    } catch (reason) {
      setPlaceSearchState("idle");
      toast.error(reason instanceof Error ? reason.message : "No se pudo consultar el buscador de lugares.");
    }
  };

  const choosePlace = (place: PlaceResult) => {
    if (targetId === "origin") onSetOrigin(place.point, place.label);
    else onSetStop(targetId, place.point, place.label);
    setCenter(place.point);
    setPlaceQuery(place.label);
    setPlaceResults([]);
    setPlaceSearchState("idle");
  };

  return (
    <div className="route-map-shell">
      <div className="route-map-toolbar">
        {editable ? <div className="map-target-picker" aria-label="Ubicación a colocar">
          {targets.map((target) => (
            <button
              type="button"
              className={targetId === target.id ? "active" : ""}
              key={target.id}
              disabled={!editable}
              onClick={() => setTargetId(target.id)}
              title={target.point ? `${target.label} ubicado` : `${target.label} sin ubicación`}
            >
              {target.label}{target.point ? " ✓" : " · pendiente"}
            </button>
          ))}
        </div> : <span className="map-simulation-badge"><i /> SIMULACIÓN · Tráfico {simulation?.traffic ?? "—"}</span>}
        <div className="map-zoom-controls">
          <button type="button" aria-label="Acercar mapa" onClick={() => setZoom((value) => Math.min(18, value + 1))}>+</button>
          <button type="button" aria-label="Alejar mapa" onClick={() => setZoom((value) => Math.max(3, value - 1))}>−</button>
        </div>
      </div>
      {editable && <div className="map-place-search">
        <div className="map-place-search-row">
          <MapPin size={15} />
          <input
            aria-label="Buscar calle, dirección o punto de referencia en Perú"
            placeholder={`Buscar ${selectedTarget?.label.toLowerCase() ?? "dirección"} en Perú`}
            value={placeQuery}
            onChange={(event) => { setPlaceQuery(event.target.value); setPlaceResults([]); setPlaceSearchState("idle"); }}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchAddress(); } }}
          />
          <button type="button" className="btn" onClick={() => void searchAddress()} disabled={placeSearchState === "loading"}>
            {placeSearchState === "loading" ? "Buscando…" : "Buscar dirección"}
          </button>
        </div>
        {placeResults.length > 0 && <div className="map-place-results" role="listbox" aria-label="Direcciones encontradas">
          {placeResults.map((place, index) => <button type="button" role="option" key={`${place.label}-${index}`} onClick={() => choosePlace(place)}>
            <MapPin size={14} /><span>{place.label}</span><small>Perú</small>
          </button>)}
        </div>}
      </div>}
      <div
        ref={node}
        className={`route-map osm-map ${editable ? "is-editable" : ""} ${isPanning ? "is-panning" : ""} ${isResizing ? "is-resizing" : ""}`}
        aria-label="Mapa OpenStreetMap de la hoja de ruta"
        onClick={handleMapClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {Array.from({ length: tilesX * tilesY }, (_, index) => {
          const tileX = firstTileX + (index % tilesX);
          const tileY = firstTileY + Math.floor(index / tilesX);
          const count = 2 ** zoom;
          if (tileY < 0 || tileY >= count) return null;
          const wrappedX = ((tileX % count) + count) % count;
          return (
            <img
              className="osm-tile"
              key={`${zoom}/${wrappedX}/${tileY}`}
              src={`https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`}
              alt=""
              draggable={false}
              style={{ left: tileX * TILE_SIZE - leftPixel, top: tileY * TILE_SIZE - topPixel }}
              onError={(event) => { event.currentTarget.style.opacity = "0.25"; }}
            />
          );
        })}
        <svg className="osm-route-overlay" width={size.width} height={size.height} aria-hidden="true">
          {roadPixels && <>
            <polyline className="osm-road-casing" points={roadPixels} />
            <polyline className={`osm-road-line ${simulation ? `traffic-${simulation.traffic.toLowerCase()}` : ""}`} points={roadPixels} />
          </>}
          {!roadPixels && visiblePoints.length > 1 && <polyline className="osm-road-fallback" points={fallbackPath} />}
        </svg>
        {visiblePoints.map((point) => (
          <span
            className={`osm-marker ${point.target.id === "origin" ? "origin" : ""}`}
            key={point.target.id}
            style={{ left: point.x, top: point.y }}
            title={`${point.target.label}: ${point.target.id === "origin" ? originGeoLabel || originAddress || "Origen" : stops.find((stop) => stop.id === point.target.id)?.geoLabel || point.target.label} · ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`}
          >
            {point.target.id === "origin" ? "A" : String(point.index).padStart(2, "0")}
          </span>
        ))}
        {vehiclePixel && <span className="osm-vehicle-marker" style={{ left: vehiclePixel.x, top: vehiclePixel.y }} title={`Vehículo ${vehicleDescription ?? "asignado"} · ubicación simulada`}><VehicleIllustration description={vehicleDescription ?? "Automóvil"} /></span>}
        <div className="osm-attribution" onClick={(event) => event.stopPropagation()}>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></div>
      </div>
      <div className="osm-map-hint">
        <MapPin size={14} />
        {editable ? "Elige un destino arriba y haz clic en el mapa para colocar o ajustar su pin." : "Las ubicaciones de esta hoja de ruta están en modo lectura."}
        <span>{roadRoutePending ? "Calculando recorrido por calles…" : roadRoute ? `Ruta por calles · ${formatDistance(roadRoute.distanceMeters)} · ${Math.max(1, Math.round(roadRoute.durationSeconds / 60))} min estimados por red vial.` : roadRouteError ? `No se obtuvo la ruta vial: ${roadRouteError} Se muestra la conexión directa aproximada.` : "Elige una dirección peruana o coloca los pines manualmente para calcular la ruta por calles."}{simulation ? ` Simulación · ${simulation.remainingMeters <= 80 ? "en zona de llegada, pendiente confirmar recepción" : `${formatDistance(simulation.remainingMeters)} hasta la próxima parada`} · ETA ${formatEta(simulation.etaSeconds)} · actualizado ${new Date(simulation.updatedAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}.` : ""} Direcciones de OpenStreetMap/Photon.</span>
      </div>
    </div>
  );
}

function distanceBetween(a: GeoPoint, b: GeoPoint) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function pointAlongRoute(points: GeoPoint[], progress: number): GeoPoint {
  const segments = points.slice(1).map((point, index) => distanceBetween(points[index], point));
  const total = segments.reduce((sum, value) => sum + value, 0);
  let remaining = total * Math.max(0, Math.min(1, progress));
  for (let index = 0; index < segments.length; index += 1) {
    const length = segments[index];
    if (remaining <= length || index === segments.length - 1) {
      const ratio = length ? Math.min(1, remaining / length) : 0;
      return {
        lat: points[index].lat + (points[index + 1].lat - points[index].lat) * ratio,
        lng: points[index].lng + (points[index + 1].lng - points[index].lng) * ratio,
      };
    }
    remaining -= length;
  }
  return points.at(-1)!;
}

function VehicleIllustration({ description }: { description: string }) {
  const commercial = /cam[ií]on|furg|van|carga|pickup/i.test(description);
  const motorcycle = /moto|motocicleta/i.test(description);
  return (
    <svg className={`vehicle-illustration ${commercial ? "commercial" : ""} ${motorcycle ? "motorcycle" : ""}`} viewBox="0 0 128 66" role="img" aria-label={motorcycle ? "Motocicleta" : commercial ? "Vehículo de carga" : "Automóvil"}>
      <ellipse cx="64" cy="57" rx="50" ry="5" fill="currentColor" opacity=".12" />
      {motorcycle ? <><path d="M35 43h17l10-13h12l11 12h11l4 6h-17L72 36H65L54 51H31Z" /><circle cx="38" cy="49" r="10" className="vehicle-wheel" /><circle cx="38" cy="49" r="4" className="vehicle-wheel-center" /><circle cx="94" cy="49" r="10" className="vehicle-wheel" /><circle cx="94" cy="49" r="4" className="vehicle-wheel-center" /></> : <>
        {commercial ? <><path d="M18 20h57v29H15V27c0-4 1-7 3-7Z" /><path d="M75 29h20l16 13v7H75Z" /><path className="vehicle-window" d="M81 33h11l9 9H81Z" /></> : <><path d="m17 43 5-12c2-4 5-7 10-8l17-3 12-11c2-2 5-3 8-3h17c5 0 9 2 13 6l12 14 7 4c3 2 5 5 5 9v9H14v-2c0-1 1-2 3-3Z" /><path className="vehicle-window" d="m54 22 11-11c1-1 3-2 5-2h15c4 0 7 1 10 4l8 9Z" /></>}
        <circle cx="36" cy="49" r="10" className="vehicle-wheel" /><circle cx="36" cy="49" r="4" className="vehicle-wheel-center" />
        <circle cx="94" cy="49" r="10" className="vehicle-wheel" /><circle cx="94" cy="49" r="4" className="vehicle-wheel-center" />
      </>}
    </svg>
  );
}

const navigation: Array<[Tab, string, typeof Truck, string]> = [
  ["dispatches", "Despachos", PackageCheck, "Preparación"],
  ["routes", "Hojas de ruta", RouteIcon, "Preparación"],
  ["tracking", "Seguimiento", Navigation, "En ruta"],
  ["returns", "Devoluciones", RotateCw, "Cierre"],
  ["liquidations", "Liquidaciones", CalendarClock, "Cierre"],
  ["resources", "Flota y conductores", Truck, "Recursos"],
];

function statusLabel(status: string) {
  return status === "Planificado" ? "Por asignar" : status;
}

function formatDistance(meters?: number) {
  if (meters == null || !Number.isFinite(meters)) return "—";
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

function formatEta(seconds?: number) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return remainingSeconds ? `${minutes} min ${remainingSeconds} s` : `${minutes} min`;
}

function progressAtPoint(points: GeoPoint[], target: GeoPoint) {
  if (points.length < 2) return 1;
  const segments = points.slice(1).map((point, index) => distanceBetween(points[index], point));
  const total = segments.reduce((sum, value) => sum + value, 0);
  if (!total) return 1;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestProgress = 0;
  let traversed = 0;
  points.forEach((point, index) => {
    const distance = distanceBetween(point, target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestProgress = traversed / total;
    }
    traversed += segments[index] ?? 0;
  });
  return bestProgress;
}

export function LogisticsPage() {
  const { state, transact } = useErp();
  const stateRef = useRef(state);
  const transactRef = useRef(transact);
  stateRef.current = state;
  transactRef.current = transact;
  const [tab, setTab] = useState<Tab>("dispatches");
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [resource, setResource] = useState<"vehicle" | "driver" | null>(null);
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [liquidationOpen, setLiquidationOpen] = useState(false);
  const [orderDetailId, setOrderDetailId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryWindow, setDeliveryWindow] = useState("");
  const [guideNumber, setGuideNumber] = useState("");
  const [priority, setPriority] = useState<Dispatch["priority"]>("Normal");
  const [routeDate, setRouteDate] = useState(today());
  const [routeOrigin, setRouteOrigin] = useState("");
  const [routeDispatches, setRouteDispatches] = useState<string[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [routeDemo, setRouteDemo] = useState<RouteDemo>();
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [finalMileage, setFinalMileage] = useState(0);
  const [plate, setPlate] = useState("");
  const [vehicleDescription, setVehicleDescription] = useState("");
  const [vehicleCapacity, setVehicleCapacity] = useState(1);
  const [driverName, setDriverName] = useState("");
  const [license, setLicense] = useState("");
  const [licenseExpires, setLicenseExpires] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [receiver, setReceiver] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [deliveryObservation, setDeliveryObservation] = useState("");
  const [trackingStatus, setTrackingStatus] = useState("En tránsito");
  const [trackingNote, setTrackingNote] = useState("");
  const [failedReason, setFailedReason] = useState("");
  const [returnDispatchId, setReturnDispatchId] = useState("");
  const [returnProductId, setReturnProductId] = useState("");
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnReason, setReturnReason] = useState("");
  const [returnCondition, setReturnCondition] = useState<
    "Apto para venta" | "Dañado" | "Pendiente de revisión"
  >("Apto para venta");
  const [liquidationRouteId, setLiquidationRouteId] = useState("");
  const [liquidation, setLiquidation] = useState({
    fuel: 0,
    tolls: 0,
    otherExpenses: 0,
    collections: 0,
    returnsAmount: 0,
    responsible: "",
  });

  const dispatches = state.dispatches ?? [];
  const routes = state.routes ?? [];
  const vehicles = state.vehicles ?? [];
  const drivers = state.drivers ?? [];
  const route = routes.find((item) => item.id === selectedRouteId) ?? routes[0];
  const routeStops = useMemo<RouteMapStop[]>(
    () =>
      route?.dispatchIds.flatMap((id) => {
        const dispatch = dispatches.find((item) => item.id === id);
        return dispatch
          ? [
              {
                id,
                number: dispatch.number,
                address: dispatch.deliveryAddress,
                geoLabel: dispatch.deliveryGeoLabel,
                status: dispatch.status,
                lat: dispatch.deliveryLat,
                lng: dispatch.deliveryLng,
              },
            ]
          : [];
      }) ?? [],
    [route?.id, route?.dispatchIds.join("|"), dispatches],
  );
  const routeDistance = useMemo(() => {
    if (!route || route.originLat == null || route.originLng == null) return undefined;
    const points = [
      { lat: route.originLat, lng: route.originLng },
      ...routeStops.map((stop) =>
        stop.lat != null && stop.lng != null
          ? { lat: stop.lat, lng: stop.lng }
          : undefined,
      ),
    ];
    if (points.some((point) => !point)) return undefined;
    return points.slice(1).reduce(
      (sum, point, index) => sum + distanceBetween(points[index]!, point!),
      0,
    );
  }, [route?.id, route?.originLat, route?.originLng, routeStops]);
  const routeHasLocations = Boolean(
    route &&
      route.originLat != null &&
      route.originLng != null &&
      routeStops.length === route.dispatchIds.length &&
      routeStops.every((stop) => stop.lat != null && stop.lng != null),
  );
  const [roadRoute, setRoadRoute] = useState<RoadRoute>();
  const [roadRoutePending, setRoadRoutePending] = useState(false);
  const [roadRouteError, setRoadRouteError] = useState("");
  const lastRoadRequestAt = useRef(0);
  const plannedDispatches = dispatches.filter(
    (item) => item.status === "Planificado",
  );
  const activeRouteStatuses = ["Borrador", "Programada", "En ruta"];
  const activeRoutes = routes.filter((item) =>
    activeRouteStatuses.includes(item.status),
  );
  const inRoute = dispatches.filter((item) => item.status === "En ruta");
  const delivered = dispatches.filter((item) => item.status === "Entregado");
  const alreadyDispatchedOrderIds = new Set(
    dispatches
      .filter((item) => item.status !== "Cancelado")
      .map((item) => item.salesOrderId),
  );
  const availableOrders = state.documents.filter(
    (document) =>
      document.kind === "OV" &&
      ["Pendiente", "Facturada"].includes(document.status) &&
      !alreadyDispatchedOrderIds.has(document.id),
  );
  const activeDispatch = dispatches.find(
    (item) => item.id === returnDispatchId,
  );
  const activeReturnOrder =
    activeDispatch &&
    state.documents.find((item) => item.id === activeDispatch.salesOrderId);
  const returnProducts =
    activeDispatch?.lines ?? activeReturnOrder?.lines ?? [];
  const selectedWarehouse = state.warehouses.find(
    (item) =>
      item.id ===
      (route?.dispatchIds
        .map((id) => dispatches.find((d) => d.id === id)?.warehouseId)
        .find(Boolean) ?? ""),
  );
  const routeVehicle = vehicles.find((item) => item.id === route?.vehicleId);
  const routeDriver = drivers.find((item) => item.id === route?.driverId);
  const activeRoadRoute = roadRoute?.routeId === route?.id ? roadRoute : undefined;
  const routeCoordinateSignature = route
    ? `${route.id}|${route.originLng ?? ""},${route.originLat ?? ""}|${routeStops.map((stop) => `${stop.lng ?? ""},${stop.lat ?? ""}`).join(";")}`
    : "";

  useEffect(() => {
    if (!route || !routeHasLocations) {
      setRoadRoute(undefined);
      setRoadRoutePending(false);
      setRoadRouteError("");
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setRoadRoutePending(true);
    setRoadRouteError("");
    const waitForProvider = Math.max(500, 1_100 - (Date.now() - lastRoadRequestAt.current));
    const timer = window.setTimeout(async () => {
      try {
        const coordinates = [
          [route.originLng!, route.originLat!],
          ...routeStops.map((stop) => [stop.lng!, stop.lat!]),
        ].map(([longitude, latitude]) => `${longitude},${latitude}`).join(";");
        lastRoadRequestAt.current = Date.now();
        const response = await fetch(
          `${OSRM_ROUTING_URL.replace(/\/$/, "")}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false&alternatives=true`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("El servicio de rutas no respondió.");
        const data = await response.json() as {
          code?: string;
          routes?: Array<{ geometry?: { coordinates?: number[][] }; distance?: number; duration?: number }>;
          waypoints?: Array<{ location?: number[] }>;
        };
        const selected = data.code === "Ok" ? data.routes?.[0] : undefined;
        const points = selected?.geometry?.coordinates?.flatMap((coordinate) =>
          coordinate.length >= 2 ? [{ lat: coordinate[1], lng: coordinate[0] }] : [],
        );
        const snappedPoints = (data.waypoints ?? []).flatMap((waypoint) => {
          const [longitude, latitude] = waypoint.location ?? [];
          return Number.isFinite(latitude) && Number.isFinite(longitude)
            ? [{ lat: latitude, lng: longitude }]
            : [];
        });
        if (!selected || !points || points.length < 2) throw new Error("No hay una ruta vial para estas ubicaciones.");
        if (!cancelled) {
          setRoadRoute({
            routeId: route.id,
            points,
            snappedPoints,
            distanceMeters: selected.distance ?? 0,
            durationSeconds: selected.duration ?? 0,
            fetchedAt: Date.now(),
          });
          setRoadRoutePending(false);
        }
      } catch (reason) {
        if (cancelled || (reason instanceof Error && reason.name === "AbortError")) return;
        setRoadRoute(undefined);
        setRoadRoutePending(false);
        setRoadRouteError(reason instanceof Error ? reason.message : "No se pudo calcular la ruta vial.");
      }
    }, waitForProvider);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [routeCoordinateSignature, routeHasLocations]);

  useEffect(() => {
    if (!route || route.status !== "En ruta") {
      setRouteDemo(undefined);
      return;
    }
    const durationSeconds = roadRoute?.routeId === route.id ? roadRoute.durationSeconds : 12 * 60;
    const simulationDuration = Math.max(120_000, Math.min(600_000, durationSeconds * 1000));
    const simulationTravelSeconds = simulationDuration / 1000;
    const currentProgress = () => Math.max(0, Math.min(1,
      (Date.now() - (Date.parse(route.startedAt ?? "") || Date.now())) / simulationDuration,
    ));
    const routePoints = roadRoute?.routeId === route.id && roadRoute.points.length > 1
      ? roadRoute.points
      : [
          { lat: route.originLat!, lng: route.originLng! },
          ...routeStops.flatMap((stop) => stop.lat != null && stop.lng != null ? [{ lat: stop.lat, lng: stop.lng }] : []),
        ];
    const routeLengthMeters = roadRoute?.routeId === route.id
      ? roadRoute.distanceMeters
      : routePoints.slice(1).reduce((sum, point, index) => sum + distanceBetween(routePoints[index], point), 0);
    const stopTargets = routeStops.flatMap((stop, index) => {
      const fallback = stop.lat != null && stop.lng != null ? { lat: stop.lat, lng: stop.lng } : undefined;
      const point = roadRoute?.routeId === route.id ? roadRoute.snappedPoints[index + 1] ?? fallback : fallback;
      return point ? [{ dispatchId: stop.id, point, progress: progressAtPoint(routePoints, point) }] : [];
    });
    const alreadyArrived = (dispatchId: string) => stateRef.current.deliveryTracking?.some(
      (event) => event.dispatchId === dispatchId && ["En destino", "Esperando recepción"].includes(event.status),
    ) ?? false;
    const updateArrivalEvents = (progress: number) => {
      const distanceToRouteMeters = (stopProgress: number) => Math.max(0, routeLengthMeters * (stopProgress - progress));
      stopTargets.forEach((stop) => {
        const dispatch = stateRef.current.dispatches?.find((item) => item.id === stop.dispatchId);
        if (!dispatch || dispatch.status !== "En ruta" || alreadyArrived(stop.dispatchId)) return;
        if (distanceToRouteMeters(stop.progress) > 80) return;
        try {
          transactRef.current((draft) => addTracking(
            draft,
            stop.dispatchId,
            "En destino",
            "Llegada detectada por la simulación al entrar en el radio de 80 m. Confirma la recepción para cerrar la entrega.",
            stop.point.lat,
            stop.point.lng,
          ));
        } catch {
          // La actualización visual continúa aunque el registro del evento requiera revisión manual.
        }
      });
    };
    const nextStopMeters = (progress: number) => {
      const pendingStop = stopTargets.find((stop) => {
        const dispatch = stateRef.current.dispatches?.find((item) => item.id === stop.dispatchId);
        return dispatch?.status === "En ruta" && !alreadyArrived(stop.dispatchId);
      });
      return pendingStop ? Math.max(0, routeLengthMeters * (pendingStop.progress - progress)) : 0;
    };
    const newDemo = (routeId: string, progress = currentProgress()): RouteDemo => {
      const pendingStop = stopTargets.find((stop) => !alreadyArrived(stop.dispatchId));
      return {
        routeId,
        progress,
        traffic: (["Fluido", "Moderado", "Intenso"] as const)[Math.floor(Math.random() * 3)],
        etaSeconds: pendingStop ? Math.ceil(simulationTravelSeconds * Math.max(0, pendingStop.progress - progress)) : 0,
        remainingMeters: nextStopMeters(progress),
        updatedAt: Date.now(),
        trafficChangedAt: Date.now(),
      };
    };
    const initialProgress = currentProgress();
    updateArrivalEvents(initialProgress);
    setRouteDemo(newDemo(route.id, initialProgress));
    const timer = window.setInterval(() => {
      setRouteDemo((current) => {
        const previous = current?.routeId === route.id ? current : newDemo(route.id);
        const now = Date.now();
        const trafficChanged = now - previous.trafficChangedAt >= 15_000;
        const traffic = trafficChanged
          ? (["Fluido", "Moderado", "Intenso"] as const)[Math.floor(Math.random() * 3)]
          : previous.traffic;
        const progress = currentProgress();
        updateArrivalEvents(progress);
        const pendingStop = stopTargets.find((stop) => {
          const dispatch = stateRef.current.dispatches?.find((item) => item.id === stop.dispatchId);
          return dispatch?.status === "En ruta" && !alreadyArrived(stop.dispatchId);
        });
        const secondsToNextStop = pendingStop
          ? Math.max(0, Math.ceil(simulationTravelSeconds * Math.max(0, pendingStop.progress - progress)))
          : 0;
        const trafficFactor = traffic === "Intenso" ? 1.35 : traffic === "Moderado" ? 1.15 : 1;
        return {
          ...previous,
          progress,
          traffic,
          etaSeconds: Math.ceil(secondsToNextStop * trafficFactor),
          remainingMeters: Math.ceil(nextStopMeters(progress)),
          updatedAt: now,
          trafficChangedAt: trafficChanged ? now : previous.trafficChangedAt,
        };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [route?.id, route?.status, route?.startedAt, route?.originLat, route?.originLng, route?.dispatchIds.join("|"), routeStops, roadRoute?.routeId, roadRoute?.durationSeconds, roadRoute?.fetchedAt]);
  const routeProgress = route
    ? route.dispatchIds.filter(
        (id) =>
          dispatches.find((item) => item.id === id)?.status === "Entregado",
      ).length
    : 0;
  const routeLastTracking = (state.deliveryTracking ?? [])
    .filter((item) => route?.dispatchIds.includes(item.dispatchId))
    .sort((a, b) => b.dateTime.localeCompare(a.dateTime))[0];

  useEffect(() => {
    if (!routeLastTracking || routeLastTracking.status !== "En destino") return;
    const notificationKey = `enterprisecloud-arrival-toast:${routeLastTracking.id}`;
    if (sessionStorage.getItem(notificationKey)) return;
    sessionStorage.setItem(notificationKey, "shown");
    const dispatch = dispatches.find((item) => item.id === routeLastTracking.dispatchId);
    const orderNumber = dispatch
      ? state.documents.find((document) => document.id === dispatch.salesOrderId)?.number ?? "el pedido"
      : "el pedido";
    toast.info(`${orderNumber} llegó a la zona de destino (radio de 80 m). Confirma la recepción para completar la entrega.`, { duration: 8000 });
  }, [route?.id, routeLastTracking?.id, routeLastTracking?.status]);

  useEffect(() => {
    if (route && route.id !== selectedRouteId) setSelectedRouteId(route.id);
  }, [route?.id, selectedRouteId]);
  useEffect(() => {
    if (route)
      setFinalMileage(routeVehicle?.odometer ?? route.initialMileage ?? 0);
  }, [route?.id, routeVehicle?.odometer, route?.initialMileage]);
  useEffect(() => {
    setSelectedVehicleId("");
    setSelectedDriverId("");
  }, [route?.id]);

  const run = (action: () => void) => {
    try {
      action();
      return true;
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "No se pudo completar la operación.",
        { duration: 15_000, position: "top-center" },
      );
      return false;
    }
  };
  const orderFor = (id: string) =>
    state.documents.find((document) => document.id === id);
  const customerFor = (dispatch: Dispatch) => {
    const order = orderFor(dispatch.salesOrderId);
    return (
      state.customers.find((customer) => customer.id === order?.partyId) ??
      order?.customerSnapshot
    );
  };
  const orderNumberFor = (dispatch: Dispatch) =>
    orderFor(dispatch.salesOrderId)?.number ?? "Pedido no disponible";
  const vehicleBusy = (vehicleId: string, routeId?: string) =>
    routes.some(
      (item) =>
        item.id !== routeId &&
        item.date === route?.date &&
        item.vehicleId === vehicleId &&
        !["Cerrada", "Cancelada"].includes(item.status),
    );
  const driverBusy = (driverId: string, routeId?: string) =>
    routes.some(
      (item) =>
        item.id !== routeId &&
        item.date === route?.date &&
        item.driverId === driverId &&
        !["Cerrada", "Cancelada"].includes(item.status),
    );
  const availableVehicles = vehicles.filter(
    (item) =>
      item.active &&
      (!route || item.capacityUnits >= route.capacityUnits) &&
      !vehicleBusy(item.id, route?.id),
  ).sort((a, b) => a.capacityUnits - b.capacityUnits);
  const availableDrivers = drivers.filter(
    (item) =>
      item.active &&
      (!route || item.licenseExpiresOn >= route.date) &&
      !driverBusy(item.id, route?.id),
  ).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const metrics: [string, string | number][] = [
    [
      "Despachos activos",
      dispatches.filter(
        (item) => !["Entregado", "Cerrado", "Cancelado"].includes(item.status),
      ).length,
    ],
    [
      "Rutas en operación",
      activeRoutes.filter((item) => item.status === "En ruta").length,
    ],
    ["Entregas confirmadas", delivered.length],
    ["Por asignar", plannedDispatches.length],
  ];

  return (
    <section className="logistics-workspace">
      <header className="logistics-header">
        <div>
          <span className="module-eyebrow">Operación de distribución</span>
          <h1>Centro de control logístico</h1>
          <p>Conecta pedidos, recursos y entregas en una sola hoja de ruta.</p>
        </div>
        <div className="logistics-header-actions">
          <span className="logistics-live-label">
            <i /> Operación manual
          </span>
          <button
            className="btn"
            onClick={() => {
              setOrderId("");
              setWarehouseId(
                state.warehouses.find((item) => item.active)?.id ?? "",
              );
              setDeliveryAddress("");
              setGuideNumber("");
              setDispatchOpen(true);
            }}
          >
            <Plus size={16} /> Nuevo despacho
          </button>
        </div>
      </header>

      <Metrics items={metrics} />

      <nav className="access-tabs logistics-tabs" role="tablist" aria-label="Flujo logístico">
        {navigation.map(([key, label, IconComponent, group], index) => {
          const TabIcon = IconComponent as typeof Truck;
          const previousGroup = navigation[index - 1]?.[3];
          return (
            <Fragment key={key}>
              {group !== previousGroup && <span className="logistics-tab-group-label">{group}</span>}
              <button
                className="access-tab"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
              >
                <TabIcon size={15} />
                {label}
              </button>
            </Fragment>
          );
        })}
      </nav>

      <div className="logistics-control-grid">
        <section className="card logistics-map-card">
          <div className="logistics-card-heading">
            <div>
              <span className="logistics-overline">
                <MapPin size={13} /> Seguimiento de transporte
              </span>
              <h2>{route?.number ?? "Hoja de ruta"}</h2>
              <p>
                {route
                  ? `${route.dispatchIds.length} paradas · ${route.date}`
                  : "Selecciona una ruta para ver sus paradas."}
              </p>
            </div>
            {route && <Tag value={route.status} />}
          </div>
          {route ? (
            <RouteMap
              origin={route.originLat != null && route.originLng != null
                ? { lat: route.originLat, lng: route.originLng }
                : undefined}
              stops={routeStops}
              originAddress={route.originAddress}
              originGeoLabel={route.originGeoLabel}
              vehicleDescription={routeVehicle?.description}
              roadRoute={activeRoadRoute}
              roadRoutePending={roadRoutePending}
              roadRouteError={roadRouteError}
              editable={["Borrador", "Programada"].includes(route.status)}
              simulation={routeDemo?.routeId === route.id ? routeDemo : undefined}
              onSetOrigin={(point, geoLabel) => run(() => transact((draft) =>
                setRouteOriginCoordinates(draft, route.id, point.lat, point.lng, geoLabel),
              ))}
              onSetStop={(dispatchId, point, geoLabel) => run(() => transact((draft) =>
                setDispatchCoordinates(draft, route.id, dispatchId, point.lat, point.lng, geoLabel),
              ))}
            />
          ) : (
            <div className="logistics-map-placeholder empty">
              <RouteIcon size={28} />
              <strong>Aún no hay rutas programadas</strong>
              <span>Planifica un despacho y agrúpalo en una hoja de ruta.</span>
            </div>
          )}
          <div className="map-route-summary">
            <div>
              <span>{activeRoadRoute ? "Distancia por calles" : "Distancia directa aprox."}</span>
              <strong>{formatDistance(activeRoadRoute?.distanceMeters ?? routeDistance)}</strong>
            </div>
            <div>
              <span>{route && routeDemo?.routeId === route.id ? "ETA · simulación" : "ETA"}</span>
              <strong>{route && routeDemo?.routeId === route.id ? formatEta(routeDemo.etaSeconds) : "Sin GPS"}</strong>
            </div>
            <div>
              <span>Vehículo asignado</span>
              <strong>{routeVehicle?.plate ?? "Pendiente"}</strong>
            </div>
          </div>
        </section>

        <aside className="card logistics-route-feed">
          <div className="logistics-card-heading compact">
            <div>
              <span className="logistics-overline"><Activity size={13} /> Operación seleccionada</span>
              <h2>{route?.number ?? "Rutas activas"}</h2>
            </div>
            {route && <Tag value={route.status} />}
          </div>
          {route ? <>
            <div className="route-sidebar-vehicle">
              <span className="route-sidebar-vehicle-art"><VehicleIllustration description={routeVehicle?.description ?? "Vehículo"} /></span>
              <div>
                <strong>{routeVehicle?.plate ?? "Vehículo pendiente"}</strong>
                <span>{routeVehicle?.description ?? "Asigna una unidad a esta ruta"}</span>
                <small><UserRound size={12} /> {routeDriver?.name ?? "Sin conductor asignado"}</small>
              </div>
            </div>
            <div className="route-sidebar-stats">
              <div><span>ETA a parada</span><strong>{routeDemo?.routeId === route.id ? formatEta(routeDemo.etaSeconds) : "—"}</strong></div>
              <div><span>A próxima parada</span><strong>{routeDemo?.routeId === route.id ? formatDistance(routeDemo.remainingMeters) : formatDistance(activeRoadRoute?.distanceMeters ?? routeDistance)}</strong></div>
              <div><span>Entregas</span><strong>{routeProgress}/{route.dispatchIds.length}</strong></div>
            </div>
            <div className="route-stop-sequence">
              <span className="logistics-overline">Secuencia de paradas</span>
              <div className="route-stop-origin">
                <span className="route-stop-dot origin-dot" />
                <div><small>Salida · {selectedWarehouse?.name ?? "Almacén"}</small><strong>{route.originGeoLabel || route.originAddress || "Origen por ubicar"}</strong></div>
              </div>
              {routeStops.map((stop, index) => {
                const dispatch = dispatches.find((item) => item.id === stop.id);
                const order = dispatch ? orderFor(dispatch.salesOrderId) : undefined;
                const customer = dispatch ? customerFor(dispatch) : undefined;
                const lastStopEvent = (state.deliveryTracking ?? []).find((event) => event.dispatchId === stop.id);
                const stopStatus = dispatch?.status === "En ruta" && ["En destino", "Esperando recepción"].includes(lastStopEvent?.status ?? "")
                  ? lastStopEvent!.status
                  : stop.status;
                return <div className="route-stop-entry" key={stop.id}>
                  <span className="route-stop-dot">{String(index + 1).padStart(2, "0")}</span>
                  <div><small>{order?.number ?? stop.number} · {statusLabel(stopStatus)}</small><strong>{customer?.name ?? "Cliente"}</strong><span>{stop.geoLabel || stop.address}</span></div>
                </div>;
              })}
              {!routeStops.length && <p className="route-stop-empty">Agrega despachos para ver la secuencia.</p>}
            </div>
            <button className="btn route-sidebar-action" onClick={() => setTab("routes")}>
              Ver asignación y hoja de ruta <ChevronRight size={15} />
            </button>
            <div className="route-sidebar-last-event">
              <span className="route-event-live-dot" />
              <div><small>Último movimiento</small><strong>{routeLastTracking?.status ?? "Salida de ruta"}</strong></div>
              <time>{routeLastTracking ? new Date(routeLastTracking.dateTime).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : route.startedAt ? new Date(route.startedAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "—"}</time>
            </div>
            {activeRoutes.length > 1 && <div className="route-sidebar-more">
              <span>Otras rutas activas</span>
              {activeRoutes.filter((item) => item.id !== route.id).slice(0, 3).map((item) => <button type="button" key={item.id} onClick={() => setSelectedRouteId(item.id)}>{item.number}<Tag value={item.status} /></button>)}
            </div>}
          </> : <div className="route-feed-list">
            {activeRoutes.map((item) => <button key={item.id} className="route-feed-item" onClick={() => setSelectedRouteId(item.id)}><span className="route-feed-icon"><Truck size={16} /></span><span className="route-feed-info"><span><strong>{item.number}</strong><Tag value={item.status} /></span><small>{item.dispatchIds.length} paradas · {item.date}</small></span><ChevronRight size={15} /></button>)}
            {!activeRoutes.length && <div className="logistics-empty-mini"><RouteIcon size={20} /><strong>No hay rutas activas</strong><span>{plannedDispatches.length} despachos esperan planificación.</span><button className="text-button" onClick={() => setTab("dispatches")}>Ver despachos <ChevronRight size={14} /></button></div>}
          </div>}
          <div className="route-feed-footer">
            <span><Clock3 size={14} /> {plannedDispatches.length} despachos esperan ruta</span>
            <button className="text-button" onClick={() => setTab("routes")}>Ver planificación <ChevronRight size={14} /></button>
          </div>
        </aside>
      </div>

      {tab === "dispatches" && (
        <section className="card logistics-table-card">
          <div className="logistics-card-heading">
            <div>
              <span className="logistics-overline">
                <Box size={13} /> Orden de venta conectada
              </span>
              <h2>Despachos y pedidos</h2>
              <p>
                Cada despacho conserva la referencia y el destino del pedido
                original.
              </p>
            </div>
            <button
              className="secondary-btn"
              onClick={() => setRouteOpen(true)}
              disabled={!plannedDispatches.length}
            >
              <Plus size={15} /> Crear hoja de ruta
            </button>
          </div>
          {!!availableOrders.length && (
            <div className="dispatch-order-queue">
              <div className="dispatch-order-queue-heading">
                <div>
                  <strong>Órdenes pendientes de despacho</strong>
                  <span>
                    Los pedidos aparecen aquí al registrarse; planifica el despacho
                    cuando estén listos para preparar.
                  </span>
                </div>
                <Tag value={`${availableOrders.length} pedidos`} />
              </div>
              <div className="dispatch-order-queue-list">
                {availableOrders.map((document) => {
                  const customer =
                    state.customers.find(
                      (item) => item.id === document.partyId,
                    ) ?? document.customerSnapshot;
                  return (
                    <div className="dispatch-order-queue-row" key={document.id}>
                      <div>
                        <strong>
                          {document.number} · {customer?.name ?? "Cliente"}
                        </strong>
                        <span>
                          <MapPin size={13} />
                          {document.deliveryAddress ||
                            customer?.address ||
                            "Dirección pendiente"}
                        </span>
                      </div>
                      <div className="dispatch-order-queue-actions">
                        <Tag value={document.status} />
                        <button
                          className="secondary-btn"
                          onClick={() => {
                            setOrderId(document.id);
                            setWarehouseId(
                              document.warehouseId ??
                                state.warehouses.find((item) => item.active)
                                  ?.id ??
                                "",
                            );
                            setDeliveryAddress(
                              document.deliveryAddress || customer?.address || "",
                            );
                            setDeliveryWindow("");
                            setGuideNumber("");
                            setPriority("Normal");
                            setDispatchOpen(true);
                          }}
                        >
                          Planificar despacho
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <Records
            headers={[
              "Despacho",
              "Orden / cliente",
              "Destino",
              "Prioridad",
              "Estado",
            ]}
            rows={dispatches.map((dispatch) => {
              const customer = customerFor(dispatch);
              return {
                id: dispatch.id,
                search: `${dispatch.number} ${orderNumberFor(dispatch)} ${customer?.name ?? ""} ${dispatch.deliveryAddress} ${dispatch.status}`,
                cells: [
                  <strong>{dispatch.number}</strong>,
                  <span>
                    <button
                      className="text-button order-reference-button"
                      onClick={() => setOrderDetailId(dispatch.salesOrderId)}
                    >
                      {orderNumberFor(dispatch)} <ArrowUpRight size={12} />
                    </button>
                    <small className="cell-detail">
                      {customer?.name ?? "Cliente no disponible"}
                    </small>
                  </span>,
                  <span className="logistics-destination">
                    <MapPin size={13} />
                    {dispatch.deliveryAddress || "Sin dirección"}
                  </span>,
                  <Tag value={dispatch.priority} />,
                  <Tag value={statusLabel(dispatch.status)} />,
                ],
              };
            })}
            emptyTitle="Aún no hay despachos"
            empty="Crea un despacho a partir de una orden de venta activa."
            emptyIcon={<PackageCheck size={30} />}
            emptyAction={
              <button className="btn" onClick={() => setDispatchOpen(true)}>
                <Plus size={15} /> Planificar despacho
              </button>
            }
            sortable
          />
        </section>
      )}

      {tab === "routes" && (
        <div className="logistics-route-workspace">
          <section className="card logistics-route-list-card">
            <div className="logistics-card-heading">
              <div>
                <span className="logistics-overline">Planificación</span>
                <h2>Hojas de ruta</h2>
              </div>
              <button
                className="btn"
                onClick={() => {
                  setRouteDispatches([]);
                  setRouteOpen(true);
                }}
                disabled={!plannedDispatches.length}
              >
                <Plus size={15} /> Nueva ruta
              </button>
            </div>
            <div className="route-management-list">
              {routes.map((item) => (
                <button
                  key={item.id}
                  className={
                    route?.id === item.id
                      ? "route-management-row selected"
                      : "route-management-row"
                  }
                  onClick={() => setSelectedRouteId(item.id)}
                >
                  <span className="route-management-symbol">
                    <RouteIcon size={16} />
                  </span>
                  <span>
                    <strong>{item.number}</strong>
                    <small>
                      {item.date} · {item.dispatchIds.length} paradas ·{" "}
                      {vehicles.find((vehicle) => vehicle.id === item.vehicleId)
                        ?.plate ?? "sin vehículo"}
                    </small>
                  </span>
                  <Tag value={item.status} />
                </button>
              ))}
              {!routes.length && (
                <div className="logistics-empty-mini">
                  <RouteIcon size={20} />
                  <strong>Aún no hay rutas</strong>
                  <span>Planifica una ruta para agrupar despachos.</span>
                </div>
              )}
            </div>
          </section>
          <section className="card logistics-route-detail-card">
            {route ? (
              <>
                <div className="logistics-card-heading">
                  <div>
                    <span className="logistics-overline">
                      Hoja de ruta seleccionada
                    </span>
                    <h2>{route.number}</h2>
                    <p>
                      {route.originAddress || "Origen sin registrar"} →{" "}
                      {route.dispatchIds.length} destinos
                    </p>
                  </div>
                  <Tag value={route.status} />
                </div>
                <div className="route-detail-summary">
                  <div>
                    <Truck size={16} />
                    <span>
                      <small>Vehículo</small>
                      <strong>{routeVehicle?.plate ?? "Por asignar"}</strong>
                    </span>
                  </div>
                  <div>
                    <UserRound size={16} />
                    <span>
                      <small>Conductor</small>
                      <strong>{routeDriver?.name ?? "Por asignar"}</strong>
                    </span>
                  </div>
                  <div>
                    <Warehouse size={16} />
                    <span>
                      <small>Carga planificada</small>
                      <strong>
                        {route.capacityUnits.toLocaleString("es-PE")} und.
                      </strong>
                    </span>
                  </div>
                </div>
                {route.status === "Borrador" && (
                  <div className="resource-choice-grid">
                    <div>
                      <div className="resource-choice-heading">
                        <span>01</span>
                        <div>
                          <strong>Elige el vehículo</strong>
                          <small>
                            Opciones disponibles para esta ruta y su capacidad.
                          </small>
                        </div>
                      </div>
                      <div className="resource-choice-list">
                        {availableVehicles.map((vehicle, index) => (
                          <button
                            type="button"
                            key={vehicle.id}
                            className={`resource-choice-card vehicle-offer-card ${selectedVehicleId === vehicle.id ? "chosen" : ""}`}
                            onClick={() => setSelectedVehicleId(vehicle.id)}
                          >
                            <span className="vehicle-offer-art"><VehicleIllustration description={vehicle.description} /></span>
                            <span>
                              <strong>{vehicle.description}</strong>
                              <small>{vehicle.plate} · Vehículo disponible</small>
                              <em>{vehicle.capacityUnits - route.capacityUnits} und. libres después de cargar</em>
                            </span>
                            <span className="resource-choice-capacity">
                              {vehicle.capacityUnits.toLocaleString("es-PE")} <small>und.</small>
                            </span>
                            {index === 0 && <span className="best-fit-badge">Mejor ajuste</span>}
                            {selectedVehicleId === vehicle.id && (
                              <CheckCircle2 size={17} />
                            )}
                          </button>
                        ))}
                        {!availableVehicles.length && (
                          <p className="resource-none">
                            No hay vehículos activos, disponibles y con
                            capacidad suficiente.
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="resource-choice-heading">
                        <span>02</span>
                        <div>
                          <strong>Elige al conductor</strong>
                          <small>
                            Se valida la vigencia de licencia y disponibilidad.
                          </small>
                        </div>
                      </div>
                      <div className="resource-choice-list">
                        {availableDrivers.map((driver) => (
                          <button
                            type="button"
                            key={driver.id}
                            className={`resource-choice-card ${selectedDriverId === driver.id ? "chosen" : ""}`}
                            onClick={() => setSelectedDriverId(driver.id)}
                          >
                            <span className="driver-avatar">
                              <UserRound size={16} />
                            </span>
                            <span>
                              <strong>{driver.name}</strong>
                              <small>
                                Licencia hasta {driver.licenseExpiresOn}
                              </small>
                            </span>
                            <span className="resource-choice-capacity">
                              <BadgeCheck size={16} />
                            </span>
                            {selectedDriverId === driver.id && (
                              <CheckCircle2 size={17} />
                            )}
                          </button>
                        ))}
                        {!availableDrivers.length && (
                          <p className="resource-none">
                            No hay conductores activos y disponibles con
                            licencia vigente.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="route-detail-actions">
                  {route.status === "Borrador" && (
                    <button
                      className="secondary-btn"
                      onClick={() =>
                        run(() =>
                          transact((draft) => cancelRoute(draft, route.id)),
                        )
                      }
                    >
                      Cancelar hoja de ruta
                    </button>
                  )}
                  {route.status === "Borrador" && (
                    <button
                      className="btn"
                      disabled={!selectedVehicleId || !selectedDriverId}
                      onClick={() =>
                        run(() =>
                          transact((draft) =>
                            assignRoute(
                              draft,
                              route.id,
                              selectedVehicleId,
                              selectedDriverId,
                              vehicles.find(
                                (item) => item.id === selectedVehicleId,
                              )?.odometer,
                            ),
                          ),
                        )
                      }
                    >
                      <Check size={15} /> Confirmar asignación
                    </button>
                  )}
                  {route.status === "Programada" && (
                    <>
                      {!routeHasLocations && <p className="route-start-hint"><MapPin size={14} /> Antes de salir, coloca en el mapa el origen y todas las paradas.</p>}
                      <button
                        className="btn"
                        disabled={!routeHasLocations}
                        title={!routeHasLocations ? "Ubica el origen y cada parada en el mapa" : "Iniciar seguimiento de ruta"}
                        onClick={() =>
                          run(() =>
                            transact((draft) => startRoute(draft, route.id)),
                          )
                        }
                      >
                        <Navigation size={15} /> Iniciar ruta
                      </button>
                    </>
                  )}
                  {route.status === "En ruta" && (
                    <div className="route-close-form">
                      <label>
                        Kilometraje final
                        <input
                          type="number"
                          min={route.initialMileage ?? 0}
                          step="1"
                          value={finalMileage}
                          onChange={(event) =>
                            setFinalMileage(Number(event.target.value))
                          }
                        />
                      </label>
                      <button
                        className="btn"
                        onClick={() =>
                          run(() =>
                            transact((draft) =>
                              closeRoute(draft, route.id, finalMileage),
                            ),
                          )
                        }
                      >
                        <Check size={15} /> Cerrar ruta
                      </button>
                    </div>
                  )}
                </div>
                <ol className="route-stops-list">
                  {route.dispatchIds.map((id, index) => {
                    const dispatch = dispatches.find((item) => item.id === id);
                    const customer = dispatch && customerFor(dispatch);
                    return (
                      <li key={id}>
                        <b>{String(index + 1).padStart(2, "0")}</b>
                        <span>
                          <strong>
                            {dispatch?.number} ·{" "}
                            {orderNumberFor(dispatch as Dispatch)}
                          </strong>
                          <small>
                            {customer?.name ?? "Cliente"} ·{" "}
                            {dispatch?.deliveryAddress}
                          </small>
                        </span>
                        <Tag value={dispatch?.status ?? "No disponible"} />
                      </li>
                    );
                  })}
                </ol>
              </>
            ) : (
              <div className="logistics-empty-mini">
                <RouteIcon size={22} />
                <strong>Selecciona una hoja de ruta</strong>
                <span>Verás aquí sus paradas, recursos y acciones.</span>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "tracking" && (
        <section className="tracking-operations-grid">
          {inRoute.map((dispatch) => {
            const customer = customerFor(dispatch);
            const order = orderFor(dispatch.salesOrderId);
            const last = (state.deliveryTracking ?? []).find(
              (item) => item.dispatchId === dispatch.id,
            );
            return (
              <article
                key={dispatch.id}
                className="card tracking-operation-card"
              >
                <div className="tracking-operation-head">
                  <span className="tracking-card-icon">
                    <Navigation size={16} />
                  </span>
                  <Tag value={dispatch.priority} />
                </div>
                <div>
                  <span className="logistics-overline">{dispatch.number}</span>
                  <h3>
                    {order?.number} · {customer?.name ?? "Cliente"}
                  </h3>
                  <p>
                    <MapPin size={14} />
                    {dispatch.deliveryAddress}
                  </p>
                </div>
                <div className="tracking-status-strip">
                  <i />
                  <span>
                    <small>Último evento</small>
                    <strong>{last?.status ?? "Salida de ruta"}</strong>
                  </span>
                  <time>
                    {last
                      ? new Date(last.dateTime).toLocaleTimeString("es-PE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Ahora"}
                  </time>
                </div>
                <div className="tracking-actions">
                  <button
                    className="secondary-btn"
                    onClick={() => {
                      setTrackingId(dispatch.id);
                      setTrackingNote("");
                    }}
                  >
                    Registrar avance
                  </button>
                  <button
                    className="secondary-btn"
                    onClick={() => {
                      setFailedId(dispatch.id);
                      setFailedReason("");
                    }}
                  >
                    Incidencia
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      setDeliveryId(dispatch.id);
                      setReceiver("");
                      setEvidenceUrl("");
                      setDeliveryObservation("");
                    }}
                  >
                    <PackageCheck size={14} /> Confirmar entrega
                  </button>
                </div>
                <div className="tracking-reference">
                  Orden original{" "}
                  <strong>{order?.number ?? dispatch.salesOrderId}</strong>
                  <a href="/orden-venta">
                    Ir a pedidos <ArrowUpRight size={13} />
                  </a>
                </div>
              </article>
            );
          })}
          {!inRoute.length && (
            <div className="card logistics-empty-large">
              <Navigation size={25} />
              <h2>No hay despachos en ruta</h2>
              <p>Al iniciar una hoja de ruta, sus entregas aparecerán aquí.</p>
            </div>
          )}
        </section>
      )}

      {tab === "returns" && (
        <section className="card logistics-table-card">
          <div className="logistics-card-heading">
            <div>
              <span className="logistics-overline">
                <RotateCw size={13} /> Retorno a inventario
              </span>
              <h2>Devoluciones en ruta</h2>
              <p>
                Solo se aceptan devoluciones asociadas a entregas confirmadas.
              </p>
            </div>
            <button
              className="secondary-btn"
              onClick={() => {
                setReturnDispatchId("");
                setReturnProductId("");
                setReturnOpen(true);
              }}
              disabled={!delivered.length}
            >
              <Plus size={15} /> Registrar devolución
            </button>
          </div>
          <Records
            headers={[
              "Devolución",
              "Despacho / pedido",
              "Producto",
              "Cantidad",
              "Estado",
              "Acción",
            ]}
            rows={(state.routeReturns ?? []).map((item) => {
              const dispatch = dispatches.find(
                (record) => record.id === item.dispatchId,
              );
              const product = state.products.find(
                (record) => record.id === item.productId,
              );
              return {
                id: item.id,
                search: `${dispatch?.number ?? ""} ${orderNumberFor(dispatch as Dispatch)} ${product?.name ?? ""} ${item.status}`,
                cells: [
                  <strong>{item.id}</strong>,
                  <span>
                    <strong>{dispatch?.number}</strong>
                    <small className="cell-detail">
                      {dispatch ? orderNumberFor(dispatch) : "Pedido"}
                    </small>
                  </span>,
                  product?.name ?? item.productId,
                  item.quantity,
                  <Tag value={item.status} />,
                  item.status === "Pendiente de recepción" ? (
                    <div className="return-actions">
                      <button
                        className="text-button"
                        onClick={() =>
                          run(() =>
                            transact((draft) =>
                              receiveRouteReturn(
                                draft,
                                item.id,
                                dispatch?.warehouseId ?? "",
                                true,
                              ),
                            ),
                          )
                        }
                        disabled={item.condition !== "Apto para venta"}
                      >
                        <Check size={14} /> Recibir apta
                      </button>
                      <button
                        className="text-button danger"
                        onClick={() =>
                          run(() =>
                            transact((draft) =>
                              receiveRouteReturn(
                                draft,
                                item.id,
                                dispatch?.warehouseId ?? "",
                                false,
                              ),
                            ),
                          )
                        }
                      >
                        <X size={14} /> Rechazar
                      </button>
                    </div>
                  ) : (
                    (item.movementId ?? "—")
                  ),
                ],
              };
            })}
            empty="Las devoluciones registradas aparecerán aquí."
            emptyIcon={<RotateCw size={26} />}
            sortable
          />
        </section>
      )}

      {tab === "liquidations" && (
        <section className="card logistics-table-card">
          <div className="logistics-card-heading">
            <div>
              <span className="logistics-overline">
                <CalendarClock size={13} /> Cierre operativo
              </span>
              <h2>Costos y liquidaciones</h2>
              <p>
                Registra los gastos y valores reportados al cerrar cada ruta.
              </p>
            </div>
            <button
              className="secondary-btn"
              onClick={() => {
                setLiquidationRouteId("");
                setLiquidation({
                  fuel: 0,
                  tolls: 0,
                  otherExpenses: 0,
                  collections: 0,
                  returnsAmount: 0,
                  responsible: "",
                });
                setLiquidationOpen(true);
              }}
              disabled={
                !routes.some(
                  (item) =>
                    item.status === "Cerrada" &&
                    !(state.routeLiquidations ?? []).some(
                      (entry) => entry.routeId === item.id,
                    ),
                )
              }
            >
              <Plus size={15} /> Nueva liquidación
            </button>
          </div>
          <Records
            headers={[
              "Ruta",
              "Responsable",
              "Combustible",
              "Peajes",
              "Otros gastos",
              "Cobros",
              "Devoluciones",
              "Neto",
            ]}
            rows={(state.routeLiquidations ?? []).map((item) => {
              const routeRecord = routes.find(
                (record) => record.id === item.routeId,
              );
              const net =
                item.collections -
                item.fuel -
                item.tolls -
                item.otherExpenses -
                item.returnsAmount;
              return {
                id: item.id,
                search: `${routeRecord?.number ?? ""} ${item.responsible}`,
                cells: [
                  <strong>{routeRecord?.number ?? item.routeId}</strong>,
                  item.responsible,
                  money(item.fuel),
                  money(item.tolls),
                  money(item.otherExpenses),
                  money(item.collections),
                  money(item.returnsAmount),
                  <strong>{money(net)}</strong>,
                ],
              };
            })}
            empty="Cierra una ruta para registrar su liquidación."
            emptyIcon={<CalendarClock size={26} />}
            sortable
          />
        </section>
      )}

      {tab === "resources" && (
        <div className="resource-layout logistics-resource-layout">
          <section className="card">
            <div className="logistics-card-heading">
              <div>
                <span className="logistics-overline">
                  <Truck size={13} /> Flota propia
                </span>
                <h2>Vehículos disponibles</h2>
              </div>
              <button
                className="secondary-btn"
                onClick={() => setResource("vehicle")}
              >
                <Plus size={15} /> Registrar vehículo
              </button>
            </div>
            <Records
              headers={["Placa", "Unidad", "Capacidad", "Odómetro", "Estado"]}
              rows={vehicles.map((vehicle) => ({
                id: vehicle.id,
                search: `${vehicle.plate} ${vehicle.description}`,
                cells: [
                  <strong>{vehicle.plate}</strong>,
                  vehicle.description,
                  `${vehicle.capacityUnits} und.`,
                  `${vehicle.odometer.toLocaleString("es-PE")} km`,
                  <Tag value={vehicle.active ? "Activo" : "Inactivo"} />,
                ],
              }))}
              empty="Registra vehículos para asignarlos a rutas."
              emptyIcon={<Truck size={26} />}
            />
          </section>
          <section className="card">
            <div className="logistics-card-heading">
              <div>
                <span className="logistics-overline">
                  <UserRound size={13} /> Personal operativo
                </span>
                <h2>Conductores</h2>
              </div>
              <button
                className="secondary-btn"
                onClick={() => setResource("driver")}
              >
                <Plus size={15} /> Registrar conductor
              </button>
            </div>
            <Records
              headers={["Conductor", "Licencia", "Vigencia", "Estado"]}
              rows={drivers.map((driver) => ({
                id: driver.id,
                search: `${driver.name} ${driver.license}`,
                cells: [
                  <strong>{driver.name}</strong>,
                  driver.license,
                  driver.licenseExpiresOn,
                  <Tag value={driver.active ? "Activo" : "Inactivo"} />,
                ],
              }))}
              empty="Registra conductores con licencia vigente."
              emptyIcon={<UserRound size={26} />}
            />
          </section>
        </div>
      )}

      {dispatchOpen && (
        <Modal
          title="Planificar despacho"
          subtitle="El despacho conservará los datos de destino de la orden de venta."
          onClose={() => setDispatchOpen(false)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const ok = run(() =>
                transact((draft) =>
                  createDispatch(draft, {
                    salesOrderId: orderId,
                    warehouseId,
                    priority,
                    deliveryWindow,
                    deliveryAddress,
                    guideNumber,
                  }),
                ),
              );
              if (ok) setDispatchOpen(false);
            }}
          >
            <div className="form-grid">
              <label className="span-two">
                Orden de venta
                <select
                  required
                  value={orderId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setOrderId(id);
                    const document = state.documents.find(
                      (item) => item.id === id,
                    );
                    const customer = state.customers.find(
                      (item) => item.id === document?.partyId,
                    );
                    setDeliveryAddress(
                      document?.deliveryAddress || customer?.address || "",
                    );
                    setWarehouseId(document?.warehouseId ?? warehouseId);
                  }}
                >
                  <option value="">Selecciona un pedido</option>
                  {availableOrders.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.number} ·{" "}
                      {customerFor({ salesOrderId: document.id } as Dispatch)
                        ?.name ?? "Cliente"}{" "}
                      · {document.status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Almacén
                <select
                  required
                  value={warehouseId}
                  onChange={(event) => setWarehouseId(event.target.value)}
                >
                  <option value="">Selecciona un almacén</option>
                  {state.warehouses
                    .filter((item) => item.active)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Prioridad
                <select
                  value={priority}
                  onChange={(event) =>
                    setPriority(event.target.value as Dispatch["priority"])
                  }
                >
                  <option>Normal</option>
                  <option>Alta</option>
                  <option>Urgente</option>
                </select>
              </label>
              <label className="span-two">
                Dirección de entrega
                <textarea
                  required
                  rows={2}
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  placeholder="Av., número, distrito, ciudad"
                />
              </label>
              <label>
                Ventana de entrega
                <input
                  value={deliveryWindow}
                  onChange={(event) => setDeliveryWindow(event.target.value)}
                  placeholder="Ej. 09:00–12:00"
                />
              </label>
              <label>
                Guía de remisión <span className="optional">· opcional</span>
                <input
                  value={guideNumber}
                  onChange={(event) => setGuideNumber(event.target.value)}
                  placeholder="T001-00001234"
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setDispatchOpen(false)}
              >
                Cancelar
              </button>
              <button className="btn">
                <PackageCheck size={15} /> Crear despacho
              </button>
            </div>
          </form>
        </Modal>
      )}

      {routeOpen && (
        <Modal
          title="Crear hoja de ruta"
          subtitle="Agrupa despachos y define el punto de salida antes de asignar vehículo y conductor."
          onClose={() => setRouteOpen(false)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const ok = run(() =>
                transact((draft) =>
                  createRoute(
                    draft,
                    routeDate,
                    routeDispatches,
                    undefined,
                    routeOrigin,
                  ),
                ),
              );
              if (ok) {
                setRouteOpen(false);
                setRouteDispatches([]);
                setRouteOrigin("");
              }
            }}
          >
            <div className="form-grid">
              <label>
                Fecha de salida
                <input
                  type="date"
                  required
                  value={routeDate}
                  onChange={(event) => setRouteDate(event.target.value)}
                />
              </label>
              <label className="span-two">
                Punto de salida
                <input
                  required
                  value={routeOrigin}
                  onChange={(event) => setRouteOrigin(event.target.value)}
                  placeholder="Dirección del almacén o centro de distribución"
                />
              </label>
              <label className="span-two">
                Despachos a incluir
                <select
                  multiple
                  required
                  value={routeDispatches}
                  onChange={(event) =>
                    setRouteDispatches(
                      [...event.currentTarget.selectedOptions].map(
                        (option) => option.value,
                      ),
                    )
                  }
                >
                  {plannedDispatches.map((dispatch) => (
                    <option key={dispatch.id} value={dispatch.id}>
                      {dispatch.number} · {orderNumberFor(dispatch)} ·{" "}
                      {dispatch.deliveryAddress}
                    </option>
                  ))}
                </select>
                <small className="field-help">
                  Usa Ctrl o Cmd para seleccionar varios destinos.
                </small>
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setRouteOpen(false)}
              >
                Cancelar
              </button>
              <button className="btn">
                <RouteIcon size={15} /> Crear hoja de ruta
              </button>
            </div>
          </form>
        </Modal>
      )}

      {resource === "vehicle" && (
        <Modal
          title="Registrar vehículo"
          subtitle="Define la unidad de carga y su capacidad operativa."
          onClose={() => setResource(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const ok = run(() =>
                transact((draft) => {
                  addVehicle(draft, plate, vehicleDescription, vehicleCapacity);
                }),
              );
              if (ok) {
                setResource(null);
                setPlate("");
                setVehicleDescription("");
                setVehicleCapacity(1);
              }
            }}
          >
            <div className="form-grid">
              <label>
                Placa
                <input
                  required
                  value={plate}
                  onChange={(event) => setPlate(event.target.value)}
                  placeholder="ABC-123"
                />
              </label>
              <label>
                Capacidad
                <input
                  required
                  min="1"
                  step="1"
                  type="number"
                  value={vehicleCapacity}
                  onChange={(event) =>
                    setVehicleCapacity(Number(event.target.value))
                  }
                />
              </label>
              <label className="span-two">
                Descripción
                <input
                  required
                  value={vehicleDescription}
                  onChange={(event) =>
                    setVehicleDescription(event.target.value)
                  }
                  placeholder="Camión baranda · 4 toneladas"
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setResource(null)}
              >
                Cancelar
              </button>
              <button className="btn">Guardar vehículo</button>
            </div>
          </form>
        </Modal>
      )}

      {resource === "driver" && (
        <Modal
          title="Registrar conductor"
          subtitle="La vigencia de licencia se comprobará al asignar la ruta."
          onClose={() => setResource(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const ok = run(() =>
                transact((draft) => {
                  addDriver(
                    draft,
                    driverName,
                    license,
                    licenseExpires,
                    driverPhone,
                  );
                }),
              );
              if (ok) {
                setResource(null);
                setDriverName("");
                setLicense("");
                setLicenseExpires("");
                setDriverPhone("");
              }
            }}
          >
            <div className="form-grid">
              <label className="span-two">
                Nombre completo
                <input
                  required
                  value={driverName}
                  onChange={(event) => setDriverName(event.target.value)}
                />
              </label>
              <label>
                Licencia
                <input
                  required
                  value={license}
                  onChange={(event) => setLicense(event.target.value)}
                />
              </label>
              <label>
                Vigente hasta
                <input
                  required
                  type="date"
                  value={licenseExpires}
                  onChange={(event) => setLicenseExpires(event.target.value)}
                />
              </label>
              <label className="span-two">
                Teléfono
                <input
                  value={driverPhone}
                  onChange={(event) => setDriverPhone(event.target.value)}
                  placeholder="Opcional"
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setResource(null)}
              >
                Cancelar
              </button>
              <button className="btn">Guardar conductor</button>
            </div>
          </form>
        </Modal>
      )}

      {deliveryId && (
        <Modal
          title="Confirmar entrega"
          subtitle="Registra receptor y una evidencia con enlace verificable."
          onClose={() => setDeliveryId(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const ok = run(() =>
                transact((draft) =>
                  confirmDelivery(draft, {
                    dispatchId: deliveryId,
                    dateTime: "",
                    receiver,
                    evidenceUrl,
                    observation: deliveryObservation,
                  }),
                ),
              );
              if (ok) setDeliveryId(null);
            }}
          >
            <div className="form-grid">
              <label>
                Receptor
                <input
                  required
                  value={receiver}
                  onChange={(event) => setReceiver(event.target.value)}
                  placeholder="Nombre y apellidos"
                />
              </label>
              <label className="span-two">
                Enlace de evidencia
                <input
                  required
                  type="url"
                  value={evidenceUrl}
                  onChange={(event) => setEvidenceUrl(event.target.value)}
                  placeholder="https://…"
                />
              </label>
              <label className="span-two">
                Observaciones
                <textarea
                  rows={2}
                  value={deliveryObservation}
                  onChange={(event) =>
                    setDeliveryObservation(event.target.value)
                  }
                  placeholder="Observación de entrega"
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setDeliveryId(null)}
              >
                Cancelar
              </button>
              <button className="btn">Confirmar entrega</button>
            </div>
          </form>
        </Modal>
      )}

      {trackingId && (
        <Modal
          title="Registrar avance"
          subtitle="Este evento se guarda en el historial del despacho."
          onClose={() => setTrackingId(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const ok = run(() =>
                transact((draft) =>
                  addTracking(draft, trackingId, trackingStatus, trackingNote),
                ),
              );
              if (ok) setTrackingId(null);
            }}
          >
            <div className="form-grid">
              <label>
                Estado
                <select
                  value={trackingStatus}
                  onChange={(event) => setTrackingStatus(event.target.value)}
                >
                  <option>En tránsito</option>
                  <option>En destino</option>
                  <option>Esperando recepción</option>
                  <option>Incidencia en ruta</option>
                </select>
              </label>
              <label className="span-two">
                Observación
                <textarea
                  rows={3}
                  value={trackingNote}
                  onChange={(event) => setTrackingNote(event.target.value)}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setTrackingId(null)}
              >
                Cancelar
              </button>
              <button className="btn">Guardar avance</button>
            </div>
          </form>
        </Modal>
      )}

      {failedId && (
        <Modal
          title="Registrar incidencia de entrega"
          subtitle="La entrega fallida debe quedar explicada para resolverla o reprogramarla."
          onClose={() => setFailedId(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const ok = run(() =>
                transact((draft) =>
                  markDeliveryFailed(draft, failedId, failedReason),
                ),
              );
              if (ok) setFailedId(null);
            }}
          >
            <div className="form-grid">
              <label className="span-two">
                Motivo de la incidencia
                <textarea
                  required
                  rows={3}
                  value={failedReason}
                  onChange={(event) => setFailedReason(event.target.value)}
                  placeholder="Cliente no ubicado, dirección incorrecta…"
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setFailedId(null)}
              >
                Cancelar
              </button>
              <button className="btn">Guardar incidencia</button>
            </div>
          </form>
        </Modal>
      )}

      {returnOpen && (
        <Modal
          title="Registrar devolución"
          subtitle="Solo puedes devolver cantidades de un despacho entregado."
          onClose={() => setReturnOpen(false)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const ok = run(() =>
                transact((draft) =>
                  registerRouteReturn(
                    draft,
                    returnDispatchId,
                    returnProductId,
                    returnQuantity,
                    returnReason,
                    returnCondition,
                  ),
                ),
              );
              if (ok) setReturnOpen(false);
            }}
          >
            <div className="form-grid">
              <label className="span-two">
                Despacho entregado
                <select
                  required
                  value={returnDispatchId}
                  onChange={(event) => {
                    setReturnDispatchId(event.target.value);
                    setReturnProductId("");
                  }}
                >
                  <option value="">Selecciona un despacho</option>
                  {delivered.map((dispatch) => (
                    <option key={dispatch.id} value={dispatch.id}>
                      {dispatch.number} · {orderNumberFor(dispatch)} ·{" "}
                      {customerFor(dispatch)?.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="span-two">
                Producto
                <select
                  required
                  value={returnProductId}
                  onChange={(event) => setReturnProductId(event.target.value)}
                >
                  <option value="">Selecciona un producto</option>
                  {returnProducts.map((line) => (
                    <option key={line.productId} value={line.productId}>
                      {state.products.find((item) => item.id === line.productId)
                        ?.name ?? line.productId}{" "}
                      · máximo {line.quantity}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cantidad
                <input
                  required
                  min="0.001"
                  step="0.001"
                  type="number"
                  value={returnQuantity}
                  onChange={(event) =>
                    setReturnQuantity(Number(event.target.value))
                  }
                />
              </label>
              <label>
                Condición
                <select
                  value={returnCondition}
                  onChange={(event) =>
                    setReturnCondition(
                      event.target.value as typeof returnCondition,
                    )
                  }
                >
                  <option>Apto para venta</option>
                  <option>Dañado</option>
                  <option>Pendiente de revisión</option>
                </select>
              </label>
              <label className="span-two">
                Motivo
                <textarea
                  required
                  rows={2}
                  value={returnReason}
                  onChange={(event) => setReturnReason(event.target.value)}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setReturnOpen(false)}
              >
                Cancelar
              </button>
              <button className="btn">Registrar devolución</button>
            </div>
          </form>
        </Modal>
      )}

      {liquidationOpen && (
        <Modal
          title="Liquidar ruta"
          subtitle="Registra los valores de cierre y el responsable de la rendición."
          onClose={() => setLiquidationOpen(false)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const ok = run(() =>
                transact((draft) =>
                  saveLiquidation(draft, {
                    routeId: liquidationRouteId,
                    ...liquidation,
                    status: "Presentada",
                  }),
                ),
              );
              if (ok) setLiquidationOpen(false);
            }}
          >
            <div className="form-grid">
              <label className="span-two">
                Ruta cerrada
                <select
                  required
                  value={liquidationRouteId}
                  onChange={(event) =>
                    setLiquidationRouteId(event.target.value)
                  }
                >
                  <option value="">Selecciona una ruta</option>
                  {routes
                    .filter(
                      (item) =>
                        item.status === "Cerrada" &&
                        !(state.routeLiquidations ?? []).some(
                          (entry) => entry.routeId === item.id,
                        ),
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.number} · {item.date}
                      </option>
                    ))}
                </select>
              </label>
              {(
                [
                  "fuel",
                  "tolls",
                  "otherExpenses",
                  "collections",
                  "returnsAmount",
                ] as const
              ).map((key) => (
                <label key={key}>
                  {
                    {
                      fuel: "Combustible",
                      tolls: "Peajes",
                      otherExpenses: "Otros gastos",
                      collections: "Cobros",
                      returnsAmount: "Valor devuelto",
                    }[key]
                  }
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={liquidation[key]}
                    onChange={(event) =>
                      setLiquidation((value) => ({
                        ...value,
                        [key]: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              ))}
              <label className="span-two">
                Responsable
                <input
                  required
                  value={liquidation.responsible}
                  onChange={(event) =>
                    setLiquidation((value) => ({
                      ...value,
                      responsible: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setLiquidationOpen(false)}
              >
                Cancelar
              </button>
              <button className="btn">Guardar liquidación</button>
            </div>
          </form>
        </Modal>
      )}
      {orderDetailId &&
        state.documents.find((item) => item.id === orderDetailId) && (
          <SalesDocumentDetailsModal
            doc={state.documents.find((item) => item.id === orderDetailId)!}
            onClose={() => setOrderDetailId(null)}
          />
        )}
    </section>
  );
}
