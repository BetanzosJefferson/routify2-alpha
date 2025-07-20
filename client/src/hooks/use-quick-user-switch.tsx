import { useState, useEffect } from "react";
import { useAuth } from "./use-auth";
import { useToast } from "./use-toast";

export interface QuickSwitchUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  password?: string; // Almacenado temporalmente para cambio rápido
}

const STORAGE_KEY = "transroute_quick_switch_users";

export function useQuickUserSwitch() {
  const { loginMutation, logoutMutation, user: currentUser } = useAuth();
  const { toast } = useToast();
  const [savedUsers, setSavedUsers] = useState<QuickSwitchUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Cargar usuarios guardados del localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSavedUsers(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading saved users:", error);
    }
  }, []);

  // Guardar usuarios en localStorage
  const saveUsersToStorage = (users: QuickSwitchUser[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
      setSavedUsers(users);
    } catch (error) {
      console.error("Error saving users:", error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los usuarios favoritos",
        variant: "destructive",
      });
    }
  };

  // Agregar usuario actual a favoritos
  const addCurrentUserToFavorites = (password: string) => {
    if (!currentUser) {
      toast({
        title: "Error",
        description: "No hay usuario autenticado",
        variant: "destructive",
      });
      return;
    }

    const newUser: QuickSwitchUser = {
      id: currentUser.id,
      email: currentUser.email,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      role: currentUser.role,
      password: password, // Guardamos la contraseña para cambio rápido
    };

    const existingIndex = savedUsers.findIndex(u => u.email === currentUser.email);
    let updatedUsers: QuickSwitchUser[];

    if (existingIndex >= 0) {
      updatedUsers = [...savedUsers];
      updatedUsers[existingIndex] = newUser;
      toast({
        title: "Usuario actualizado",
        description: `${newUser.firstName} ${newUser.lastName} actualizado en favoritos`,
      });
    } else {
      updatedUsers = [...savedUsers, newUser];
      toast({
        title: "Usuario agregado",
        description: `${newUser.firstName} ${newUser.lastName} agregado a favoritos`,
      });
    }

    saveUsersToStorage(updatedUsers);
  };

  // Cambiar a otro usuario
  const switchToUser = async (targetUser: QuickSwitchUser) => {
    if (!targetUser.password) {
      toast({
        title: "Error",
        description: "No se encontró la contraseña para este usuario",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log(`[QUICK_SWITCH] Cambiando de ${currentUser?.firstName} a ${targetUser.firstName}`);
      
      // Hacer logout primero
      await logoutMutation.mutateAsync();
      
      // Esperar un momento para asegurar que el logout se completó
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Hacer login con el nuevo usuario
      await loginMutation.mutateAsync({
        email: targetUser.email,
        password: targetUser.password,
      });
      
      toast({
        title: "Cambio exitoso",
        description: `Ahora eres ${targetUser.firstName} ${targetUser.lastName}`,
      });
      
    } catch (error) {
      console.error("Error switching user:", error);
      toast({
        title: "Error",
        description: "No se pudo cambiar de usuario. Verifica las credenciales.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Remover usuario de favoritos
  const removeUser = (email: string) => {
    const updatedUsers = savedUsers.filter(u => u.email !== email);
    saveUsersToStorage(updatedUsers);
    toast({
      title: "Usuario removido",
      description: "Usuario removido de favoritos",
    });
  };

  // Limpiar todos los usuarios guardados
  const clearAllUsers = () => {
    saveUsersToStorage([]);
    toast({
      title: "Favoritos limpiados",
      description: "Todos los usuarios favoritos han sido removidos",
    });
  };

  return {
    savedUsers,
    isLoading,
    addCurrentUserToFavorites,
    switchToUser,
    removeUser,
    clearAllUsers,
  };
}