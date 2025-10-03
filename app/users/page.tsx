"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAppSelector } from "@/hooks/redux";
import { useDebounceSearch } from "@/hooks/use-debounced-search";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DataTable from "@/components/ui/data-table";
import PageHeader from "@/components/ui/page-header";
import CustomModal from "@/components/ui/custom-modal";
import Loader, { CardLoader, TableLoader } from "@/components/ui/loader";
import GenericFilter, { FilterConfig } from "@/components/ui/generic-filter";
import { cn } from "@/lib/utils";
import { ErrorDisplay } from "@/components/ui/error-display";
import { handleAPIError, getErrorMessage } from "@/lib/utils/api-client";
import Swal from 'sweetalert2'
import {
  RefreshCw,
  Edit,
  Trash2,
  Eye,
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  EyeIcon,
  Filter,
} from "lucide-react";
import type { ColumnDef, ActionMenuItem } from "@/components/ui/data-table";
import type { Role, User } from "@/types";
import type { UserFilters, UserSort } from "@/store/slices/userSlice";
import { useDepartments } from "@/hooks/use-departments";
import { useRoles } from "@/hooks/use-roles";
import { useUsers } from "@/hooks/use-users";



export default function UsersPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Permission checks
  const { fetchDepartments } = useDepartments();
  const { fetchRoles } = useRoles();
  const {
    fetchUsers,
    deleteUser,
    setFilters,
    setSort,
    setPagination,
    setSelectedUser,
    clearError
  } = useUsers();

  // Redux state
  const {
    users,
    loading,
    actionLoading,
    error,
    selectedUser,
    filters,
    sort,
    pagination,
    stats,
  } = useAppSelector((state) => state.users);

  // Local UI state
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<Array<{ value: string, label: string }>>([]);
  const [availableDepartments, setAvailableDepartments] = useState<Array<{ value: string, label: string }>>([]);
  const [activeTab, setActiveTab] = useState('overview');

  // Keep filters in a ref for debounced search
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Debounced search functionality
  const handleDebouncedSearch = useCallback((searchTerm: string) => {
    const currentFilters = filtersRef.current;
    setFilters({
      search: searchTerm,
      role: currentFilters.role,
      status: currentFilters.status,
      department: currentFilters.department,
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
        placeholder: 'Search by name or email...',
        cols: 12, // Full width on mobile, will be responsive in GenericFilter
        mdCols: 6, // Half width on medium screens
        lgCols: 3, // Quarter width on large screens
      },
      {
        key: 'role',
        label: 'Role',
        type: 'select',
        placeholder: 'All Roles',
        cols: 12, // Full width on mobile
        mdCols: 6, // Half width on medium screens
        lgCols: 3, // Quarter width on large screens
        options: [
          { value: 'all', label: 'All Roles' },
          ...availableRoles,
        ],
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        placeholder: 'All Statuses',
        cols: 12, // Full width on mobile
        mdCols: 6, // Half width on medium screens
        lgCols: 3, // Quarter width on large screens
        options: [
          { value: 'all', label: 'All Statuses' },
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'suspended', label: 'Suspended' },
        ],
      },
      {
        key: 'department',
        label: 'Department',
        type: 'select',
        placeholder: 'All Departments',
        cols: 12, // Full width on mobile
        mdCols: 6, // Half width on medium screens
        lgCols: 3, // Quarter width on large screens
        options: [
          { value: 'all', label: 'All Departments' },
          ...availableDepartments,
        ],
      },
    ],
    defaultValues: {
      search: '',
      role: 'all',
      status: 'all',
      department: 'all',
    },
  }), [availableRoles, availableDepartments]);

  // Map Redux filters to UI filters (convert empty strings to 'all' for selects)
  const uiFilters = useMemo(() => ({
    search: searchTerm, // Use debounced search term instead of filters.search
    role: filters.role || 'all',
    status: filters.status || 'all',
    department: filters.department || 'all',
  }), [searchTerm, filters]);


  // Filter handlers
  const handleFilterChange = useCallback((newFilters: Record<string, any>) => {
    // Don't handle search through this function since it's debounced separately
    const userFilters: UserFilters = {
      search: filters.search, // Keep current search from Redux
      role: newFilters.role === 'all' ? '' : (newFilters.role || ''),
      status: newFilters.status === 'all' ? '' : (newFilters.status || ''),
      department: newFilters.department === 'all' ? '' : (newFilters.department || ''),
    };
    setFilters(userFilters);
  }, [setFilters, filters.search]);

  const handleFilterReset = useCallback(() => {
    const defaultFilters: UserFilters = {
      search: '',
      role: '',
      status: '',
      department: '',
    };
    setFilters(defaultFilters);
    setSearchTerm(''); // Also reset the search term
    setIsFilterExpanded(false); // Close filter panel when filters are reset
  }, [setFilters, setSearchTerm]);

  // Sort handlers
  const handleSort = useCallback((field: keyof User, direction: "asc" | "desc") => {
    const userSort: UserSort = {
      field,
      direction,
    };
    setSort(userSort);
  }, [setSort]);

  // Pagination handlers
  const handlePageChange = useCallback((page: number) => {
    setPagination({ page });
  }, [setPagination]);

  const handlePageSizeChange = useCallback((limit: number) => {
    setPagination({ limit, page: 1 });
  }, [setPagination]);

  // Fetch available roles for filter
  const fetchAvailableRoles = useCallback(async () => {
    try {
      const response = await fetchRoles({ page: 1, limit: 100 }).unwrap();
      if (response.success) {
        const roleOptions = response?.roles?.map((role: any) => ({
          value: role._id,
          label: role.displayName || role.name,
        })) || [];
        setAvailableRoles(roleOptions);
      }
    } catch (error) {
      console.error('Failed to fetch roles for filter:', error);
      handleAPIError(error, "Failed to load roles for filtering");
    }
  }, [fetchRoles]);

  // Fetch available departments for filter
  const fetchAvailableDepartments = useCallback(async () => {
    try {
      const response = await fetchDepartments({ page: 1, limit: 100 }).unwrap();
      if (response.success) {
        const { data } = response;
        const departmentOptions = data?.departments?.map((dept: any) => ({
          value: dept._id,
          label: dept.name,
        })) || [];
        setAvailableDepartments(departmentOptions);
      }
    } catch (error) {
      console.error('Failed to fetch departments for filter:', error);
      handleAPIError(error, "Failed to load departments for filtering");
    }
  }, [fetchDepartments]);

  // Fetch roles and departments for filters on mount
  useEffect(() => {
    fetchAvailableRoles();
    fetchAvailableDepartments();
  }, [fetchAvailableRoles, fetchAvailableDepartments]);

  // Fetch users effect
  useEffect(() => {
    const fetchParams = {
      page: pagination.page,
      limit: pagination.limit,
      filters,
      sort,
    };
    fetchUsers(fetchParams);
  }, [fetchUsers, pagination.page, pagination.limit, filters, sort]);

  // Clear error when component unmounts
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // User actions
  const handleViewUser = useCallback((user: User) => {
    setSelectedUser(user);
    setIsQuickViewOpen(true);
  }, [setSelectedUser]);

  const handleEditUser = useCallback((user: User) => {
    router.push(`/users/edit/${user._id}`);
  }, [router]);

  const handleDeleteUser = useCallback(async (user: User) => {
    const result = await Swal.fire({
      title: `Delete ${user.name}?`,
      text: "Are you sure you want to delete this user?",
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
        text: 'Please wait while we delete the user.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      try {
        await deleteUser(user._id as string).unwrap();

        // Show success message
        Swal.fire({
          title: "Deleted!",
          text: "User has been deleted successfully.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false
        });

        toast({
          title: "Success",
          description: "User deleted successfully.",
          variant: "default",
        });
      } catch (error: any) {
        // Show error message
        Swal.fire({
          title: "Error!",
          text: "Failed to delete user. Please try again.",
          icon: "error",
          confirmButtonText: "OK"
        });

        handleAPIError(error, "Failed to delete user. Please try again.");
      }
    }

  }, [deleteUser, toast]);


  // Table columns configuration
  const columns: ColumnDef<User>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-3">
          {row.avatar ? (
            <img
              src={row.avatar}
              alt={row.name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {row.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <div className="font-medium">{value}</div>
            <div className="text-sm text-muted-foreground">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (value, row) => {
        // Handle both populated and non-populated role data
        const roleData = typeof value === 'object' && value !== null ? value : null;
        const roleName = roleData?.displayName || roleData?.name || value || 'No Role';
        const hierarchyLevel = roleData?.hierarchyLevel;

        const roleColors = {
          admin: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800',
          manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800',
          hr: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800',
          finance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
          sales: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          user: 'bg-muted text-muted-foreground border-border',
        };

        // Determine color based on hierarchy level if available
        let colorClass = roleColors.user;
        if (hierarchyLevel >= 9) colorClass = roleColors.admin;
        else if (hierarchyLevel >= 6) colorClass = roleColors.manager;
        else if (hierarchyLevel >= 3) colorClass = roleColors.hr;

        return (
          <div className="flex items-center space-x-1">
            <Badge className={`${colorClass} border`}>
              {roleName}
            </Badge>
            {hierarchyLevel && (
              <span className="text-xs text-muted-foreground">
                L{hierarchyLevel}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => {
        const statusColors = {
          active: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800',
          inactive: 'bg-muted text-muted-foreground border-border',
          suspended: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800',
        };

        return (
          <Badge className={`${statusColors[value as keyof typeof statusColors]} border`}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </Badge>
        );
      },
    },
    {
      key: 'department',
      label: 'Department',
      sortable: true,
      render: (value) => {
        // Handle both populated and non-populated department data
        const deptData = typeof value === 'object' && value !== null ? value : null;
        const deptName = deptData?.name || value || '-';
        const deptStatus = deptData?.status;

        if (deptName === '-') return deptName;

        return (
          <div className="flex items-center space-x-1">
            <span>{deptName}</span>
            {deptStatus === 'inactive' && (
              <Badge variant="secondary" className="text-xs">
                Inactive
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'emailVerified',
      label: 'Verified',
      render: (value) => (
        <div className="flex items-center space-x-1">
          {value ? (
            <UserCheck className="w-4 h-4 text-green-500" />
          ) : (
            <UserX className="w-4 h-4 text-gray-400" />
          )}
        </div>
      ),
    },
    {
      key: 'lastLogin',
      label: 'Last Login',
      sortable: true,
      render: (value) => {
        if (!value) return 'Never';
        return new Date(value).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
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
  ];

  // Stats cards data
  const statsCards = stats ? [
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: <Users className="w-4 h-4" />,
      color: "text-blue-600"
    },
    {
      title: "Active Users",
      value: stats.activeUsers,
      icon: <UserCheck className="w-4 h-4" />,
      color: "text-green-600"
    },
    {
      title: "Inactive Users",
      value: stats.inactiveUsers,
      icon: <UserX className="w-4 h-4" />,
      color: "text-gray-600"
    },
    {
      title: "Suspended",
      value: stats.suspendedUsers,
      icon: <AlertTriangle className="w-4 h-4" />,
      color: "text-red-600"
    },
  ] : [];

  if (loading && users.length === 0) {
    return (
      <div>
        <PageHeader
          title="Users List"
          subtitle="Loading users..."
        />
        <CardLoader cards={4} columns={4} height="h-32" />
        <TableLoader showViewToggle={true} showRowsPerPage={true} />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Users List"
        addButtonText={"Add User"}
        onAddClick={() => router.push('/users/add')}
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
        filterText="Filter Users"
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
            title="Filter Users"
            className="bg-card"
            loading={isSearching}
            onSearchChange={setSearchTerm}
          />
        )}
      </PageHeader>

      {/* Error Display */}
      {error && (
        <ErrorDisplay
          error={{ error, statusCode: 500 }}
          resource="users"
          action="read"
          onRetry={() => {
            clearError();
          }}
          className="mb-6"
        />
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <div className={stat.color}>
                  {stat.icon}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters and Table */}
      {loading && users.length > 0 ? (
        <TableLoader />
      ) : (
        <DataTable
          data={users}
          columns={columns}
          totalCount={pagination.total}
          pageSize={pagination.limit}
          currentPage={pagination.page}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onSort={handleSort}
          sortColumn={sort.field}
          sortDirection={sort.direction}
          loading={loading}
          emptyMessage="No users found"
          // Just pass the resource name - DataTable handles permissions internally
          resourceName="users"
          // No need to specify actions - edit and delete are auto-enabled based on permissions
          onView={handleViewUser}
          onDelete={handleDeleteUser}

          enablePermissionChecking={true}
          className="bg-card border-border"
        />
      )}

      {/* Quick View Modal */}
      <CustomModal
        isOpen={isQuickViewOpen}
        onClose={() => setIsQuickViewOpen(false)}
        title="User Details"
        modalSize="lg"
      >
        {selectedUser && (
          <div className="space-y-4">
            {/* Tab Navigation */}
            <div className="border-b border-border">
              <nav className="flex" aria-label="Tabs">
                {[{
                  id: 'overview', name: 'Overview'
                },
                { id: 'permissions', name: 'Permissions' },
                { id: 'activity', name: 'Activity' }
                ].map((tab) => (
                  <div className="flex-1" key={tab.id}>
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "w-full text-center whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm  transition-colors",
                        activeTab === tab.id
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                      )}
                    >
                      {tab.name}
                    </button>
                  </div>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-4">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* Personal Info */}
                  <div className="flex items-center space-x-4">
                    {selectedUser.avatar ? (
                      <img
                        src={selectedUser.avatar}
                        alt={selectedUser.name}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xl font-medium text-primary">
                          {selectedUser.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold">{selectedUser.name}</h3>
                      <p className="text-muted-foreground">{selectedUser.email}</p>
                    </div>
                  </div>

                  {/* User Details Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Role</label>
                      <p className="mt-1">
                        {typeof selectedUser.role === 'string'
                          ? selectedUser.role
                          : selectedUser.role?.name || 'Not specified'
                        }
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <p className="mt-1">{selectedUser.status}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Department</label>
                      <p className="mt-1">
                        {typeof selectedUser.department === 'string'
                          ? selectedUser.department
                          : selectedUser.department?.name || 'Not specified'
                        }
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Position</label>
                      <p className="mt-1">{selectedUser.position || 'Not specified'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email Verified</label>
                      <p className="mt-1">{selectedUser.emailVerified ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Last Login</label>
                      <p className="mt-1">
                        {selectedUser.lastLogin
                          ? new Date(selectedUser.lastLogin).toLocaleString()
                          : 'Never'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Permissions Tab */}
              {activeTab === 'permissions' && (
                <div className="space-y-4">
                  <div className="text-center py-2">
                    <h4 className="text-lg font-medium">{selectedUser.name} Permissions</h4>
                    {/* <p className="text-muted-foreground text-sm mb-1">
                      Permissions granted through the user's assigned role
                    </p> */}
                  </div>

                  {
                    Array.isArray((selectedUser.role as Role)?.permissions) && (selectedUser.role as Role)?.permissions.length > 0 ? (
                      <div className="space-y-3">
                        {(selectedUser.role as Role)?.permissions.map(permission => (
                          <div key={permission.resource} className="px-6 py-2 bg-primary/5 rounded-lg border border-primary/20">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium capitalize text-foreground block mb-2">
                                  {permission.resource.replace(/_/g, ' ')}
                                </span>
                                <div className="flex gap-2 flex-wrap">
                                  {Array.isArray(permission.actions) && permission.actions.map(action => (
                                    <Badge key={action} variant="default" className="text-xs">
                                      {action}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                          <span className="text-2xl">🔒</span>
                        </div>
                        <p className="text-muted-foreground">No permissions assigned</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          This user doesn't have any permissions through their role
                        </p>
                      </div>
                    )}
                </div>
              )
              }

              {/* Activity Tab */}
              {activeTab === 'activity' && (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <h4 className="text-lg font-medium mb-2">User Activity</h4>
                    <p className="text-muted-foreground text-sm mb-4">
                      Recent activity and login history
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Account Creation */}
                    <div className="flex items-center space-x-3 p-3 bg-card rounded-lg border">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                        <span className="text-green-600 text-sm">✓</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Account Created</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(selectedUser.createdAt as any).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Last Login */}
                    {selectedUser.lastLogin && (
                      <div className="flex items-center space-x-3 p-3 bg-card rounded-lg border">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                          <span className="text-blue-600 text-sm">🔑</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Last Login</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(selectedUser.lastLogin).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Email Verification Status */}
                    <div className="flex items-center space-x-3 p-3 bg-card rounded-lg border">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        selectedUser.emailVerified
                          ? "bg-green-100 dark:bg-green-900/20"
                          : "bg-yellow-100 dark:bg-yellow-900/20"
                      )}>
                        <span className={cn(
                          "text-sm",
                          selectedUser.emailVerified ? "text-green-600" : "text-yellow-600"
                        )}>
                          {selectedUser.emailVerified ? "✓" : "⚠"}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          Email {selectedUser.emailVerified ? 'Verified' : 'Not Verified'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedUser.emailVerified
                            ? 'Email address has been verified'
                            : 'Email verification required'
                          }
                        </p>
                      </div>
                    </div>

                    {/* Account Status */}
                    <div className="flex items-center space-x-3 p-3 bg-card rounded-lg border">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        selectedUser.status === 'active'
                          ? "bg-green-100 dark:bg-green-900/20"
                          : selectedUser.status === 'suspended'
                            ? "bg-red-100 dark:bg-red-900/20"
                            : "bg-gray-100 dark:bg-gray-900/20"
                      )}>
                        <span className={cn(
                          "text-sm",
                          selectedUser.status === 'active'
                            ? "text-green-600"
                            : selectedUser.status === 'suspended'
                              ? "text-red-600"
                              : "text-gray-600"
                        )}>
                          {selectedUser.status === 'active' ? '●' : selectedUser.status === 'suspended' ? '⊘' : '○'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium capitalize">
                          Account {selectedUser.status}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Current account status
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setIsQuickViewOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </CustomModal>
    </div>
  );
}