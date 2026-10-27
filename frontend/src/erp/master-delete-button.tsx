import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useErp } from "./store";
import { Modal } from "./ui";
import { toast } from "./toast";
import { deleteMasterRecord, masterDeletionPolicy, type MasterKind } from "./master-deletion";

export function MasterDeleteButton({ kind, id, name }: { kind: MasterKind; id: string; name: string }) {
  const { state, transact } = useErp();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const policy = masterDeletionPolicy(state, kind, id);
  const action = policy.action === "deactivate" ? "Desactivar" : "Eliminar";
  return <>
    <button type="button" className="icon-btn master-delete-button" aria-label={`Eliminar o desactivar ${name}`} title={`${action} registro`} onClick={() => { setError(""); setOpen(true); }}><Trash2 size={16} /></button>
    {open && <Modal title={policy.action === "blocked" ? "Registro protegido" : `${action} registro`} onClose={() => setOpen(false)}>
      <p><strong>{name}</strong></p>
      <p>{policy.reason}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="secondary-btn" onClick={() => setOpen(false)}>{policy.action === "blocked" ? "Cerrar" : "Cancelar"}</button>
        {policy.action !== "blocked" && <button type="button" className="btn" onClick={() => {
          try {
            let result: "delete" | "deactivate" = "delete";
            transact((next) => { result = deleteMasterRecord(next, kind, id); });
            setOpen(false);
            toast.success(result === "delete" ? "Registro eliminado correctamente." : "Registro desactivado correctamente.");
          } catch (err) { setError(err instanceof Error ? err.message : "No se pudo completar la acción."); }
        }}><Trash2 size={15} /> {action} registro</button>}
      </div>
    </Modal>}
  </>;
}
