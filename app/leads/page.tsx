"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLeads } from "@/hooks/use-leads";
import { useDebounceSearch } from "@/hooks/use-debounced-search";
import PageHeader from "@/components/ui/page-header";
import DataTable, { ColumnDef, ActionMenuItem } from "@/components/ui/data-table";
import GenericFilter, { FilterConfig } from "@/components/ui/generic-filter";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lead, LeadFilters } from "@/types";
import { Building2, Briefcase, AlertTriangle, User, DollarSign, Calendar, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import Swal from 'sweetalert2';

export default function LeadsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { canCreate, canDelete } = usePermissions();
  
  // Hooks
  const {
    leads,
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
    fetchLeads,
    deleteLead,
    qualifyLead,
    unqualifyLead,
    clearError,
  } = useLeads();

  // Local state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
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
      source: currentFilters.source,
      priority: currentFilters.priority,
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
        placeholder: 'Search leads...',
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
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'qualified', label: 'Qualified' },
          { value: 'unqualified', label: 'Unqualified' },
        ],
      },
      {
        key: 'source',
        label: 'Source',
        type: 'select',
        placeholder: 'All Sources',
        cols: 12,
        mdCols: 6,
        lgCols: 6,
        options: [
          { value: 'all', label: 'All Sources' },
          { value: 'website', label: 'Website' },
          { value: 'referral', label: 'Referral' },
          { value: 'cold_call', label: 'Cold Call' },
          { value: 'email', label: 'Email Marketing' },
          { value: 'social_media', label: 'Social Media' },
          { value: 'event', label: 'Event/Conference' },
          { value: 'other', label: 'Other' },
        ],
      },
      {
        key: 'priority',
        label: 'Priority',
        type: 'select',
        placeholder: 'All Priorities',
        cols: 12,
        mdCols: 6,
        lgCols: 6,
        options: [
          { value: 'all', label: 'All Priorities' },
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'urgent', label: 'Urgent' },
        ],
      },
    ],
    defaultValues: {
      search: '',
      status: 'all',
      source: 'all',
      priority: 'all',
    },
  }), []);

  // Map Redux filters to UI filters
  const uiFilters = useMemo(() => ({
    search: searchTerm || '',
    status: filters.status || 'all',
    source: filters.source || 'all',
    priority: filters.priority || 'all',
  }), [searchTerm, filters]);

  // Filter handlers
  const handleFilterChange = useCallback((newFilters: Record<string, any>) => {
    const leadFilters: LeadFilters = {
      search: filters.search,
      status: newFilters.status === 'all' ? '' : (newFilters.status || ''),
      source: newFilters.source === 'all' ? '' : (newFilters.source || ''),
      priority: newFilters.priority === 'all' ? '' : (newFilters.priority || ''),
    };
    setFilters(leadFilters);
  }, [setFilters, filters.search]);

  const handleFilterReset = useCallback(() => {
    const defaultFilters: LeadFilters = {
      search: '',
      status: '',
      source: '',
      priority: '',
    };
    setFilters(defaultFilters);
    setSearchTerm('');
    setIsFilterExpanded(false);
  }, [setFilters, setSearchTerm]);

  // Table columns configuration
  const columns: ColumnDef<Lead>[] = [
    {
      key: 'name',
      label: 'Lead Info',
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
            <span className="text-sm text-muted-foreground">{row.email}</span>
            {row.company && (
              <span className="text-xs text-muted-foreground">{row.company}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'projectName',
      label: 'Project',
      sortable: true,
      render: (value, row) => (
        <div className="flex flex-col">
          <span className="font-medium">{value}</span>
          {row.projectBudget && (
            <span className="text-sm text-green-600">
              <DollarSign className="h-3 w-3 inline mr-1" />
              {formatCurrency(row.projectBudget)}
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
          active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800',
          inactive: 'bg-muted text-muted-foreground border-border',
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
      key: 'source',
      label: 'Source',
      sortable: true,
      render: (value) => value ? value.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Unknown',
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (value) => {
        const priorityColors = {
          low: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300 border-gray-200 dark:border-gray-800',
          medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
          high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300 border-orange-200 dark:border-orange-800',
          urgent: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800',
        };

        return (
          <Badge className={`${priorityColors[value as keyof typeof priorityColors]} border`}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </Badge>
        );
      },
    },
    {
      key: 'nextFollowUpDate',
      label: 'Follow Up',
      sortable: true,
      render: (value) => value ? (
        <div className="flex items-center text-sm">
          <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
          {new Date(value).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground italic">Not scheduled</span>
      ),
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



  // Handle creating client from lead
  const handleCreateClientFromLead = useCallback(async (lead: Lead) => {
    try {
      // Show confirmation dialog
      const result = await Swal.fire({
        title: 'Create Client from Lead',
        text: `Are you sure you want to create a client account for ${lead.name}? This will qualify the lead and create a new client profile.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Create Client',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#3B82F6',
        cancelButtonColor: '#6B7280',
      });

      if (!result.isConfirmed) return;

      // Call API to create client from lead
      const response = await fetch(`/api/leads/${lead._id}/create-client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const responseData = await response.json();

      if (!responseData.success) {
        throw new Error(responseData.error || 'Failed to create client');
      }

      toast({
        title: "Success",
        description: `Client created successfully for ${lead.name}`,
      });

      // Refresh leads data
      fetchLeads();

      // Navigate to client edit page
      router.push(`/clients/edit/${responseData.client._id}`);

    } catch (error: any) {
      console.error('Error creating client from lead:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create client from lead",
      });
    }
  }, [toast, fetchLeads, router]);


    // Custom actions for DataTable
  const customActions: ActionMenuItem<Lead>[] = [
    {
      label: "Create Client",
      icon: <UserPlus className="h-4 w-4" />,
      onClick: handleCreateClientFromLead,
      disabled: (lead: Lead) => {
        // Disable if lead is not active or already has a client
        return lead.status !== 'active' || !!lead.clientId;
      },
      hasPermission: () => canCreate('clients'),
      hideIfNoPermission: true,
    },
  ];

  
  // Event handlers
  const handleSort = useCallback((field: keyof Lead, direction: "asc" | "desc") => {
    setSort({ field: field as any, direction });
  }, [setSort]);

  const handlePageChange = useCallback((page: number) => {
    setPagination({ page });
  }, [setPagination]);

  const handlePageSizeChange = useCallback((limit: number) => {
    setPagination({ limit, page: 1 });
  }, [setPagination]);

  const handleEditLead = useCallback((lead: Lead) => {
    router.push(`/leads/edit/${lead._id}`);
  }, [router]);

  const handleDeleteLead = useCallback(async (lead: Lead) => {
    const result = await Swal.fire({
      title: `Delete ${lead.name}?`,
      text: "Are you sure you want to delete this lead?",
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
        text: 'Please wait while we delete the lead.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      try {
        await deleteLead(lead._id as string).unwrap();

        Swal.fire({
          title: "Deleted!",
          text: "Lead has been deleted successfully.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false
        });

        toast({
          title: "Success",
          description: "Lead deleted successfully.",
          variant: "default",
        });

        fetchLeads();
      } catch (error: any) {
        Swal.fire({
          title: "Error!",
          text: "Failed to delete lead. Please try again.",
          icon: "error",
          confirmButtonText: "OK"
        });

        toast({
          title: "Error",
          description: error || "Failed to delete lead. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [deleteLead, toast]);

  // Fetch leads effect
  useEffect(() => {
    fetchLeads({
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{stats.totalLeads}</p>
            </div>
            <Briefcase className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-blue-600">{stats.activeLeads}</p>
            </div>
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
              <div className="h-3 w-3 bg-blue-600 rounded-full" />
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Qualified</p>
              <p className="text-2xl font-bold text-green-600">{stats.qualifiedLeads}</p>
            </div>
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
              <div className="h-3 w-3 bg-green-600 rounded-full" />
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Budget</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(stats.averageBudget || 0)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Conversion</p>
              <p className="text-2xl font-bold text-orange-600">{stats.conversionRate || 0}%</p>
            </div>
            <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
              <div className="h-3 w-3 bg-orange-600 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }, [stats]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        subtitle="Manage and track your sales leads"
        onAddClick={() => router.push("/leads/add")}
        addButtonText="Add Lead"
        showAddButton={canCreate("leads")}

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
        filterText="Filter Leads"
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
            title="Filter Leads"
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
          data={leads}
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
          emptyMessage="No leads found"

          // Just pass the resource name - DataTable handles everything
          resourceName="leads"
          customActions={customActions}
          onView={(lead: Lead) => setSelectedLead(lead)}
          onDelete={handleDeleteLead}
          enablePermissionChecking={true}
        />
      </div>
    </div>
  );
}