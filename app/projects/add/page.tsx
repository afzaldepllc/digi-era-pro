"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import PageHeader from "@/components/ui/page-header";
import GenericForm from "@/components/ui/generic-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FolderPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigationLoading } from "@/hooks/use-navigation-loading";
import { createProjectFormSchema } from '@/lib/validations/project';
import { CreateProjectFormData } from '@/types';
import { useProjects } from '@/hooks/use-projects';
import { useClients } from '@/hooks/use-clients';
import { useNavigation } from "@/components/providers/navigation-provider";

export default function AddProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const { navigateTo } = useNavigation()
  // Get prefill data from URL params (when creating from client page)
  const clientId = searchParams?.get('clientId') || undefined;
  const prefill = searchParams?.get('prefill') === 'true';

  const form = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      clientId: clientId || "",
      budget: 0,
      startDate: "",
      endDate: "",
      status: "pending",
      priority: "medium",
    },
  });

  // Use new hooks
  const { createProject } = useProjects();
  const { clients, loading: clientsLoading } = useClients();

  // Prefill project data from client if available
  useEffect(() => {
    if (prefill && clientId && clients.length > 0) {
      // Find the client and get related data for prefilling
      const client = clients.find(c => c._id === clientId);
      if (client && client._id) {
        // Prefill basic client selection and disable it
        form.setValue('clientId', client._id);

        // Set basic project name from client
        form.setValue('name', `${client.name} Project`);
      }
    }
  }, [prefill, clientId, clients, form]);

  const handleSubmit = async (data: CreateProjectFormData) => {
    setLoading(true);
    try {
      const result = await createProject(data);
      toast({
        title: "Success",
        description: "Project created successfully",
      });

      // Navigate to project edit page for further configuration
      navigateTo(`/projects`);
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create project",
      });
    } finally {
      setLoading(false);
    }
  };

  const { isNavigating, handleNavigation } = useNavigationLoading();

  const handleCancel = () => {
    handleNavigation("/projects");
  };

  // Prepare client options for dropdown
  const clientOptions = clients
    // .filter(client => client.status === 'qualified' && client._id) // Only qualified clients can have projects
    .filter(client => client.clientStatus === 'qualified') // Only qualified clients can have projects
    .map(client => ({
      value: client._id!,
      label: `${client.name} (${client.email})`,
    }));

  console.log('clients98', clients);
  console.log('clientOPtions', clientOptions);

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
          cols: 12,
          mdCols: 6,
          lgCols:4
        },
        {
          name: "clientId",
          label: "Client",
          type: "select" as const,
          searchable: true,
          placeholder: "Select a client",
          required: true,
          disabled: !!clientId, // Disable if prefilled from client page
          options: clientOptions,
          loading: clientsLoading,
          description: "The client for whom this project is being created",
          cols: 12,
          mdCols: 6,
          lgCols:4
        },
        {
          name: "status",
          label: "Status",
          type: "select" as const,
          searchable: true,
          options: [
            { value: "pending", label: "Pending" },
            { value: "active", label: "Active" },
          ],
          description: "Initial project status",
          cols: 12,
          mdCols: 6,
          lgCols:4
        },
        {
          name: "priority",
          label: "Priority",
          type: "select" as const,
          searchable: true,
          options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "urgent", label: "Urgent" },
          ],
          description: "Project priority level",
          cols: 12,
          mdCols: 6,
        },
        {
          name: "budget",
          label: "Budget",
          type: "text" as const,
          placeholder: "50000",
          description: "Total project budget (optional)",
          cols: 12,
          mdCols: 6,
        },
        {
          name: "startDate",
          label: "Start Date",
          type: "date" as const,
          description: "Planned project start date",
          cols: 12,
          mdCols: 6,
        },
        {
          name: "endDate",
          label: "End Date",
          type: "date" as const,
          description: "Planned project end date",
          cols: 12,
          mdCols: 6,
        },
        
        
        {
          name: "description",
          label: "Description",
          type: "rich-text" as const,
          placeholder: "Brief project description",
          description: "A short description of the project",
          cols: 12,
        },
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Add Project"
        subtitle={prefill ? "Create project from client data" : "Create a new project"}
        actions={
          <Button variant="outline" onClick={handleCancel} disabled={loading || isNavigating}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        }
      />

      {/* Form */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-6 py-4">
          <FolderPlus className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Project Information</h2>
        </div>

        <div className="p-6">
          <GenericForm
            form={form}
            fields={formFields}
            onSubmit={handleSubmit}
            loading={loading}
            submitText="Create Project"
            cancelText="Cancel"
            onCancel={handleCancel}
          />
        </div>
      </div>

      {prefill && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-2">
            <div className="mt-0.5">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
            </div>
            <div>
              <h4 className="font-medium text-blue-900">Prefilled Data</h4>
              <p className="text-sm text-blue-700">
                This form has been prefilled with project information from the related lead.
                You can modify these details as needed.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}