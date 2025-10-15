"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDebounceSearch } from "@/hooks/use-debounced-search";
import { Role, RoleFilters, RoleSort, FilterConfig } from "@/types";
import PageHeader from "@/components/ui/page-header";
import DataTable, { ColumnDef, ActionMenuItem } from "@/components/ui/data-table";
import GenericFilter from "@/components/ui/generic-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Shield, RefreshCw, AlertTriangle, Crown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
// roles and permissions
import { usePermissions } from "@/hooks/use-permissions";
import { useRoles } from "@/hooks/use-roles";
import Swal from "sweetalert2";
import { handleAPIError } from "@/lib/utils/api-client";
import { useDepartments } from "@/hooks/use-departments";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";


export default function RolesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { hasPermission, canUpdate, canDelete } = usePermissions();
  const { fetchDepartments } = useDepartments();
  const {
    fetchRoles,
    deleteRole,
    setFilters,
    setSort,
    setPagination,
    clearError,
    refreshRoles,
    resetRoles
  } = useRoles();

  const {
    roles,
    loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
    stats,
  } = useAppSelector((state) => state.roles);


  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [availableDepartments, setAvailableDepartments] = useState<Array<{ value: string, label: string }>>([]);

  // Keep filters in a ref for debounced search
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Debounced search functionality
  const handleDebouncedSearch = useCallback((searchTerm: string) => {
    const currentFilters = filtersRef.current;
    setFilters({
      search: searchTerm,
      department: currentFilters.department,
      hierarchyLevel: currentFilters.hierarchyLevel,
      isSystemRole: currentFilters.isSystemRole,
      status: currentFilters.status,
    });
  }, [setFilters]);

  const { searchTerm, setSearchTerm, isSearching } = useDebounceSearch({
    onSearch: handleDebouncedSearch,
    delay: 500,
  });

  // Initialize search term from current filters
  useEffect(() => {
    if (filters.search !== searchTerm) {
      setSearchTerm(filters.search || '');
    }
  }, [filters.search]);

  // Fetch available departments for filter
  const fetchAvailableDepartments = useCallback(async () => {
    try {
      const response = await fetchDepartments({ page: 1, limit: 100 }).unwrap();
      console.log('Departments fetch response for filter:', response);
      if (response.success) {
        const departmentOptions = response.data.departments.map((dept: any) => ({
          value: dept._id,
          label: dept.name,
        })) || [];
        setAvailableDepartments(departmentOptions);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to load departments for filter',
        variant: "destructive",
      });
      console.error('Failed to fetch departments for filter:', error);
    }
  }, []);



  // Fetch departments for filters on mount
  useEffect(() => {
    fetchAvailableDepartments();
  }, [fetchAvailableDepartments]);

  // Fetch roles effect (similar to users page)
  useEffect(() => {
    const fetchParams = {
      page: pagination.page,
      limit: pagination.limit,
      filters,
      sort,
    };
    fetchRoles(fetchParams);
  }, [fetchRoles, pagination.page, pagination.limit, filters, sort]);

  // Filter configuration (consistent with users page)
  const filterConfig: FilterConfig = useMemo(() => ({
    fields: [
      {
        key: 'search',
        label: 'Search Roles',
        type: 'text',
        placeholder: 'Search by name or description...',
        cols: 12,
        mdCols: 4,
        lgCols: 3,
      },
      {
        key: 'department',
        label: 'Department',
        type: 'select',
        placeholder: 'All Departments',
        cols: 12,
        mdCols: 4,
        lgCols: 3,
        options: [
          { value: 'all', label: 'All Departments' },
          ...availableDepartments,
        ],
      },
      {
        key: 'hierarchyLevel',
        label: 'Hierarchy Level',
        type: 'select',
        placeholder: 'All Levels',
        cols: 12,
        mdCols: 4,
        lgCols: 2,
        options: [
          { value: 'all', label: 'All Levels' },
          { value: '1', label: 'Level 1 (Lowest)' },
          { value: '2', label: 'Level 2' },
          { value: '3', label: 'Level 3' },
          { value: '4', label: 'Level 4' },
          { value: '5', label: 'Level 5' },
          { value: '6', label: 'Level 6' },
          { value: '7', label: 'Level 7' },
          { value: '8', label: 'Level 8' },
          { value: '9', label: 'Level 9' },
          { value: '10', label: 'Level 10 (Highest)' },
        ],
      },
      {
        key: 'isSystemRole',
        label: 'Role Type',
        type: 'select',
        placeholder: 'All Types',
        cols: 12,
        mdCols: 4,
        lgCols: 2,
        options: [
          { value: 'all', label: 'All Types' },
          { value: 'true', label: 'System Roles' },
          { value: 'false', label: 'Department Roles' },
        ],
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        placeholder: 'All Statuses',
        cols: 12,
        mdCols: 4,
        lgCols: 2,
        options: [
          { value: 'all', label: 'All Statuses' },
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'archived', label: 'Archived' },
        ],
      },
    ],
    defaultValues: {
      search: '',
      department: 'all',
      hierarchyLevel: 'all',
      isSystemRole: 'all',
      status: 'all',
    },
  }), [availableDepartments]);


  // Map filters to UI filters (convert empty strings to 'all' for selects)
  const uiFilters = useMemo(() => ({
    search: searchTerm, // Use debounced search term instead of filters.search
    department: filters.department || 'all',
    hierarchyLevel: filters.hierarchyLevel ? filters.hierarchyLevel.toString() : 'all',
    isSystemRole: filters.isSystemRole !== undefined ? filters.isSystemRole.toString() : 'all',
    status: filters.status || 'all',
  }), [searchTerm, filters]);

  // Table columns configuration
  const columns: ColumnDef<Role>[] = useMemo(() => [
    {
      key: "displayName",
      label: "Role Name",
      sortable: true,
      render: (value, row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {row.isSystemRole ? (
              <Crown className="h-4 w-4 text-yellow-600" />
            ) : (
              <Shield className="h-4 w-4 text-blue-600" />
            )}
            <span className="font-medium">{row.displayName}</span>
          </div>
          {row.description && (
            <p className="text-sm text-muted-foreground">
              {row.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "department",
      label: "Department",
      render: (value, row) => {
        const department = row.departmentDetails;
        if (row.isSystemRole) {
          return (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              System-wide
            </Badge>
          );
        }
        if (typeof department === 'object' && department) {
          return (
            <Badge variant="outline">
              {department.name}
            </Badge>
          );
        }
        return <span className="text-muted-foreground">N/A</span>;
      },
    },
    {
      key: "hierarchyLevel",
      label: "Level",
      sortable: true,
      render: (value, row) => (
        <Badge
          variant={row.hierarchyLevel >= 8 ? "destructive" :
            row.hierarchyLevel >= 6 ? "default" :
              "secondary"}
        >
          Level {row.hierarchyLevel}
        </Badge>
      ),
    },
    {
      key: "permissions",
      label: "Permissions",
      render: (value, row) => {
        const permissionsCount = Array.isArray(row.permissions) ? row.permissions.length : 0;
        const hasPermissions = permissionsCount > 0;

        return (
          <div className="flex items-center gap-2">
            <Users className={cn(
              "h-4 w-4",
              hasPermissions ? "text-green-600" : "text-muted-foreground"
            )} />
            <span className={cn(
              "text-sm",
              hasPermissions ? "text-green-700 font-medium" : "text-muted-foreground"
            )}>
              {permissionsCount} permission{permissionsCount !== 1 ? 's' : ''}
            </span>
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value, row) => (
        <Badge
          variant={row.status === "active" ? "default" : "secondary"}
          className={cn(
            row.status === "active"
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-800"
          )}
        >
          {row.status === "active" ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      sortable: true,
      render: (value, row) => {
        const date = new Date(row.createdAt || '');
        return (
          <span className="text-sm text-muted-foreground">
            {date.toLocaleDateString()}
          </span>
        );
      },
    },
  ], []);


  // Delete role handler with confirmation
  const handleDeleteClick = useCallback(async (role: Role) => {
    const result = await Swal.fire({
      title: `Delete ${role.name}?`,
      text: "Are you sure you want to delete this role?",
      icon: "error",
      showCancelButton: true,
      showConfirmButton: true,
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "No",
      confirmButtonColor: "#dc2626",
    });

    if (result.isConfirmed) {
      // Show simple loading with SweetAlert's built-in loader
      Swal.fire({
        title: 'Deleting...',
        text: 'Please wait while we delete the role.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      try {
        await deleteRole(role._id as string).unwrap();

        // Show success message
        Swal.fire({
          title: "Deleted!",
          text: "Role has been deleted successfully.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false
        });

        toast({
          title: "Success",
          description: "Role deleted successfully.",
          variant: "default",
        });
      } catch (error: any) {
        // Show error message
        Swal.fire({
          title: "Error!",
          text: "Failed to delete role. Please try again.",
          icon: "error",
          confirmButtonText: "OK"
        });

        handleAPIError(error, "Failed to delete role. Please try again.");
      }
    }
  }, [deleteRole, toast]);



  const handleFilterChange = useCallback((newFilters: Record<string, any>) => {
    // Don't handle search through this function since it's debounced separately
    const roleFilters: Partial<RoleFilters> = {
      search: filters.search, // Keep current search from filters
      department: newFilters.department === 'all' ? '' : (newFilters.department || ''),
      hierarchyLevel: newFilters.hierarchyLevel === 'all' ? undefined : (newFilters.hierarchyLevel ? parseInt(newFilters.hierarchyLevel, 10) : undefined),
      isSystemRole: newFilters.isSystemRole === 'all' ? undefined : (newFilters.isSystemRole === 'true'),
      status: newFilters.status === 'all' ? '' : (newFilters.status || ''),
    };

    setFilters(roleFilters);
  }, [setFilters, filters.search]);

  // const handleRefresh = useCallback(() => {
  //   fetchRoles();
  // }, [fetchRoles]);



  const handleFilterReset = useCallback(() => {
    const defaultFilters: Partial<RoleFilters> = {
      search: '',
      department: '',
      hierarchyLevel: undefined,
      isSystemRole: undefined,
      status: '',
    };
    setFilters(defaultFilters);
    setSearchTerm(''); // Also reset the search term
    setIsFilterExpanded(false);
  }, [setFilters, setSearchTerm]);

  // Event handlers
  const handleSort = useCallback((field: keyof Role, direction: "asc" | "desc") => {
    setSort({ field, direction });
  }, [setSort]);

  const handlePageChange = useCallback((page: number) => {
    setPagination({ page });
  }, [setPagination]);

  const handlePageSizeChange = useCallback((limit: number) => {
    setPagination({ limit, page: 1 });
  }, [setPagination]);


  const handleViewRole = useCallback((role: Role) => {
    router.push(`/roles/${role._id}`);
  }, [router]);

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

  // Helper to count active filters (consistent with users page)
  const activeFilters = useMemo(() => {
    const activeCount = Object.entries(filters).filter(([key, value]) => {
      if (key === 'search' || key === 'department' || key === 'status') {
        return value && value !== '' && value !== 'all';
      }
      return value !== undefined && value !== null;
    }).length;

    const hasActiveFilters = activeCount > 0;

    return { count: activeCount, hasActive: hasActiveFilters };
  }, [filters]);

  return (

    <div className="space-y-6">
      <PageHeader
        title="Role Management"
        subtitle="Manage system and department roles with granular permissions"
        addButtonText="Create Role"
        onAddClick={() => router.push('/roles/add')}
        // Filter functionality
        showFilterButton={true}
        hasActiveFilters={activeFilters.hasActive}
        isFilterExpanded={isFilterExpanded}
        onFilterToggle={() => {
          if (activeFilters.hasActive) {
            // If there are active filters, clear them
            handleFilterReset();
          } else {
            // Otherwise just toggle the filter panel
            setIsFilterExpanded(!isFilterExpanded);
          }
        }}
        activeFiltersCount={activeFilters.count}
        filterText="Filter Roles"
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
            title="Filter Roles"
            className="bg-card"
            loading={isSearching}
            onSearchChange={setSearchTerm}
          />
        )}
      </PageHeader>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button
              variant="outline"
              size="sm"
              onClick={() => clearError()}
              className="ml-2"
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={roles}
        loading={loading}
        totalCount={pagination.total}
        pageSize={pagination.limit}
        currentPage={pagination.page}
        sortColumn={sort.field}
        sortDirection={sort.direction}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onSort={handleSort}
        customActions={[
          ...(canUpdate('roles') ? [{
            label: 'Change Permissions',
            icon: <Shield className="w-4 h-4" />,
            onClick: (role: Role) => {
              router.push(`/roles/permissions/${role._id}`);
            },
            variant: 'default' as const
          }] : [])
        ]}
        // Just pass the resource name - DataTable handles permissions internally
        resourceName="roles"
        // No need to specify actions - edit and delete are auto-enabled based on permissions
        onView={handleViewRole}
        onDelete={handleDeleteClick}
        enablePermissionChecking={true}
        emptyMessage="No roles found. Get started by creating your first role."
      />
    </div>
  );
}