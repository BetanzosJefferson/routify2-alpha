import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Users, DollarSign, CreditCard, Calendar, RefreshCw, Eye, EyeOff, Filter, Scissors, ArrowRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"; // Importación de Select components

interface Transaction {
    id: number;
    user_id?: number;
    details: {
        type: string;
        details: {
            id: number;
            monto: number;
            metodoPago: string;
            pasajeros?: string;
            origen?: string;
            destino?: string;
            remitente?: string;
            destinatario?: string;
            companyId: string;
            dateCreated?: string;
            notas?: string;
            contacto?: {
                email: string | null;
                telefono: string;
            };
        };
    };
    cutoff_id: number | null;
    createdAt: string;
    updatedAt?: string;
    companyId?: string;
    user?: {
        id: number;
        firstName: string;
        lastName: string;
        email: string;
        role: string;
        company: string;
        profilePicture?: string;
        companyId: string;
        commissionPercentage: number;
    };
}

interface UserCashBoxData {
    userId: number;
    userName: string;
    userEmail: string;
    userRole: string;
    userCompany: string;
    userProfilePicture?: string;
    transactions: Transaction[];
    totalCash: number;
    totalTransfer: number;
    totalAmount: number;
    transactionCount: number;
    hasPendingCutoff: boolean;
    allTransactionsCutoff: boolean;
    hasCompletedCutoff: boolean; // Nueva propiedad para rastrear transacciones con corte
}

