"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/hooks/redux";
import { usePermissions } from "@/hooks/use-permissions";
import { useDebounceSearch } from "@/hooks/use-debounced-search";
import { Project, ProjectFilters, FilterConfig } from "@/types";
import PageHeader from "@/components/ui/page-header";
import DataTable, { ColumnDef } from "@/components/ui/data-table";
import GenericFilter from "@/components/ui/generic-filter";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Building2, AlertTriangle, Users, Calendar, DollarSign, FolderOpen } from "lucide-react";
import Swal from "sweetalert2";
import { handleAPIError } from "@/lib/utils/api-client";
import { useProjects } from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

export default function ProjectsPage() {
  console.log('Rendering ProjectsPage component');
  const router = useRouter();
  const { toast } = useToast();
  const { canCreate, canDelete } = usePermissions();

  // Local state
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const {
    fetchProjects,
    deleteProject,
    approveProject,
    setFilters,
    setSort,
    setPagination,
    clearError,
    setSelectedProject
  } = useProjects();

  // Redux state
  const {
    projects,
    loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
    stats,
  } = useAppSelector((state) => state.projects);

  // Keep filters in a ref for debounced search
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Debounced search functionality
  const handleDebouncedSearch = useCallback((searchTerm: string) => {
    const currentFilters = filtersRef.current;
    setFilters({
      ...currentFilters,
      search: searchTerm,
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
        key: "search",
        label: "Search Projects",
        type: "text",
        placeholder: "Search by name, description...",
        cols: 12,
        mdCols: 6,
        lgCols: 6,
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        placeholder: "All Statuses",
        cols: 12,
        mdCols: 6,
        lgCols: 6,
        options: [
          { label: "All Statuses", value: "" },
          { label: "Pending", value: "pending" },
          { label: "Active", value: "active" },
          { label: "Approved", value: "approved" },
          { label: "Completed", value: "completed" },
          { label: "Inactive", value: "inactive" },
        ],
      },
      {
        key: "priority",
        label: "Priority",
        type: "select",
        placeholder: "All Priorities",
        cols: 12,
        mdCols: 6,
        lgCols: 6,
        options: [
          { label: "All Priorities", value: "" },
          { label: "Low", value: "low" },
          { label: "Medium", value: "medium" },
          { label: "High", value: "high" },
          { label: "Urgent", value: "urgent" },
        ],
      },
    ],
    defaultValues: {
      search: '',
      status: '',
      priority: '',
    },
  }), []);

  // Map Redux filters to UI filters
  const uiFilters = useMemo(() => ({
    search: searchTerm,
    status: filters.status || '',
    priority: filters.priority || '',
  }), [searchTerm, filters]);

  // Filter handling functions
  const handleFilterChange = useCallback((newFilters: Record<string, any>) => {
    const projectFilters: ProjectFilters = {
      search: filters.search,
      status: newFilters.status || '',
      priority: newFilters.priority || '',
    };
    setFilters(projectFilters);
  }, [setFilters, filters.search]);

  const handleFilterReset = useCallback(() => {
    const defaultFilters: ProjectFilters = {
      search: '',
      status: '',
      priority: '',
    };
    setFilters(defaultFilters);
    setSearchTerm('');
    setIsFilterExpanded(false);
  }, [setFilters, setSearchTerm]);

  // Table columns configuration
  const columns: ColumnDef<Project>[] = [
    {
      key: "name",
      label: "Project Name",
      render: (value: any, row: Project) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.name}</span>
          {row.projectType && (
            <span className="text-sm text-muted-foreground">{row.projectType}</span>
          )}
        </div>
      ),
      sortable: true,
    },
    {
      key: "client" as any,
      label: "Client",
      render: (value: any, row: Project) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.client?.name || 'Unknown'}</span>
          <span className="text-sm text-muted-foreground">{row.client?.email}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (value: any, row: Project) => {
        const status = row.status;
        const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
          pending: "outline",
          active: "default",
          approved: "secondary",
          completed: "secondary",
          inactive: "destructive",
        };
        return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
      },
      sortable: true,
    },
    {
      key: "priority",
      label: "Priority",
      render: (value: any, row: Project) => {
        const priority = row.priority;
        const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
          low: "outline",
          medium: "default",
          high: "secondary",
          urgent: "destructive",
        };
        return <Badge variant={variants[priority] || "outline"}>{priority}</Badge>;
      },
      sortable: true,
    },
    {
      key: "budget",
      label: "Budget",
      render: (value: any, row: Project) => (
        row.budget ? formatCurrency(row.budget) : "Not set"
      ),
    },
    {
      key: "departments" as any,
      label: "Departments",
      render: (value: any, row: Project) => (
        <div className="flex flex-wrap gap-1">
          {row.departments?.slice(0, 2).map((dept: any) => (
            <Badge key={dept._id} variant="outline" className="text-xs">
              {dept.name}
            </Badge>
          ))}
          {(row.departments?.length || 0) > 2 && (
            <Badge variant="outline" className="text-xs">
              +{(row.departments?.length || 0) - 2} more
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      render: (value: any, row: Project) => {
        const date = new Date(row.createdAt || '');
        return date.toLocaleDateString();
      },
      sortable: true,
    },
  ];

  // Event handlers
  const handleSort = useCallback((field: keyof Project, direction: "asc" | "desc") => {
    setSort({ field: field as any, direction });
  }, [setSort]);

  const handlePageChange = useCallback((page: number) => {
    setPagination({ page });
  }, [setPagination]);

  const handleDeleteProject = useCallback(async (project: Project) => {
    const result = await Swal.fire({
      title: "Delete Project?",
      text: `Are you sure you want to delete "${project.name}"? This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        await deleteProject(project._id!);
        toast({
          title: "Success",
          description: "Project deleted successfully",
        });
      } catch (error: any) {
        handleAPIError(error);
      }
    }
  }, [deleteProject, toast]);

  const handleApproveProject = useCallback(async (project: Project) => {
    const result = await Swal.fire({
      title: "Approve Project?",
      text: `Are you sure you want to approve "${project.name}"?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, approve it!",
    });

    if (result.isConfirmed) {
      try {
        await approveProject(project._id!);
        toast({
          title: "Success",
          description: "Project approved successfully",
        });
      } catch (error: any) {
        handleAPIError(error);
      }
    }
  }, [approveProject, toast]);

  // Fetch projects effect
  useEffect(() => {
    console.log('useEffect triggered: fetching projects with')
    fetchProjects({
      page: pagination.page,
      limit: pagination.limit,
      filters,
      // sort
    });
  }, [fetchProjects, pagination.page, pagination.limit, filters, sort]);

  // Clear error effect
  useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error,
      });
      clearError();
    }
  }, [error, toast, clearError]);



  // Stats display
  const statsCards = useMemo(() => {
    console.log('projects', projects);
    console.log('stats', stats);
    if (!stats) return null;

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">Total Projects</span>
          </div>
          <p className="text-2xl font-bold">{stats.totalProjects}</p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats.pendingProjects}</p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">Active</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.activeProjects}</p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium">Total Budget</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {stats.totalBudget ? formatCurrency(stats.totalBudget) : 'N/A'}
          </p>
        </div>
      </div>
    );
  }, [fetchProjects, stats]);



  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="Manage client projects and track their progress"
        onAddClick={() => router.push("/projects/add")}
        addButtonText="Add Project"

        // Filter functionality
        showFilterButton={true}
        hasActiveFilters={Object.values(uiFilters).some(v => v && v !== '')}
        isFilterExpanded={isFilterExpanded}
        onFilterToggle={() => {
          if (Object.values(uiFilters).some(v => v && v !== '')) {
            // If there are active filters, clear them
            handleFilterReset();
          } else {
            // Otherwise just toggle the filter panel
            setIsFilterExpanded(!isFilterExpanded);
          }
        }}
        activeFiltersCount={Object.values(uiFilters).filter(v => v && v !== '').length}
        filterText="Filter Projects"
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
            title="Filter Projects"
            className="bg-card"
            loading={isSearching}
            onSearchChange={setSearchTerm}
          />
        )}
      </PageHeader>

      {error && (
        <Alert variant="destructive" className="border-destructive bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-destructive-foreground">{error}</AlertDescription>
        </Alert>
      )}

      {statsCards}

      <div className="space-y-4">
        {/* Data Table */}
        <DataTable
          data={projects}
          columns={columns}
          loading={loading}
          totalCount={pagination.total}
          pageSize={pagination.limit}
          currentPage={pagination.page}
          onPageChange={handlePageChange}
          onSort={handleSort}
          resourceName="project"
          onEdit={(project) => router.push(`/projects/edit/${project._id}`)}
          onDelete={canDelete("project") ? handleDeleteProject : undefined}
          customActions={[
            {
              label: "Approve",
              onClick: handleApproveProject,
              variant: "default",
              icon: <Users className="h-4 w-4" />,
              hasPermission: (project: Project) => project.status === "pending" && project.departmentIds?.length > 0,
            },
            {
              label: "Categorize",
              onClick: (project: Project) => router.push(`/projects/edit/${project._id}?tab=departments`),
              variant: "default",
              icon: <Building2 className="h-4 w-4" />,
              hasPermission: (project: Project) => project.status === "pending",
            },
          ]}
        />
      </div>
    </div>
  );
}