"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/hooks/redux";
import { usePermissions } from "@/hooks/use-permissions";
import { useDebounceSearch } from "@/hooks/use-debounced-search";
import { Department, DepartmentFilters, FilterConfig } from "@/types";
import PageHeader from "@/components/ui/page-header";
import DataTable, { ColumnDef, ActionMenuItem } from "@/components/ui/data-table";
import GenericFilter from "@/components/ui/generic-filter";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Building2, AlertTriangle } from "lucide-react";
import Swal from "sweetalert2";
import { handleAPIError } from "@/lib/utils/api-client";
import { useDepartments } from "@/hooks/use-departments";


export default function DepartmentsPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Permission checks
  const { canCreate, canDelete } = usePermissions();

  // Local state
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const { fetchDepartments, deleteDepartment, setFilters, setSort, setPagination, clearError, setSelectedDepartment } = useDepartments();

  // Redux state
  const {
    departments,
    loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
    stats,
  } = useAppSelector((state) => state.departments);

  // Keep filters in a ref for debounced search
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Debounced search functionality
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
        placeholder: 'Search departments...',
        cols: 12, // Full width on mobile
        mdCols: 6, // Larger width on medium screens
        lgCols: 6, // Larger width on large screens
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        placeholder: 'All Statuses',
        cols: 12, // Full width on mobile
        mdCols: 6, // Smaller width on medium screens
        lgCols: 6, // Smaller width on large screens
        options: [
          { value: 'all', label: 'All Statuses' },
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
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
    search: searchTerm, // Use debounced search term instead of filters.search
    status: filters.status || 'all',
  }), [searchTerm, filters]);

  // Filter handlers
  const handleFilterChange = useCallback((newFilters: Record<string, any>) => {
    // Don't handle search through this function since it's debounced separately
    const departmentFilters: DepartmentFilters = {
      search: filters.search, // Keep current search from Redux
      status: newFilters.status === 'all' ? '' : (newFilters.status || ''),
    };
    setFilters(departmentFilters);
  }, [setFilters, filters.search]);

  const handleFilterReset = useCallback(() => {
    const defaultFilters: DepartmentFilters = {
      search: '',
      status: '',
    };
    setFilters(defaultFilters);
    setSearchTerm(''); // Also reset the search term
    setIsFilterExpanded(false); // Close filter panel when filters are reset
  }, [setFilters, setSearchTerm]);

  // Table columns configuration
  const columns: ColumnDef<Department>[] = [
    {
      key: 'name',
      label: 'Department Name',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{value}</span>
            <span className="text-sm text-muted-foreground">
              ID: {row._id?.slice(-8) || 'N/A'}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      sortable: false,
      render: (value) => (
        <div className="max-w-xs">
          {value ? (
            <span className="text-sm text-muted-foreground line-clamp-2">
              {value}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground italic">
              No description
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => {
        const statusColors = {
          active: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800',
          inactive: 'bg-muted text-muted-foreground border-border',
        };

        return (
          <Badge className={`${statusColors[value as keyof typeof statusColors]} border`}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </Badge>
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

  // Event handlers
  const handleSort = useCallback((field: keyof Department, direction: "asc" | "desc") => {
    setSort({ field, direction });
  }, [setSort]);

  const handlePageChange = useCallback((page: number) => {
    setPagination({ page });
  }, [setPagination]);

  const handlePageSizeChange = useCallback((limit: number) => {
    setPagination({ limit, page: 1 });
  }, [setPagination]);

  const handleEditDepartment = useCallback((department: Department) => {
    router.push(`/departments/edit/${department._id}`);
  }, [router]);


  const handleDeleteDepartment = useCallback(async (department: Department) => {
    const result = await Swal.fire({
      title: `Delete ${department.name}?`,
      text: "Are you sure you want to delete this department?",
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
        text: 'Please wait while we delete the department.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      try {
        await deleteDepartment(department._id as string).unwrap();

        // Show success message
        Swal.fire({
          title: "Deleted!",
          text: "Department has been deleted successfully.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false
        });

        toast({
          title: "Success",
          description: "Department deleted successfully.",
          variant: "default",
        });

        fetchDepartments();
      } catch (error: any) {
        // Show error message
        Swal.fire({
          title: "Error!",
          text: "Failed to delete department. Please try again.",
          icon: "error",
          confirmButtonText: "OK"
        });

        handleAPIError(error, "Failed to delete department. Please try again.");
      }
    }
  }, [deleteDepartment, toast]);


  // Fetch departments effect
  useEffect(() => {
    fetchDepartments({
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{stats.totalDepartments}</p>
            </div>
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeDepartments}</p>
            </div>
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
              <div className="h-3 w-3 bg-green-600 rounded-full" />
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Inactive</p>
              <p className="text-2xl font-bold text-gray-600">{stats.inactiveDepartments}</p>
            </div>
            <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
              <div className="h-3 w-3 bg-gray-600 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }, [stats]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        subtitle="Manage organizational departments"
        onAddClick={() => router.push("/departments/add")}
        addButtonText="Add Department"

        // Filter functionality
        showFilterButton={true}
        hasActiveFilters={Object.values(uiFilters).some(v => v && v !== 'all' && v !== '')}
        isFilterExpanded={isFilterExpanded}
        onFilterToggle={() => {
          if (Object.values(uiFilters).some(v => v && v !== 'all' && v !== '')) {
            // If there are active filters, clear them
            handleFilterReset();
          } else {
            // Otherwise just toggle the filter panel
            setIsFilterExpanded(!isFilterExpanded);
          }
        }}
        activeFiltersCount={Object.values(uiFilters).filter(v => v && v !== 'all' && v !== '').length}
        filterText="Filter Departments"
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
            title="Filter Departments"
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
          data={departments}
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
          emptyMessage="No departments found"

          // Just pass the resource name - DataTable handles everything
          resourceName="departments"
          onView={(department: Department) => setSelectedDepartment(department)}
          onDelete={handleDeleteDepartment}
          enablePermissionChecking={true}
        />
      </div>
    </div>
  );
}