export function UserCashBoxesPage() {
    const { toast } = useToast();
    const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set());
    const [showAmounts, setShowAmounts] = useState(true);
    const [selectedUserFilter, setSelectedUserFilter] = useState<string>("all"); // Estado para filtro de usuario
    const [selectedCutoffFilter, setSelectedCutoffFilter] = useState<string>("all"); // Estado para filtro de corte

    const { data: transactions, isLoading, error, refetch } = useQuery({
        queryKey: ["/api/transactions/user-cash-boxes"],
        staleTime: 60000,
        gcTime: 300000,
        queryFn: async () => {
            console.log("[UserCashBoxes] Consultando transacciones de otros usuarios...");
            const response = await fetch("/api/transactions/user-cash-boxes", {
                credentials: "include",
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("[UserCashBoxes] Error en la consulta:", response.status, errorText);
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as Transaction[];
            console.log("[UserCashBoxes] Transacciones obtenidas:", data.length);
            return data;
        },
        retry: (failureCount, error) => {
            console.log("[UserCashBoxes] Reintento", failureCount, error);
            return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false,
        refetchOnMount: true,
    });

    const allUserCashBoxes: UserCashBoxData[] = useMemo(() => {
        if (!transactions || !Array.isArray(transactions)) return [];

        // El backend ya envía datos pre-agrupados por usuario, no transacciones individuales
        const userCashBoxes: UserCashBoxData[] = transactions.map((userGroup: any) => {
            console.log('[UserCashBoxes] Procesando grupo de usuario:', userGroup);
            
            // Calcular totales basados en las transacciones del grupo
            let totalCash = 0;
            let totalTransfer = 0;
            let totalAmount = 0;
            let hasPendingCutoff = false;
            let allTransactionsCutoff = true;
            let hasCompletedCutoff = false; // Nueva variable para rastrear si tiene transacciones con corte

            userGroup.transactions.forEach((transaction: any) => {
                const amount = transaction.details?.details?.monto || 0;
                const paymentMethod = transaction.details?.details?.metodoPago || "efectivo";
                
                totalAmount += amount;
                
                if (paymentMethod === "efectivo") {
                    totalCash += amount;
                } else {
                    totalTransfer += amount;
                }

                // Verificar estado de corte
                console.log(`[UserCashBoxes] Transacción ${transaction.id} - cutoff_id:`, transaction.cutoff_id, typeof transaction.cutoff_id);
                if (transaction.cutoff_id === null || transaction.cutoff_id === undefined) {
                    console.log(`[UserCashBoxes] Transacción ${transaction.id} marcada como pendiente`);
                    hasPendingCutoff = true;
                    allTransactionsCutoff = false;
                } else {
                    // Tiene al menos una transacción con corte realizado
                    hasCompletedCutoff = true;
                }
            });

            console.log(`[UserCashBoxes] Usuario ${userGroup.firstName} ${userGroup.lastName} - hasPendingCutoff: ${hasPendingCutoff}, allTransactionsCutoff: ${allTransactionsCutoff}, hasCompletedCutoff: ${hasCompletedCutoff}`);

            return {
                userId: userGroup.userId,
                userName: `${userGroup.firstName} ${userGroup.lastName}`,
                userEmail: userGroup.email,
                userRole: userGroup.role,
                userCompany: userGroup.company || '',
                userProfilePicture: userGroup.profilePicture || '',
                transactions: userGroup.transactions,
                totalCash,
                totalTransfer,
                totalAmount,
                transactionCount: userGroup.transactions.length,
                hasPendingCutoff,
                allTransactionsCutoff,
                hasCompletedCutoff
            };
        });

        return userCashBoxes.sort((a, b) => b.totalAmount - a.totalAmount);
    }, [transactions]);

    // Aplicar filtros a los userCashBoxes
    const filteredUserCashBoxes: UserCashBoxData[] = useMemo(() => {
        let currentFiltered = allUserCashBoxes;

        if (selectedUserFilter !== "all") {
            currentFiltered = currentFiltered.filter(userBox => {
                // Validar que userId existe y es válido antes de hacer toString()
                if (!userBox.userId || userBox.userId === null || userBox.userId === undefined) {
                    console.warn('[UserCashBoxes] UserBox sin userId válido en filtro:', userBox);
                    return false;
                }
                return userBox.userId.toString() === selectedUserFilter;
            });
        }

        if (selectedCutoffFilter !== "all") {
            currentFiltered = currentFiltered.filter(userBox => {
                if (selectedCutoffFilter === "pending") {
                    return userBox.hasPendingCutoff;
                } else if (selectedCutoffFilter === "completed") {
                    // Cambio: mostrar usuarios que tengan al menos una transacción con corte, no que todas tengan corte
                    return userBox.hasCompletedCutoff && userBox.transactionCount > 0;
                }
                return true; // Debería ser capturado por 'all' pero para seguridad
            });
        }

        // Filtrar las transacciones individuales según el estado de corte seleccionado
        if (selectedCutoffFilter !== "all") {
            currentFiltered = currentFiltered.map(userBox => {
                let filteredTransactions = userBox.transactions;
                
                if (selectedCutoffFilter === "pending") {
                    // Solo mostrar transacciones pendientes (cutoff_id null)
                    filteredTransactions = userBox.transactions.filter((transaction: any) => 
                        transaction.cutoff_id === null || transaction.cutoff_id === undefined
                    );
                } else if (selectedCutoffFilter === "completed") {
                    // Solo mostrar transacciones con corte realizado (cutoff_id no null)
                    filteredTransactions = userBox.transactions.filter((transaction: any) => 
                        transaction.cutoff_id !== null && transaction.cutoff_id !== undefined
                    );
                }

                // Recalcular totales basados en las transacciones filtradas
                let totalCash = 0;
                let totalTransfer = 0;
                let totalAmount = 0;

                filteredTransactions.forEach((transaction: any) => {
                    const amount = transaction.details?.details?.monto || 0;
                    const paymentMethod = transaction.details?.details?.metodoPago || "efectivo";
                    
                    totalAmount += amount;
                    
                    if (paymentMethod === "efectivo") {
                        totalCash += amount;
                    } else {
                        totalTransfer += amount;
                    }
                });

                return {
                    ...userBox,
                    transactions: filteredTransactions,
                    totalCash,
                    totalTransfer,
                    totalAmount,
                    transactionCount: filteredTransactions.length
                };
            });
        }

        return currentFiltered;
    }, [allUserCashBoxes, selectedUserFilter, selectedCutoffFilter]);


    const toggleUserExpansion = (userId: number) => {
        const newExpanded = new Set(expandedUsers);
        if (newExpanded.has(userId)) {
            newExpanded.delete(userId);
        } else {
            newExpanded.add(userId);
        }
        setExpandedUsers(newExpanded);
    };

    const formatCurrency = (amount: number) => {
        if (!showAmounts) return "****";
        const formattedAmount = Number(amount).toFixed(2);
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(Number(formattedAmount));
    };

    const handleRefresh = () => {
        refetch();
        toast({
            title: "Actualizando datos",
            description: "Consultando transacciones más recientes...",
        });
    };

    const toggleAmountVisibility = () => {
        setShowAmounts(!showAmounts);
    };

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString('es-MX', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            console.error("Error formatting date:", dateString, e);
            return "Fecha inválida";
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Cajas de usuarios</h1>
                    <p className="text-muted-foreground">
                        Gestión de cajas individuales por usuario
                    </p>
                </div>
                <div className="flex items-center justify-center h-32">
                    <div className="text-muted-foreground">Cargando datos de cajas de usuarios...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Cajas de usuarios</h1>
                    <p className="text-muted-foreground">
                        Gestión de cajas individuales por usuario
                    </p>
                </div>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error al cargar datos</AlertTitle>
                    <AlertDescription>
                        No se pudieron cargar los datos de las cajas de usuarios. Intenta recargar la página.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="w-full">
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                        <div>
                            <CardTitle className="flex items-center">
                                <Users className="mr-2 h-6 w-6" />
                                Cajas de usuarios
                            </CardTitle>
                            <CardDescription>
                                Gestión de cajas individuales por usuario
                            </CardDescription>
                        </div>
                        <div className="flex items-center space-x-2 mt-4 md:mt-0">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={toggleAmountVisibility}
                                title={showAmounts ? "Ocultar montos" : "Mostrar montos"}
                            >
                                {showAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={handleRefresh}
                                disabled={isLoading}
                                title="Actualizar"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Filtros */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Select value={selectedUserFilter} onValueChange={setSelectedUserFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filtrar por usuario" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los usuarios</SelectItem>
                                    {allUserCashBoxes.map(userBox => (
                                        <SelectItem key={userBox.userId} value={userBox.userId.toString()}>
                                            {userBox.userName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <Scissors className="h-4 w-4 text-muted-foreground" />
                            <Select value={selectedCutoffFilter} onValueChange={setSelectedCutoffFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Estado de corte" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los estados</SelectItem>
                                    <SelectItem value="pending">Corte pendiente</SelectItem>
                                    <SelectItem value="completed">Corte realizado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Resumen de totales */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
                        <div className="flex items-center justify-between md:justify-center">
                            <div className="flex items-center">
                                <DollarSign className="h-6 w-6 mr-2 text-primary" />
                                <div>
                                    <p className="text-sm font-medium">Total</p>
                                    <p className="text-xl font-bold">
                                        {formatCurrency(filteredUserCashBoxes.reduce((sum, user) => sum + user.totalAmount, 0))}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between md:justify-center">
                            <div className="flex items-center">
                                <ArrowRight className="h-6 w-6 mr-2 text-green-500" />
                                <div>
                                    <p className="text-sm font-medium">Efectivo</p>
                                    <p className="text-xl font-bold">
                                        {formatCurrency(filteredUserCashBoxes.reduce((sum, user) => sum + user.totalCash, 0))}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between md:justify-center">
                            <div className="flex items-center">
                                <CreditCard className="h-6 w-6 mr-2 text-blue-500" />
                                <div>
                                    <p className="text-sm font-medium">Transferencia</p>
                                    <p className="text-xl font-bold">
                                        {formatCurrency(filteredUserCashBoxes.reduce((sum, user) => sum + user.totalTransfer, 0))}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sección de usuarios */}
                    <div className="mb-8">
                        <div className="flex items-center mb-4">
                            <h3 className="text-lg font-semibold">Cajas por Usuario ({filteredUserCashBoxes.length})</h3>
                        </div>
                    {filteredUserCashBoxes.length === 0 ? ( // Usar filteredUserCashBoxes
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Sin datos</AlertTitle>
                            <AlertDescription>
                                No se encontraron usuarios o transacciones con los filtros aplicados.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="space-y-4">
                            {filteredUserCashBoxes.map((userBox) => ( // Usar filteredUserCashBoxes
                                <Collapsible key={userBox.userId}>
                                    <div className="border rounded-lg">
                                        <CollapsibleTrigger 
                                            className="w-full p-4 flex items-center justify-between hover:bg-muted/50"
                                            onClick={() => toggleUserExpansion(userBox.userId)}
                                        >
                                            <div className="flex items-center space-x-4">
                                                {expandedUsers.has(userBox.userId) ? (
                                                    <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                )}
                                                <div className="text-left">
                                                    <h3 className="font-semibold flex items-center gap-2">
                                                        {userBox.userName}
                                                        {(() => {
                                                            // Determinar badge basado en el filtro actual y las transacciones mostradas
                                                            if (selectedCutoffFilter === "pending") {
                                                                return (
                                                                    <Badge 
                                                                        style={{ 
                                                                            backgroundColor: '#ffc107', 
                                                                            color: '#333', 
                                                                            fontWeight: 'bold' 
                                                                        }}
                                                                    >
                                                                        Corte pendiente
                                                                    </Badge>
                                                                );
                                                            } else if (selectedCutoffFilter === "completed") {
                                                                return (
                                                                    <Badge 
                                                                        style={{ 
                                                                            backgroundColor: '#28a745', 
                                                                            color: '#fff', 
                                                                            fontWeight: 'bold' 
                                                                        }}
                                                                    >
                                                                        Corte realizado
                                                                    </Badge>
                                                                );
                                                            } else {
                                                                // Vista "all" - mostrar badge según el estado predominante
                                                                if (userBox.hasPendingCutoff) {
                                                                    return (
                                                                        <Badge 
                                                                            style={{ 
                                                                                backgroundColor: '#ffc107', 
                                                                                color: '#333', 
                                                                                fontWeight: 'bold' 
                                                                            }}
                                                                        >
                                                                            Corte pendiente
                                                                        </Badge>
                                                                    );
                                                                } else {
                                                                    return userBox.transactionCount > 0 && (
                                                                        <Badge 
                                                                            style={{ 
                                                                                backgroundColor: '#28a745', 
                                                                                color: '#fff', 
                                                                                fontWeight: 'bold' 
                                                                            }}
                                                                        >
                                                                            Corte realizado
                                                                        </Badge>
                                                                    );
                                                                }
                                                            }
                                                        })()}
                                                    </h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        {userBox.transactionCount} transacciones
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <div className="text-right">
                                                    <div className="font-semibold">{formatCurrency(userBox.totalAmount)}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Efectivo: {formatCurrency(userBox.totalCash)} | 
                                                        Transferencia: {formatCurrency(userBox.totalTransfer)}
                                                    </div>
                                                </div>
                                            </div>
                                        </CollapsibleTrigger>

                                        <CollapsibleContent>
                                            <div className="border-t p-4">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Fecha</TableHead>
                                                            <TableHead>Tipo</TableHead>
                                                            <TableHead>Detalles</TableHead>
                                                            <TableHead>Método Pago</TableHead>
                                                            <TableHead className="text-right">Monto</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {userBox.transactions.map((transaction) => (
                                                            <TableRow key={transaction.id}>
                                                                <TableCell className="text-sm">
                                                                    {formatDate(transaction.createdAt)}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant={transaction.details.type === 'reservation' ? 'default' : 'secondary'}>
                                                                        {transaction.details.type === 'reservation' ? 'Reservación' : 'Paquetería'}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-sm">
                                                                    {transaction.details.type === 'reservation' ? (
                                                                        <div>
                                                                            <div className="font-medium">{transaction.details.details.pasajeros}</div>
                                                                            <div className="text-muted-foreground">
                                                                                {transaction.details.details.origen} → {transaction.details.details.destino}
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div>
                                                                            <div className="font-medium">
                                                                                {transaction.details.details.remitente} → {transaction.details.details.destinatario}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant={transaction.details.details.metodoPago === 'efectivo' ? 'default' : 'secondary'}>
                                                                        {transaction.details.details.metodoPago}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium">
                                                                    {formatCurrency(transaction.details.details.monto)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CollapsibleContent>
                                    </div>
                                </Collapsible>
                            ))}
                        </div>
                    )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}