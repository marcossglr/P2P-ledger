import React, { useState } from 'react';
import {
  FolderKanban,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertTriangle,
  HardDrive,
  Calendar,
} from 'lucide-react';
import { Modal, Button, Input, Badge } from '../ui';

export default function WorkspacesModal({
  isOpen,
  onClose,
  workspaces = [],
  activeWorkspaceId,
  isSwitching,
  onSwitch,
  onCreate,
  onUpdate,
  onDelete,
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [deletingId, setDeletingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleStartCreate = () => {
    setIsCreating(true);
    setNewName('');
    setNewDesc('');
    setErrorMessage('');
  };

  const handleSaveCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      setErrorMessage('El nombre del perfil es obligatorio');
      return;
    }
    try {
      setErrorMessage('');
      await onCreate(newName.trim(), newDesc.trim());
      setIsCreating(false);
      setNewName('');
      setNewDesc('');
    } catch (err) {
      setErrorMessage(err?.message || 'Error creando perfil');
    }
  };

  const handleStartEdit = (ws) => {
    setEditingId(ws.id);
    setEditName(ws.name);
    setEditDesc(ws.description || '');
    setErrorMessage('');
  };

  const handleSaveEdit = async (wsId) => {
    if (!editName.trim()) {
      setErrorMessage('El nombre no puede estar vacío');
      return;
    }
    try {
      setErrorMessage('');
      await onUpdate(wsId, editName.trim(), editDesc.trim());
      setEditingId(null);
    } catch (err) {
      setErrorMessage(err?.message || 'Error actualizando perfil');
    }
  };

  const handleDelete = async (wsId) => {
    try {
      setErrorMessage('');
      await onDelete(wsId);
      setDeletingId(null);
    } catch (err) {
      setErrorMessage(err?.message || 'Error eliminando perfil');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gestión de Perfiles / Workspaces"
      subtitle="Organiza tus cuentas y libros de contabilidad P2P de forma aislada y segura."
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            Cerrar
          </Button>

          {!isCreating && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={handleStartCreate}
            >
              Nuevo Perfil
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Formulario de creación */}
        {isCreating && (
          <form
            onSubmit={handleSaveCreate}
            className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-300">Crear nuevo espacio de trabajo</span>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <Input
                label="Nombre del perfil"
                placeholder="Ej. Cuenta Comercial Jurídica, Personal, COP..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                required
              />
              <Input
                label="Descripción (opcional)"
                placeholder="Breve referencia del propósito de este workspace"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setIsCreating(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="xs"
                icon={Check}
              >
                Guardar y Crear
              </Button>
            </div>
          </form>
        )}

        {/* Lista de Workspaces */}
        <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
          {workspaces.map((ws) => {
            const isActive = ws.id === activeWorkspaceId;
            const isEditing = editingId === ws.id;
            const isConfirmingDelete = deletingId === ws.id;

            return (
              <div
                key={ws.id}
                className={`p-3.5 transition-colors ${
                  isActive ? 'bg-amber-500/5' : 'hover:bg-slate-900/40'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-2.5">
                    <Input
                      label="Nombre"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      size="sm"
                    />
                    <Input
                      label="Descripción"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      size="sm"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="xs"
                        icon={Check}
                        onClick={() => handleSaveEdit(ws.id)}
                      >
                        Actualizar
                      </Button>
                    </div>
                  </div>
                ) : isConfirmingDelete ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5">
                    <div className="text-xs text-rose-300">
                      ¿Confirmas eliminar <strong>{ws.name}</strong>? Se borrará su base de datos permanentemente.
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setDeletingId(null)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="xs"
                        icon={Trash2}
                        onClick={() => handleDelete(ws.id)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FolderKanban className={`h-4 w-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                        <span className="font-semibold text-sm text-slate-200 truncate">{ws.name}</span>
                        {isActive && (
                          <Badge variant="warning" size="xs">
                            Activo
                          </Badge>
                        )}
                        {ws.is_default && (
                          <Badge variant="neutral" size="xs">
                            Principal
                          </Badge>
                        )}
                      </div>

                      {ws.description && (
                        <p className="mt-0.5 text-xs text-slate-400 truncate pl-6">{ws.description}</p>
                      )}

                      <div className="mt-1.5 flex items-center gap-4 pl-6 text-[11px] text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <HardDrive className="h-3 w-3" />
                          {ws.db_size_mb} MB
                        </span>
                        {ws.created_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {ws.created_at}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isActive ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="xs"
                          disabled={isSwitching}
                          onClick={() => onSwitch(ws.id)}
                        >
                          {isSwitching ? 'Cargando...' : 'Cambiar a este'}
                        </Button>
                      ) : (
                        <span className="text-xs text-amber-400/80 font-medium px-2 py-1 select-none">
                          En uso
                        </span>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-slate-200"
                        icon={Edit2}
                        onClick={() => handleStartEdit(ws)}
                        title="Editar nombre y descripción"
                      />

                      {!ws.is_default && !isActive && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-rose-400/70 hover:text-rose-300 hover:bg-rose-500/10"
                          icon={Trash2}
                          onClick={() => setDeletingId(ws.id)}
                          title="Eliminar este perfil"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
