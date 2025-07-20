import { useState } from "react";
import { useQuickUserSwitch, QuickSwitchUser } from "@/hooks/use-quick-user-switch";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  UserPlus, 
  Trash2, 
  RotateCcw, 
  Loader2,
  Settings,
  AlertTriangle,
  Search
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface QuickUserSwitchProps {
  className?: string;
}

export function QuickUserSwitch({ className }: QuickUserSwitchProps) {
  const { user: currentUser } = useAuth();
  const { 
    savedUsers, 
    isLoading, 
    addCurrentUserToFavorites, 
    addUserToFavorites,
    switchToUser, 
    removeUser, 
    clearAllUsers 
  } = useQuickUserSwitch();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [showBrowseDialog, setShowBrowseDialog] = useState(false);
  const [browsePassword, setBrowsePassword] = useState("");
  const [selectedUser, setSelectedUser] = useState<QuickSwitchUser | null>(null);
  const [showAddOtherUserDialog, setShowAddOtherUserDialog] = useState(false);
  const [otherUserEmail, setOtherUserEmail] = useState("");
  const [otherUserPassword, setOtherUserPassword] = useState("");

  // Consultar usuarios disponibles
  const { data: availableUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/users/quick-switch"],
    enabled: showBrowseDialog,
  });

  // Función para obtener las iniciales del usuario
  const getUserInitials = (user: QuickSwitchUser) => {
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  };

  // Función para obtener el nombre amigable del rol
  const getRoleDisplayName = (role: string): string => {
    switch (role) {
      case "superAdmin":
        return "Super Admin";
      case "admin":
        return "Admin";
      case "callCenter":
        return "Call Center";
      case "checador":
        return "Checador";
      case "chofer":
        return "Chófer";
      case "taquilla":
        return "Taquilla";
      case "dueño":
        return "Dueño";
      case "comisionista":
        return "Comisionista";
      default:
        return role;
    }
  };

  const handleAddToFavorites = () => {
    if (!password.trim()) {
      return;
    }
    addCurrentUserToFavorites(password);
    setPassword("");
    setShowAddDialog(false);
  };

  const handleSwitchUser = async (targetUser: QuickSwitchUser) => {
    await switchToUser(targetUser);
  };

  // Cambiar a usuario desde la búsqueda
  const handleBrowseSwitchUser = async () => {
    if (!selectedUser || !browsePassword.trim()) return;
    
    const userWithPassword = { ...selectedUser, password: browsePassword };
    await switchToUser(userWithPassword);
    setShowBrowseDialog(false);
    setBrowsePassword("");
    setSelectedUser(null);
  };

  // Agregar otro usuario con email y contraseña
  const handleAddOtherUser = async () => {
    if (!otherUserEmail.trim() || !otherUserPassword.trim()) return;

    try {
      // Validar credenciales y obtener información del usuario
      const response = await fetch("/api/users/quick-switch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: otherUserEmail,
          password: otherUserPassword,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Credenciales inválidas o usuario no encontrado");
      }

      const userData = await response.json();
      
      // Agregar a la lista de usuarios favoritos
      const userToAdd: QuickSwitchUser = {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        password: otherUserPassword,
      };

      addUserToFavorites(userToAdd);
      
      setShowAddOtherUserDialog(false);
      setOtherUserEmail("");
      setOtherUserPassword("");
    } catch (error) {
      console.error("Error adding other user:", error);
      // El toast de error se maneja en addCurrentUserToFavorites
    }
  };

  // Filtrar usuarios guardados que no sean el actual
  const otherUsers = savedUsers.filter(u => u.email !== currentUser?.email);
  const currentUserInFavorites = savedUsers.find(u => u.email === currentUser?.email);
  
  // Filtrar usuarios disponibles que no estén ya en favoritos
  const usersNotInFavorites = availableUsers.filter(u => 
    !savedUsers.some(saved => saved.email === u.email) && 
    u.email !== currentUser?.email
  );

  return (
    <>
      {/* Dropdown principal */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className={className}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Cambiar usuario</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Cambio rápido de usuario</DropdownMenuLabel>
          
          {otherUsers.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {otherUsers.map((user) => (
                <DropdownMenuItem
                  key={user.email}
                  onClick={() => handleSwitchUser(user)}
                  className="flex items-center space-x-3 p-3"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                      {getUserInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getRoleDisplayName(user.role)}
                    </div>
                  </div>
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuItem>
              ))}
            </>
          )}
          
          <DropdownMenuSeparator />
          
          {/* Agregar usuario actual */}
          <DropdownMenuItem onClick={() => setShowAddDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            {currentUserInFavorites ? "Actualizar mis credenciales" : "Agregar mi usuario"}
          </DropdownMenuItem>
          
          {/* Agregar otro usuario */}
          <DropdownMenuItem onClick={() => setShowAddOtherUserDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Agregar otro usuario
          </DropdownMenuItem>
          
          {/* Explorar usuarios disponibles */}
          <DropdownMenuItem onClick={() => setShowBrowseDialog(true)}>
            <Search className="h-4 w-4 mr-2" />
            Explorar usuarios
          </DropdownMenuItem>
          
          {/* Gestionar usuarios guardados */}
          {savedUsers.length > 0 && (
            <DropdownMenuItem onClick={() => setShowManageDialog(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Gestionar usuarios
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog para agregar usuario actual */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar a favoritos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                La contraseña se guardará localmente para permitir cambio rápido de usuarios.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label>Usuario actual</Label>
              <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-blue-100 text-blue-700">
                    {currentUser ? getUserInitials(currentUser as QuickSwitchUser) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">
                    {currentUser?.firstName} {currentUser?.lastName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {currentUser?.email}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {currentUser ? getRoleDisplayName(currentUser.role) : ""}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Confirma tu contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña actual"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddToFavorites();
                  }
                }}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAddToFavorites}
                disabled={!password.trim()}
              >
                Agregar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para gestionar usuarios */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gestionar usuarios favoritos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {savedUsers.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                No hay usuarios guardados
              </div>
            ) : (
              <div className="space-y-2">
                {savedUsers.map((user) => (
                  <div 
                    key={user.email}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                          {getUserInitials(user)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {user.firstName} {user.lastName}
                          {user.email === currentUser?.email && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Actual
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {user.email} • {getRoleDisplayName(user.role)}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeUser(user.email)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {savedUsers.length > 0 && (
              <>
                <div className="border-t pt-4">
                  <Button
                    variant="outline"
                    onClick={clearAllUsers}
                    className="w-full text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Limpiar todos los usuarios
                  </Button>
                </div>
              </>
            )}
            
            <div className="flex justify-end">
              <Button onClick={() => setShowManageDialog(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para explorar usuarios disponibles */}
      <Dialog open={showBrowseDialog} onOpenChange={setShowBrowseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Explorar usuarios</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isLoadingUsers ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Cargando usuarios...</span>
              </div>
            ) : usersNotInFavorites.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                Todos los usuarios disponibles ya están en favoritos
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {usersNotInFavorites.map((user) => (
                    <div 
                      key={user.email}
                      className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedUser?.email === user.email 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedUser(user)}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                          {getUserInitials(user)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {user.email} • {getRoleDisplayName(user.role)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {selectedUser && (
                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="browsePassword">
                      Contraseña para {selectedUser.firstName} {selectedUser.lastName}
                    </Label>
                    <Input
                      id="browsePassword"
                      type="password"
                      value={browsePassword}
                      onChange={(e) => setBrowsePassword(e.target.value)}
                      placeholder="Ingresa la contraseña del usuario"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleBrowseSwitchUser();
                        }
                      }}
                    />
                  </div>
                )}
              </>
            )}
            
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowBrowseDialog(false);
                  setSelectedUser(null);
                  setBrowsePassword("");
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleBrowseSwitchUser}
                disabled={!selectedUser || !browsePassword.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Cambiando...
                  </>
                ) : (
                  'Cambiar usuario'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para agregar otro usuario */}
      <Dialog open={showAddOtherUserDialog} onOpenChange={setShowAddOtherUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar otro usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Agrega las credenciales de otro usuario para poder cambiar rápidamente entre cuentas.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="otherUserEmail">Correo electrónico</Label>
              <Input
                id="otherUserEmail"
                type="email"
                value={otherUserEmail}
                onChange={(e) => setOtherUserEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="otherUserPassword">Contraseña</Label>
              <Input
                id="otherUserPassword"
                type="password"
                value={otherUserPassword}
                onChange={(e) => setOtherUserPassword(e.target.value)}
                placeholder="Contraseña del usuario"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddOtherUser();
                  }
                }}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddOtherUserDialog(false);
                  setOtherUserEmail("");
                  setOtherUserPassword("");
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleAddOtherUser}
                disabled={!otherUserEmail.trim() || !otherUserPassword.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Verificando...
                  </>
                ) : (
                  'Agregar usuario'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}