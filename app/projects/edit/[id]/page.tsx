"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppSelector, useAppDispatch } from "@/hooks/redux";
import { fetchProjects, updateProject } from "@/store/slices/projectSlice";
import { fetchTasks } from "@/store/slices/taskSlice";
import { fetchDepartments } from "@/store/slices/departmentSlice";
import PageHeader from "@/components/ui/page-header";
import GenericForm from "@/components/ui/generic-form";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, FolderEdit, Settings, Users, CheckSquare, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigationLoading } from "@/hooks/use-navigation-loading";
import { updateProjectFormSchema, UpdateProjectFormData } from '@/lib/validations/project';
import { Project } from '@/types';
import TaskManagementSection from '@/components/projects/task-management-section';

export default function EditProjectPage() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'categorization' | 'tasks'>('details');

  const projectId = params?.id as string;


  const form = useForm<UpdateProjectFormData>({
    resolver: zodResolver(updateProjectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      requirements: "",
      projectType: "",
      timeline: "",
      budget: "",
      startDate: "",
      endDate: "",
      status: "pending",
      priority: "medium",
      departmentIds: [],
    },
  });

  // Redux state
  const { projects, loading: projectLoading } = useAppSelector((state) => state.projects);
  const { departments, loading: departmentsLoading } = useAppSelector((state) => state.departments);
  const { tasks, loading: tasksLoading } = useAppSelector((state) => state.tasks);

  const project = projects.find(p => p._id === projectId);

  // Fetch data on component mount
  useEffect(() => {
    if (projectId) {
      dispatch(fetchProjects({}));
      dispatch(fetchTasks({ projectId }));
      dispatch(fetchDepartments({}));
    }
  }, [dispatch, projectId]);

  // Update form when project data is loaded
  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        description: project.description || "",
        requirements: project.requirements || "",
        projectType: project.projectType || "",
        timeline: project.timeline || "",
        budget: project.budget?.toString() || "",
        startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "",
        endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : "",
        status: project.status,
        priority: project.priority,
        departmentIds: project.departmentIds || [],
      });
    }
  }, [project, form]);

  const handleSubmit = async (data: UpdateProjectFormData) => {
    setLoading(true);
    try {
      // Convert form data to API format
      const updateData = {
        ...data,
        budget: data.budget ? parseFloat(data.budget) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      };

      await dispatch(updateProject({ id: projectId, data: updateData })).unwrap();

      toast({
        title: "Success",
        description: "Project updated successfully",
      });
    } catch (error: any) {
      console.error('Error updating project:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update project",
      });
    } finally {
      setLoading(false);
    }
  };

  const { isNavigating, handleNavigation } = useNavigationLoading();

  const handleCancel = () => {
    handleNavigation("/projects");
  };

  // Department options for categorization
  const departmentOptions = departments.map(dept => ({
    value: dept._id!,
    label: dept.name,
  }));

  const formFields = [
    {
      fields: [
        {
          name: "name",
          label: "Project Name",
          type: "text" as const,
          placeholder: "Enter project name",
          required: true,
          description: "A clear, descriptive name for the project",
        },
        {
          name: "description",
          label: "Description",
          type: "textarea" as const,
          placeholder: "Describe the project objectives and scope",
          description: "Detailed project description",
        },
        {
          name: "projectType",
          label: "Project Type",
          type: "text" as const,
          placeholder: "e.g., Web Development, Mobile App, etc.",
          description: "The type or category of project",
        },
        {
          name: "requirements",
          label: "Requirements",
          type: "textarea" as const,
          placeholder: "List project requirements and specifications",
          description: "Detailed project requirements",
        },
        {
          name: "timeline",
          label: "Timeline",
          type: "text" as const,
          placeholder: "Expected project duration (e.g., 3-6 months)",
          description: "Estimated project timeline",
        },
        {
          name: "budget",
          label: "Budget",
          type: "text" as const,
          placeholder: "Enter budget amount",
          description: "Project budget (numbers only)",
        },
        {
          name: "startDate",
          label: "Start Date",
          type: "date" as const,
          description: "Planned project start date",
        },
        {
          name: "endDate",
          label: "End Date",
          type: "date" as const,
          description: "Planned project end date",
        },
        {
          name: "priority",
          label: "Priority",
          type: "select" as const,
          options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "urgent", label: "Urgent" },
          ],
          description: "Project priority level",
        },
        {
          name: "status",
          label: "Status",
          type: "select" as const,
          options: [
            { value: "pending", label: "Pending" },
            { value: "active", label: "Active" },
            { value: "completed", label: "Completed" },
            { value: "approved", label: "Approved" },
            { value: "inactive", label: "Inactive" },
          ],
          description: "Current project status",
        },
      ]
    }
  ];

  const categorizationFields = [
    {
      fields: [
        {
          name: "departmentIds",
          label: "Assign Departments",
          type: "select" as const,
          placeholder: "Select departments for this project",
          required: true,
          options: departmentOptions,
          loading: departmentsLoading,
          description: "Departments responsible for project execution",
        },
      ]
    }
  ];

  if (projectLoading || !project) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading project...</p>
        </div>
      </div >
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={project.name}
        subtitle={`Project ID: ${projectId}`}
        actions={
          <Button variant="outline" onClick={handleCancel} disabled={loading || isNavigating}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        }
      />

      {/* Project Status and Info */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                  {project.status}
                </Badge>
              </div>
              <FolderEdit className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Departments</p>
                <p className="text-2xl font-bold">{project.departmentIds?.length || 0}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tasks</p>
                <p className="text-2xl font-bold">{tasks.filter(t => t.projectId === projectId && t.type === 'task').length}</p>
              </div>
              <CheckSquare className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Priority</p>
                <Badge variant={project.priority === 'urgent' ? 'destructive' : 'outline'}>
                  {project.priority}
                </Badge>
              </div>
              <Settings className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        <Button
          variant={activeTab === 'details' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('details')}
        >
          Project Details
        </Button>
        <Button
          variant={activeTab === 'categorization' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('categorization')}
        >
          Categorization
        </Button>
        <Button
          variant={activeTab === 'tasks' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('tasks')}
        >
          Tasks & Sub-tasks
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderEdit className="h-5 w-5" />
              Project Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GenericForm
              form={form}
              fields={formFields}
              onSubmit={handleSubmit}
              loading={loading}
              submitText="Update Project"
              cancelText="Cancel"
              onCancel={handleCancel}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'categorization' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Department Categorization
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Assign this project to one or more departments for execution
            </p>
          </CardHeader>
          <CardContent>
            <GenericForm
              form={form}
              fields={categorizationFields}
              onSubmit={handleSubmit}
              loading={loading}
              submitText="Update Departments"
              cancelText="Cancel"
              onCancel={handleCancel}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'tasks' && (
        <TaskManagementSection
          projectId={projectId}
          project={project}
          departments={departments}
        />
      )}
    </div>
  );
}