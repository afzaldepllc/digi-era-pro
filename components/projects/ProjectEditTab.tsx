"use client";

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import GenericForm from '@/components/ui/generic-form';
import type { SubFormConfig } from '@/components/ui/generic-form';
import { useToast } from '@/hooks/use-toast';
import { useClients } from '@/hooks/use-clients';
import { useDepartments } from '@/hooks/use-departments';
import { useUsers } from '@/hooks/use-users';
import { useProjects } from '@/hooks/use-projects';
import { updateProjectFormSchema, UpdateProjectFormData } from '@/lib/validations/project';
import { Save } from 'lucide-react';

interface ProjectEditTabProps {
  project: any;
  onProjectUpdate?: () => void;
}

export function ProjectEditTab({ project, onProjectUpdate }: ProjectEditTabProps) {
  const [loading, setLoading] = useState(false);
  // Use actionLoading from the hook in addition to local loading state
  const { toast } = useToast();
  const { clients } = useClients();
  const { departments } = useDepartments();
  const { users } = useUsers();
  const { updateProject, actionLoading } = useProjects();

  const form = useForm<UpdateProjectFormData>({
    resolver: zodResolver(updateProjectFormSchema),
    mode: 'onChange', // Enable real-time validation
    defaultValues: {
      name: "",
      description: "",
      clientId: "",
      requirements: "",
      projectType: "",
      timeline: "",
      budget: undefined,
      startDate: "",
      endDate: "",
      status: "pending",
      priority: "medium",
      departmentIds: [],

      // Enhanced professional CRM fields
      budgetBreakdown: {
        development: "",
        design: "",
        testing: "",
        deployment: "",
        maintenance: "",
        contingency: "",
      },

      stakeholders: {
        projectManager: "",
        teamMembers: [],
        clientContacts: [],
        roles: [],
      },

      progress: {
        overallProgress: "",
        completedTasks: "",
        totalTasks: "",
        lastUpdated: "",
        nextMilestone: "",
        blockers: "",
      },

      resources: {
        estimatedHours: "",
        actualHours: "",
        teamSize: "",
        tools: [],
        externalResources: [],
      },

      qualityMetrics: {
        requirementsCoverage: "",
        defectDensity: "",
        customerSatisfaction: "",
        onTimeDelivery: false,
        withinBudget: false,
      },
    },
  });

  // Update form when project data changes
  useEffect(() => {
    if (project) {
      
      form.reset({
        name: project.name,
        description: project.description || "",
        clientId: project.clientId,
        requirements: project.requirements || "",
        projectType: project.projectType || "",
        timeline: project.timeline || "",
        budget: project.budget?.toString() || "",
        startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "",
        endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : "",
        status: project.status,
        priority: project.priority,
        departmentIds: project.departmentIds || [],

        // Enhanced professional CRM fields
        budgetBreakdown: project.budgetBreakdown ? {
          development: project.budgetBreakdown.development?.toString() || "",
          design: project.budgetBreakdown.design?.toString() || "",
          testing: project.budgetBreakdown.testing?.toString() || "",
          deployment: project.budgetBreakdown.deployment?.toString() || "",
          maintenance: project.budgetBreakdown.maintenance?.toString() || "",
          contingency: project.budgetBreakdown.contingency?.toString() || "",
        } : {
          development: "",
          design: "",
          testing: "",
          deployment: "",
          maintenance: "",
          contingency: "",
        },

        stakeholders: project.stakeholders ? {
          projectManager: project.stakeholders.projectManager || "",
          teamMembers: project.stakeholders.teamMembers || [],
          clientContacts: project.stakeholders.clientContacts || [],
          roles: project.stakeholders.roles || [],
        } : {
          projectManager: "",
          teamMembers: [],
          clientContacts: [],
          roles: [],
        },

        progress: project.progress ? {
          overallProgress: project.progress.overallProgress?.toString() || "",
          completedTasks: project.progress.completedTasks?.toString() || "",
          totalTasks: project.progress.totalTasks?.toString() || "",
          lastUpdated: project.progress.lastUpdated ? new Date(project.progress.lastUpdated).toISOString().split('T')[0] : "",
          nextMilestone: project.progress.nextMilestone || "",
          blockers: project.progress.blockers || "",
        } : {
          overallProgress: "",
          completedTasks: "",
          totalTasks: "",
          lastUpdated: "",
          nextMilestone: "",
          blockers: "",
        },

        resources: project.resources ? {
          estimatedHours: project.resources.estimatedHours?.toString() || "",
          actualHours: project.resources.actualHours?.toString() || "",
          teamSize: project.resources.teamSize?.toString() || "",
          tools: project.resources.tools || [],
          externalResources: project.resources.externalResources || [],
        } : {
          estimatedHours: "",
          actualHours: "",
          teamSize: "",
          tools: [],
          externalResources: [],
        },

        qualityMetrics: project.qualityMetrics ? {
          requirementsCoverage: project.qualityMetrics.requirementsCoverage?.toString() || "",
          defectDensity: project.qualityMetrics.defectDensity?.toString() || "",
          customerSatisfaction: project.qualityMetrics.customerSatisfaction?.toString() || "",
          onTimeDelivery: project.qualityMetrics.onTimeDelivery || false,
          withinBudget: project.qualityMetrics.withinBudget || false,
        } : {
          requirementsCoverage: "",
          defectDensity: "",
          customerSatisfaction: "",
          onTimeDelivery: false,
          withinBudget: false,
        },
      });
    }
  }, [project, form]);

  const handleSubmit = async (data: UpdateProjectFormData) => {
    setLoading(true);
    try {
      // Validate that at least one field is provided for update
      const hasData = Object.entries(data).some(([key, value]) => {
        if (value === null || value === undefined || value === '') return false;
        if (typeof value === 'object' && !Array.isArray(value)) {
          return Object.values(value).some(v => v !== null && v !== undefined && v !== '');
        }
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        return true;
      });

      if (!hasData) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Please modify at least one field before submitting",
        });
        return;
      }

      // Filter out fields that are not part of the form schema (handled in dedicated tabs)
      const { deliverables, ...filteredData } = data as any;
      
      // Use the existing project update hook following the same pattern as other CRUD operations
      await updateProject(project._id, filteredData);

      toast({
        title: "Success",
        description: "Project updated successfully",
      });

      // Reset form to mark as pristine after successful update
      form.reset(data);
      onProjectUpdate?.();
    } catch (error: any) {
      console.error('Error updating project:', error);
      
      // Handle validation errors specifically
      if (error.message.includes('validation') || error.message.includes('required')) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: error.message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to update project",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Form fields configuration (excluding phases and milestones)
  const formFields: SubFormConfig[] = [
    {
      subform_title: "Basic Information",
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
          lgCols: 3,
        },
        {
          name: "status",
          label: "Status",
          type: "select" as const,
          searchable: true,
          options: [
            { value: "pending", label: "Pending" },
            { value: "active", label: "Active" },
            { value: "completed", label: "Completed" },
            { value: "approved", label: "Approved" },
            { value: "inactive", label: "Inactive" },
          ],
          description: "Current project status",
          defaultValue: "pending",
          cols: 12,
          mdCols: 6,
          lgCols: 3,
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
          defaultValue: "medium",
          description: "Project priority level",
          cols: 12,
          mdCols: 6,
          lgCols: 3,
        },
        {
          name: "projectType",
          label: "Project Type",
          type: "text" as const,
          placeholder: "e.g., Web Development, Mobile App, etc.",
          description: "The type or category of project",
          cols: 12,
          mdCols: 6,
          lgCols: 3,
        },
        {
          name: "description",
          label: "Description",
          type: "textarea" as const,
          placeholder: "Describe the project objectives and scope",
          description: "Detailed project description",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        {
          name: "requirements",
          label: "Requirements",
          type: "textarea" as const,
          placeholder: "List project requirements and specifications",
          description: "Detailed project requirements",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
      ]
    },
    {
      subform_title: "Project Details",
      collapse: true,
      defaultOpen: false,
      fields: [
        {
          name: "clientId",
          label: "Client",
          type: "select" as const,
          searchable: true,
          options: clients?.filter(client => client._id).map(client => ({
            value: client._id as string,
            label: `${client.name}${client.company ? ` (${client.company})` : ''}`
          })) || [],
          placeholder: "Select a client",
          required: true,
          description: "The client for this project",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        // {
        //   name: "departmentIds",
        //   label: "Departments",
        //   type: "multi-select" as const,
        //   options: departments?.filter(dept => dept._id).map(dept => ({
        //     value: dept._id as string,
        //     label: dept.name
        //   })) || [],
        //   placeholder: "Select departments",
        //   description: "Departments involved in this project",
        //   cols: 12,
        //   mdCols: 6,
        //   lgCols: 4,
        // },
        {
          name: "timeline",
          label: "Timeline",
          type: "text" as const,
          placeholder: "Expected project duration (e.g., 3-6 months)",
          description: "Expected timeline or duration",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
      ]
    },
    {
      subform_title: "Budget & Dates",
      collapse: true,
      defaultOpen: false,
      fields: [
        {
          name: "budget",
          label: "Total Budget",
          type: "number" as const,
          placeholder: "Enter total budget",
          description: "Total project budget",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "startDate",
          label: "Start Date",
          type: "date" as const,
          description: "Project start date",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "endDate",
          label: "End Date",
          type: "date" as const,
          description: "Project end date",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
      ]
    },
    {
      subform_title: "Budget Breakdown",
      collapse: true,
      defaultOpen: false,
      fields: [
        {
          name: "budgetBreakdown.development",
          label: "Development Costs",
          type: "number" as const,
          placeholder: "Development costs",
          description: "Estimated development costs",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "budgetBreakdown.design",
          label: "Design Costs",
          type: "number" as const,
          placeholder: "Design costs",
          description: "Estimated design costs",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "budgetBreakdown.testing",
          label: "Testing Costs",
          type: "number" as const,
          placeholder: "Testing costs",
          description: "Estimated testing costs",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "budgetBreakdown.deployment",
          label: "Deployment Costs",
          type: "number" as const,
          placeholder: "Deployment costs",
          description: "Estimated deployment costs",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "budgetBreakdown.maintenance",
          label: "Maintenance Costs",
          type: "number" as const,
          placeholder: "Maintenance costs",
          description: "Estimated maintenance costs",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "budgetBreakdown.contingency",
          label: "Contingency",
          type: "number" as const,
          placeholder: "Contingency budget",
          description: "Contingency budget for unexpected costs",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
      ]
    },
    {
      subform_title: "Stakeholders",
      collapse: true,
      defaultOpen: false,
      fields: [
        {
          name: "stakeholders.projectManager",
          label: "Project Manager",
          type: "select" as const,
          searchable: true,
          options: users?.filter(user => user._id).map(user => ({
            value: user._id as string,
            label: user.name
          })) || [],
          placeholder: "Select project manager",
          description: "Assigned project manager",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        {
          name: "stakeholders.teamMembers",
          label: "Team Members",
          type: "multi-select" as const,
          options: users?.filter(user => user._id).map(user => ({
            value: user._id as string,
            label: user.name
          })) || [],
          placeholder: "Select team members",
          description: "Project team members",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        {
          name: "stakeholders.clientContacts",
          label: "Client Contacts",
          type: "multi-select" as const,
          options: clients?.filter(client => client._id).map(client => ({
            value: client._id as string,
            label: client.name
          })) || [],
          placeholder: "Select client contacts",
          description: "Main client contacts",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
      ]
    },
    {
      subform_title: "Resources",
      collapse: true,
      defaultOpen: false,
      fields: [
        {
          name: "resources.estimatedHours",
          label: "Estimated Hours",
          type: "number" as const,
          placeholder: "Total estimated hours",
          description: "Total estimated hours for the project",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "resources.actualHours",
          label: "Actual Hours",
          type: "number" as const,
          placeholder: "Actual hours spent",
          description: "Actual hours spent so far",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "resources.teamSize",
          label: "Team Size",
          type: "number" as const,
          placeholder: "Number of team members",
          description: "Size of the project team",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
      ]
    },
    {
      subform_title: "Progress Tracking",
      collapse: true,
      defaultOpen: false,
      fields: [
        {
          name: "progress.overallProgress",
          label: "Overall Progress (%)",
          type: "number" as const,
          placeholder: "0-100",
          description: "Overall project completion percentage",
          cols: 12,
          mdCols: 6,
          lgCols: 3,
        },
        {
          name: "progress.completedTasks",
          label: "Completed Tasks",
          type: "number" as const,
          placeholder: "Number of completed tasks",
          description: "Total completed tasks",
          cols: 12,
          mdCols: 6,
          lgCols: 3,
        },
        {
          name: "progress.totalTasks",
          label: "Total Tasks",
          type: "number" as const,
          placeholder: "Total number of tasks",
          description: "Total number of project tasks",
          cols: 12,
          mdCols: 6,
          lgCols: 3,
        },
        {
          name: "progress.lastUpdated",
          label: "Last Updated",
          type: "date" as const,
          description: "When progress was last updated",
          cols: 12,
          mdCols: 6,
          lgCols: 3,
        },
        {
          name: "progress.nextMilestone",
          label: "Next Milestone",
          type: "text" as const,
          placeholder: "Upcoming milestone",
          description: "Next major milestone or deadline",
          cols: 12,
          mdCols: 6,
          lgCols: 3,
        },
        {
          name: "progress.blockers",
          label: "Current Blockers",
          type: "textarea" as const,
          placeholder: "Any current blockers or issues",
          description: "Current blockers preventing progress",
          cols: 12,
          mdCols: 6,
          lgCols: 12,
        },
      ]
    },
    {
      subform_title: "Quality Metrics",
      collapse: true,
      defaultOpen: false,
      fields: [
        {
          name: "qualityMetrics.requirementsCoverage",
          label: "Requirements Coverage (%)",
          type: "number" as const,
          placeholder: "0-100",
          description: "Percentage of requirements covered",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "qualityMetrics.defectDensity",
          label: "Defect Density",
          type: "number" as const,
          placeholder: "Defects per unit",
          description: "Number of defects per unit of work",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "qualityMetrics.customerSatisfaction",
          label: "Customer Satisfaction",
          type: "number" as const,
          placeholder: "1-10 rating",
          description: "Customer satisfaction rating",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "qualityMetrics.onTimeDelivery",
          label: "On Time Delivery",
          type: "checkbox" as const,
          description: "Project delivered on time",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        {
          name: "qualityMetrics.withinBudget",
          label: "Within Budget",
          type: "checkbox" as const,
          description: "Project delivered within budget",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
      ]
    }
  ];


  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Save className="h-5 w-5" />
                Edit Project
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Update project information (phases and milestones managed separately)
              </p>
            </div>
            <Badge variant="outline">
              {project?.status || 'pending'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            
            <GenericForm
              form={form}
              onSubmit={handleSubmit}
              fields={formFields}
              loading={loading || actionLoading}
              submitText={loading || actionLoading ? "Updating..." : "Update Project"}
              showCancel={false}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}