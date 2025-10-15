    "use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useClients } from "@/hooks/use-clients";
import { useDebounceSearch } from "@/hooks/use-debounced-search";
import PageHeader from "@/components/ui/page-header";
import DataTable, { ColumnDef, ActionMenuItem } from "@/components/ui/data-table";
import GenericFilter, { FilterConfig } from "@/components/ui/generic-filter";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Client, ClientFilters } from "@/types";
import { Building2, Users, AlertTriangle, User, Mail, Phone, FolderPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import Swal from 'sweetalert2';

export default function ClientsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { canCreate, canDelete } = usePermissions();
  
  // Hooks
  const {
    clients,
    loading,
    actionLoading,
    error,
    pagination,
    filters,
    sort,
    stats,
    setFilters,
    setSort,
    setPagination,
    fetchClients,
    deleteClient,
    clearError,
  } = useClients();

  // Local state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  
  // Keep reference to current filters for search debouncing
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Search handlers
  const handleDebouncedSearch = useCallback((searchTerm: string) => {
    const currentFilters = filtersRef.current;
    setFilters({
      search: searchTerm,
      status: currentFilters.status,
    });
  }, [setFilters]);

  const { searchTerm, setSearchTerm, isSearching } = useDebounceSearch({
    onSearch: handleDebouncedSearch,
    delay: 500,
  });

  // Initialize search term from Redux filters
  useEffect(() => {
    if (filters.search !== searchTerm) {
      setSearchTerm(filters.search || '');
    }
  }, [filters.search]);

  // Filter configuration
  const filterConfig: FilterConfig = useMemo(() => ({
    fields: [
      {
        key: 'search',
        label: 'Search',
        type: 'text',
        placeholder: 'Search clients...',
        cols: 12,
        mdCols: 6,
        lgCols: 6,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        placeholder: 'All Statuses',
        cols: 12,
        mdCols: 6,
        lgCols: 6,
        options: [
          { value: 'all', label: 'All Statuses' },
          { value: 'qualified', label: 'Qualified' },
          { value: 'unqualified', label: 'Unqualified' },
        ],
      },
    ],
    defaultValues: {
      search: '',
      status: 'all',
    },
  }), []);

  // Map Redux filters to UI filters
  const uiFilters = useMemo(() => ({
    search: searchTerm || '',
    status: filters.status || 'all',
  }), [searchTerm, filters]);

  // Filter handlers
  const handleFilterChange = useCallback((newFilters: Record<string, any>) => {
    const clientFilters: ClientFilters = {
      search: filters.search,
      status: newFilters.status === 'all' ? '' : (newFilters.status || ''),
    };
    setFilters(clientFilters);
  }, [setFilters, filters.search]);

  const handleFilterReset = useCallback(() => {
    const defaultFilters: ClientFilters = {
      search: '',
      status: '',
    };
    setFilters(defaultFilters);
    setSearchTerm('');
    setIsFilterExpanded(false);
  }, [setFilters, setSearchTerm]);

  // Table columns configuration
  const columns: ColumnDef<Client>[] = [
    {
      key: 'name',
      label: 'Client Info',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{value}</span>
            <div className="flex items-center text-sm text-muted-foreground">
              <Mail className="h-3 w-3 mr-1" />
              {row.email}
            </div>
            {row.phone && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Phone className="h-3 w-3 mr-1" />
                {row.phone}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'company',
      label: 'Company',
      sortable: true,
      render: (value) => (
        <div className="flex items-center">
          <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => {
        const statusColors = {
          qualified: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800',
          unqualified: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800',
        };

        return (
          <Badge className={`${statusColors[value as keyof typeof statusColors]} border`}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </Badge>
        );
      },
    },
    {
      key: 'projectInterests',
      label: 'Project Interests',
      sortable: false,
      render: (value) => {
        if (!value || value.length === 0) {
          return <span className="text-sm text-muted-foreground italic">None specified</span>;
        }
        
        return (
          <div className="flex flex-wrap gap-1">
            {value.slice(0, 2).map((interest: string, index: number) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {interest}
              </Badge>
            ))}
            {value.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{value.length - 2} more
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
    },
    {
      key: 'updatedAt',
      label: 'Last Updated',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
    },
  ];

 
  // Handle creating project from client
  const handleCreateProjectFromClient = useCallback(async (client: Client) => {
    try {
      if (!client._id) {
        throw new Error('Client ID is required');
      }

      // Navigate to project add page with client prefilled
      const params = new URLSearchParams();
      params.set('clientId', client._id);
      params.set('prefill', 'true');
      
      router.push(`/projects/add?${params.toString()}`);
      
    } catch (error: any) {
      console.error('Error navigating to create project:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to navigate to project creation",
      });
    }
  }, [router, toast]);


   // Custom actions for DataTable
  const customActions: ActionMenuItem<Client>[] = [
    {
      label: "Create Project",
      icon: <FolderPlus className="h-4 w-4" />,
      onClick: handleCreateProjectFromClient,
      disabled: (client: Client) => {
        // Disable if client is not qualified
        return client.status !== 'qualified';
      },
      hasPermission: () => canCreate('projects'),
      hideIfNoPermission: true,
    },
  ];

  // Event handlers
  const handleSort = useCallback((field: keyof Client, direction: "asc" | "desc") => {
    setSort({ field: field as any, direction });
  }, [setSort]);

  const handlePageChange = useCallback((page: number) => {
    setPagination({ page });
  }, [setPagination]);

  const handlePageSizeChange = useCallback((limit: number) => {
    setPagination({ limit, page: 1 });
  }, [setPagination]);

  const handleDeleteClient = useCallback(async (client: Client) => {
    const result = await Swal.fire({
      title: `Delete ${client.name}?`,
      text: "Are you sure you want to delete this client?",
      icon: "error",
      showCancelButton: true,
      showConfirmButton: true,
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "No",
      confirmButtonColor: "#dc2626",
    });

    if (result.isConfirmed) {
      Swal.fire({
        title: 'Deleting...',
        text: 'Please wait while we delete the client.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      try {
        await deleteClient(client._id as string).unwrap();

        Swal.fire({
          title: "Deleted!",
          text: "Client has been deleted successfully.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false
        });

        toast({
          title: "Success",
          description: "Client deleted successfully.",
          variant: "default",
        });

        fetchClients();
      } catch (error: any) {
        Swal.fire({
          title: "Error!",
          text: "Failed to delete client. Please try again.",
          icon: "error",
          confirmButtonText: "OK"
        });

        toast({
          title: "Error",
          description: error || "Failed to delete client. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [deleteClient, toast]);

  // Fetch clients effect
  useEffect(() => {
    fetchClients({
      page: pagination.page,
      limit: pagination.limit,
      filters,
      sort,
    });
  }, [pagination.page, pagination.limit, filters, sort]);

  // Error handling effect
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
      clearError();
    }
  }, [error, toast, clearError]);

  // Clear error when component unmounts
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // Stats display
  const statsCards = useMemo(() => {
    if (!stats) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{stats.totalClients}</p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Qualified</p>
              <p className="text-2xl font-bold text-green-600">{stats.qualifiedClients}</p>
            </div>
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
              <div className="h-3 w-3 bg-green-600 rounded-full" />
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Unqualified</p>
              <p className="text-2xl font-bold text-red-600">{stats.unqualifiedClients}</p>
            </div>
            <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
              <div className="h-3 w-3 bg-red-600 rounded-full" />
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-blue-600">{stats.activeClients || 0}</p>
            </div>
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }, [stats]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="Manage your qualified clients and their information"
        onAddClick={() => router.push("/clients/add")}
        addButtonText="Add Client"
        showAddButton={canCreate("clients")}

        // Filter functionality
        showFilterButton={true}
        hasActiveFilters={Object.values(uiFilters).some(v => v && v !== 'all' && v !== '')}
        isFilterExpanded={isFilterExpanded}
        onFilterToggle={() => {
          if (Object.values(uiFilters).some(v => v && v !== 'all' && v !== '')) {
            handleFilterReset();
          } else {
            setIsFilterExpanded(!isFilterExpanded);
          }
        }}
        activeFiltersCount={Object.values(uiFilters).filter(v => v && v !== 'all' && v !== '').length}
        filterText="Filter Clients"
        clearFiltersText="Clear Filters"

        // Refresh functionality
        showRefreshButton={true}
        onRefresh={handleFilterReset}
        isRefreshing={loading}
      >
        {/* Generic Filter */}
        {isFilterExpanded && (
          <GenericFilter
            config={filterConfig}
            values={uiFilters}
            onFilterChange={handleFilterChange}
            onReset={handleFilterReset}
            collapsible={false}
            title="Filter Clients"
            className="bg-card"
            loading={isSearching}
            onSearchChange={setSearchTerm}
          />
        )}
      </PageHeader>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="border-destructive bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-destructive-foreground">{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      {statsCards}

      <div className="space-y-4">
        {/* Data Table */}
        <DataTable
          data={clients}
          columns={columns}
          loading={loading}
          totalCount={pagination.total}
          pageSize={pagination.limit}
          currentPage={pagination.page}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onSort={handleSort}
          sortColumn={sort.field}
          sortDirection={sort.direction}
          emptyMessage="No clients found"

          // Just pass the resource name - DataTable handles everything
          resourceName="clients"
          customActions={customActions}
          onView={(client: Client) => setSelectedClient(client)}
          onDelete={handleDeleteClient}
          enablePermissionChecking={true}
        />
      </div>
    </div>
  );
}