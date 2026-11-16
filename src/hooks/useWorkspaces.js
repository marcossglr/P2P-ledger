import { useState, useEffect, useCallback } from 'react';
import { workspacesApi } from '../services/api';

export function useWorkspaces({ onWorkspaceSwitched } = {}) {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('default');
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState(null);

  const fetchWorkspaces = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await workspacesApi.list();
      setWorkspaces(res?.workspaces || []);
      setActiveWorkspaceId(res?.active_workspace_id || 'default');
    } catch (err) {
      console.error('[useWorkspaces] Error cargando perfiles:', err);
      setError(err?.message || 'Error cargando perfiles');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const switchWorkspace = useCallback(async (workspaceId) => {
    if (workspaceId === activeWorkspaceId || isSwitching) return;
    try {
      setIsSwitching(true);
      setError(null);
      await workspacesApi.switch(workspaceId);
      setActiveWorkspaceId(workspaceId);
      await fetchWorkspaces();
      if (typeof onWorkspaceSwitched === 'function') {
        await onWorkspaceSwitched(workspaceId);
      }
    } catch (err) {
      console.error('[useWorkspaces] Error cambiando de perfil:', err);
      setError(err?.message || 'Error cambiando de perfil');
      throw err;
    } finally {
      setIsSwitching(false);
    }
  }, [activeWorkspaceId, isSwitching, fetchWorkspaces, onWorkspaceSwitched]);

  const createWorkspace = useCallback(async (name, description) => {
    try {
      setError(null);
      const created = await workspacesApi.create(name, description);
      await fetchWorkspaces();
      return created;
    } catch (err) {
      console.error('[useWorkspaces] Error creando perfil:', err);
      setError(err?.message || 'Error creando perfil');
      throw err;
    }
  }, [fetchWorkspaces]);

  const updateWorkspace = useCallback(async (workspaceId, name, description) => {
    try {
      setError(null);
      await workspacesApi.update(workspaceId, name, description);
      await fetchWorkspaces();
    } catch (err) {
      console.error('[useWorkspaces] Error actualizando perfil:', err);
      setError(err?.message || 'Error actualizando perfil');
      throw err;
    }
  }, [fetchWorkspaces]);

  const deleteWorkspace = useCallback(async (workspaceId) => {
    try {
      setError(null);
      await workspacesApi.delete(workspaceId);
      await fetchWorkspaces();
    } catch (err) {
      console.error('[useWorkspaces] Error eliminando perfil:', err);
      setError(err?.message || 'Error eliminando perfil');
      throw err;
    }
  }, [fetchWorkspaces]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || {
    id: activeWorkspaceId,
    name: 'Principal',
    description: '',
    is_default: true,
  };

  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    isLoading,
    isSwitching,
    error,
    refresh: fetchWorkspaces,
    switchWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
  };
}
