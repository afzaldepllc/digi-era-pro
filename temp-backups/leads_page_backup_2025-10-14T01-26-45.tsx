"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/hooks/redux";
import { usePermissions } from "@/hooks/use-permissions";
import { useDebounceSearch } from "@/hooks/use-debounced-search";
import { Lead, LeadFilters, FilterConfig } from "@/types";
import PageHeader from "@/components/ui/page-header";
import DataTable, { ColumnDef, ActionMenuItem } from "@/components/ui/data-table";
import GenericFilter from "@/components/ui/generic-filter";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, AlertTriangle, Eye, Edit, Trash2, CheckCircle, XCircle, Edit2, EyeClosed, Trash2Icon } from "lucide-react";
import Swal from "sweetalert2";
import { handleAPIError } from "@/lib/utils/api-client";
import { useLeads } from "@/hooks/use-leads";

export default function LeadsPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Permission checks
  const { canCreate, canDelete } = usePermissions();

  // Local state
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const { fetchLeads, deleteLead, updateLeadStatus, setFilters, setSort, setPagination, clearError, setSelectedLead } = useLeads();

  // Redux state
  const {
    leads,
    loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
    stats,
  } = useAppSelector((state) => state.leads);

  // Keep filters in a ref for debounced search
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Debounced search functionality
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
  }, [filters.search, searchTerm, setSearchTerm]);

  // Filter configuration
  const filterConfig: FilterConfig = useMemo(() => ({
    fields: [
      {
        key: 'search',
        label: 'Search',
        type: 'text',
        placeholder: 'Search leads by name, email, company...',
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
        mdCols: 2,
        lgCols: 2,
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
        mdCols: 2,
        lgCols: 2,
        options: [
          { value: 'all', label: 'All Sources' },
          { value: 'website', label: 'Website' },
          { value: 'referral', label: 'Referral' },
          { value: 'cold_call', label: 'Cold Call' },
          { value: 'email', label: 'Email' },
          { value: 'social_media', label: 'Social Media' },
          { value: 'event', label: 'Event' },
          { value: 'other', label: 'Other' },
        ],
      },
      {
        key: 'priority',
        label: 'Priority',
        type: 'select',
        placeholder: 'All Priorities',
        cols: 12,
        mdCols: 2,
        lgCols: 2,
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
    search: searchTerm,
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
      label: 'Lead Information',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-primary" />
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
            <span className="text-sm text-muted-foreground">
              Budget: ${row.projectBudget?.toLocaleString()}
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
          qualified: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800',
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
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (value) => {
        const priorityColors = {
          low: 'bg-muted text-muted-foreground border-border',
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
      key: 'source',
      label: 'Source',
      sortable: true,
      render: (value) => value ? value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown',
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

  // Action menu items
  const getActionMenuItems = useCallback((lead: Lead): ActionMenuItem<Lead>[] => {
    const items: ActionMenuItem<Lead>[] = [
      {
        label: "View Details",
        icon: Eye,
        onClick: (row) => router.push(`/leads/edit/${row._id}`),
      },
    ];

    // Edit action (available for non-terminal statuses)
    if (lead.status !== 'qualified' && lead.status !== 'unqualified') {
      items.push({
        label: "Edit Lead",
        icon: Edit2,
        onClick: (row) => router.push(`/leads/edit/${row._id}`),
      });
    }

    // Status change actions
    if (lead.status === 'active' || lead.status === 'inactive') {
      items.push({
        label: "Qualify Lead",
        icon: CheckCircle,
        onClick: (row) => handleQualifyLead(row),
        variant: "success",
      });
    }

    if (lead.status === 'qualified') {
      items.push({
        label: "Unqualify Lead",
        icon: XCircle,
        onClick: (row) => handleUnqualifyLead(row),
        variant: "destructive",
      });
    }

    // Delete action (not available for qualified leads)
    if (lead.status !== 'qualified' && canDelete("leads")) {
      items.push({
        label: "Delete Lead",
        icon: Trash2Icon,
        onClick: (row) => handleDeleteLead(row),
        variant: "destructive",
        separator: true,
      });
    }

    return items;
  }, [router, canDelete]);

  // Event handlers
  const handleSort = useCallback((field: keyof Lead, direction: "asc" | "desc") => {
    setSort({ field: field as any, direction });
  }, [setSort]);

  const handlePageChange = useCallback((page: number) => {
    setPagination({ page });
  }, [setPagination]);

  const handleQualifyLead = useCallback(async (lead: Lead) => {
    const result = await Swal.fire({
      title: 'Qualify Lead?',
      text: 'This will create a new client user and mark the lead as qualified.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Qualify',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#22c55e',
    });

    if (result.isConfirmed) {
      try {
        await updateLeadStatus(lead._id!, 'qualified');
        toast({
          title: "Success",
          description: "Lead qualified successfully",
        });
      } catch (error: any) {
        console.error('Error qualifying lead:', error);
        toast({
          title: "Error",
          description: "Failed to qualify lead",
          variant: "destructive",
        });
      }
    }
  }, [updateLeadStatus, toast]);

  const handleUnqualifyLead = useCallback(async (lead: Lead) => {
    const { value: reason } = await Swal.fire({
      title: 'Unqualify Lead',
      text: 'Please provide a reason for unqualifying this lead:',
      input: 'textarea',
      inputPlaceholder: 'Reason for unqualification...',
      inputValidator: (value) => {
        if (!value || value.trim().length < 5) {
          return 'Please provide a reason (at least 5 characters)';
        }
      },
      showCancelButton: true,
      confirmButtonText: 'Unqualify',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
    });

    if (reason) {
      try {
        await updateLeadStatus(lead._id!, 'unqualified', reason.trim());
        toast({
          title: "Success",
          description: "Lead unqualified successfully",
        });
      } catch (error: any) {
        console.error('Error unqualifying lead:', error);
        toast({
          title: "Error",
          description: "Failed to unqualify lead",
          variant: "destructive",
        });
      }
    }
  }, [updateLeadStatus, toast]);

  const handleDeleteLead = useCallback(async (lead: Lead) => {
    const result = await Swal.fire({
      title: 'Delete Lead?',
      text: 'This action cannot be undone. The lead will be permanently deleted.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
    });

    if (result.isConfirmed) {
      try {
        await deleteLead(lead._id!);
        toast({
          title: "Success",
          description: "Lead deleted successfully",
        });
      } catch (error: any) {
        console.error('Error deleting lead:', error);
        toast({
          title: "Error",
          description: "Failed to delete lead",
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
      sort
    });
  }, [fetchLeads, pagination.page, pagination.limit, filters, sort]);

  // Clear error effect
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

  return (
    <div className="space-y-6">
      <PageHeader
        heading="Leads"
        text="Manage and track your sales leads"
        icon={Briefcase}
        actions={
          canCreate("leads") ? [
            {
              label: "Add Lead",
              onClick: () => router.push("/leads/add"),
              variant: "default",
            },
          ] : []
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <GenericFilter
        config={filterConfig}
        values={uiFilters}
        onValuesChange={handleFilterChange}
        onReset={handleFilterReset}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        isSearching={isSearching}
        isExpanded={isFilterExpanded}
        onToggleExpanded={setIsFilterExpanded}
      />

      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="bg-card text-card-foreground rounded-lg border p-6">
            <div className="text-2xl font-bold">{stats.totalLeads}</div>
            <p className="text-xs text-muted-foreground">Total Leads</p>
          </div>
          <div className="bg-card text-card-foreground rounded-lg border p-6">
            <div className="text-2xl font-bold text-green-600">{stats.activeLeads}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="bg-card text-card-foreground rounded-lg border p-6">
            <div className="text-2xl font-bold text-blue-600">{stats.qualifiedLeads}</div>
            <p className="text-xs text-muted-foreground">Qualified</p>
          </div>
          <div className="bg-card text-card-foreground rounded-lg border p-6">
            <div className="text-2xl font-bold">${stats.averageBudget?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Avg Budget</p>
          </div>
          <div className="bg-card text-card-foreground rounded-lg border p-6">
            <div className="text-2xl font-bold text-purple-600">{stats.conversionRate || 0}%</div>
            <p className="text-xs text-muted-foreground">Conversion Rate</p>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={leads}
        loading={loading || actionLoading}
        onSort={handleSort}
        sortColumn={sort.field}
        sortDirection={sort.direction}
        pagination={pagination}
        onPageChange={handlePageChange}
        actionMenuItems={getActionMenuItems}
        emptyState={{
          icon: Briefcase,
          title: "No leads found",
          description: leads.length === 0 && !loading 
            ? "Get started by creating your first lead" 
            : "No leads match your current filters",
        }}
      />
    </div>
  );
}