import { ensurePurchasePayables } from "./purchase-payables";
import { cleanBusinessData, clearDemoOperations } from "./business-cleanup";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ensureAccessControl, initialState, type State } from "./model";
import { ensureMasterData } from "./master-migrations";
import { seedIntegratedDemoData } from "./integrated-demo-data";

const KEY = "enterprisecloud-integrated-erp-v1";
const OLD_BACKUP = `${KEY}-before-2026-10-16-cleanup`;
type Store = {
  state: State;
  transact: (action: (draft: State) => void) => void;
  storageError: string;
};
const Context = createContext<Store | null>(null);

function read(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const fresh = initialState();
      ensureMasterData(fresh);
      seedIntegratedDemoData(fresh);
      ensurePurchasePayables(fresh);
      localStorage.setItem(KEY, JSON.stringify(fresh));
      localStorage.removeItem(OLD_BACKUP);
      return fresh;
    }
    const state = JSON.parse(raw) as State;
    if (
      state.version !== 1 ||
      !Array.isArray(state.documents) ||
      !Array.isArray(state.products) ||
      !Array.isArray(state.movements) ||
      !Array.isArray(state.customers) ||
      !Array.isArray(state.suppliers) ||
      !Array.isArray(state.warehouses) ||
      !Array.isArray(state.quotes) ||
      !Array.isArray(state.categories) ||
      !Array.isArray(state.audit) ||
      !state.stock ||
      !state.settings
    ) throw Error("Los datos guardados no tienen un formato compatible.");
    const cleaned = cleanBusinessData(state);
    const demoOperationsCleared = clearDemoOperations(state);
    const accessUpdated = ensureAccessControl(state);
    const mastersUpdated = ensureMasterData(state);
    const payablesUpdated = ensurePurchasePayables(state);
    let integratedDemoUpdated = false;
    if (state.integratedDemoVersion !== 2) {
      seedIntegratedDemoData(state);
      ensurePurchasePayables(state);
      integratedDemoUpdated = true;
    }
    // Commit before returning so reloads and other tabs cannot restore demo data.
    if (cleaned || demoOperationsCleared || accessUpdated || mastersUpdated || payablesUpdated || integratedDemoUpdated)
      localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.removeItem(OLD_BACKUP);
    return state;
  } catch (error) {
    throw Error(
      `No se pudieron cargar los datos: ${error instanceof Error ? error.message : "error desconocido"}`,
    );
  }
}

export function ErpProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(read);
  const [storageError, setStorageError] = useState("");
  const current = useRef(state);
  useEffect(() => {
    const sync = () => {
      try {
        if (!localStorage.getItem(KEY)) return;
        const next = read();
        if (JSON.stringify(next) !== JSON.stringify(current.current)) {
          current.current = next;
          setState(next);
        }
        setStorageError("");
      } catch {
        setStorageError("No se pudieron sincronizar los datos guardados. Recarga para revisar el almacenamiento.");
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY && event.newValue) sync();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const transact = (action: (draft: State) => void) => {
    const base = localStorage.getItem(KEY) ? read() : current.current;
    const draft = structuredClone(base);
    action(draft);
    ensurePurchasePayables(draft);
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      setStorageError(
        "No se pudo guardar en este navegador. Libera espacio o habilita el almacenamiento antes de continuar.",
      );
      throw Error("No se pudo guardar la operación. Los datos anteriores siguen intactos.");
    }
    setStorageError("");
    current.current = draft;
    setState(draft);
  };
  return (
    <Context.Provider value={{ state, transact, storageError }}>
      {children}
    </Context.Provider>
  );
}
export function useErp() {
  const store = useContext(Context);
  if (!store) throw Error("ERP provider missing");
  return store;
}
