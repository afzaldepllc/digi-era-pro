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
      clientId: "",
      requirements: "",
      projectType: "",
      timeline: "",
      budget: "",
      startDate: "",
      endDate: "",
      status: "pending",
      priority: "medium",
      departmentIds: [],

      // Enhanced professional CRM fields
      budgetBreakdown: {
        labor: "",
        materials: "",
        equipment: "",
        contingency: "",
        profitMargin: "",
      },

      stakeholders: {
        clientContact: "",
        projectManager: "",
        teamLead: "",
        keyStakeholders: "",
      },

      milestones: [],
      phases: [],
      deliverables: "",

      risks: [],

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
          labor: project.budgetBreakdown.labor?.toString() || "",
          materials: project.budgetBreakdown.materials?.toString() || "",
          equipment: project.budgetBreakdown.equipment?.toString() || "",
          contingency: project.budgetBreakdown.contingency?.toString() || "",
          profitMargin: project.budgetBreakdown.profitMargin?.toString() || "",
        } : {
          labor: "",
          materials: "",
          equipment: "",
          contingency: "",
          profitMargin: "",
        },

        stakeholders: project.stakeholders ? {
          clientContact: project.stakeholders.clientContact || "",
          projectManager: project.stakeholders.projectManager || "",
          teamLead: project.stakeholders.teamLead || "",
          keyStakeholders: project.stakeholders.keyStakeholders || "",
        } : {
          clientContact: "",
          projectManager: "",
          teamLead: "",
          keyStakeholders: "",
        },

        milestones: project.milestones?.map(milestone => ({
          title: milestone.title,
          description: milestone.description || "",
          dueDate: milestone.dueDate ? new Date(milestone.dueDate).toISOString().split('T')[0] : "",
          status: milestone.status,
        })) || [],

        phases: project.phases?.map(phase => ({
          name: phase.name,
          description: phase.description || "",
          startDate: phase.startDate ? new Date(phase.startDate).toISOString().split('T')[0] : "",
          endDate: phase.endDate ? new Date(phase.endDate).toISOString().split('T')[0] : "",
          status: phase.status,
        })) || [],

        deliverables: project.deliverables || "",

        risks: project.risks?.map(risk => ({
          description: risk.description,
          impact: risk.impact,
          probability: risk.probability,
          mitigation: risk.mitigation || "",
        })) || [],

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
      // Convert form data to API format
      const updateData = {
        ...data,
        budget: data.budget ? parseFloat(data.budget) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,

        // Transform professional CRM fields
        budgetBreakdown: data.budgetBreakdown ? {
          labor: data.budgetBreakdown.labor ? parseFloat(data.budgetBreakdown.labor) : undefined,
          materials: data.budgetBreakdown.materials ? parseFloat(data.budgetBreakdown.materials) : undefined,
          equipment: data.budgetBreakdown.equipment ? parseFloat(data.budgetBreakdown.equipment) : undefined,
          contingency: data.budgetBreakdown.contingency ? parseFloat(data.budgetBreakdown.contingency) : undefined,
          profitMargin: data.budgetBreakdown.profitMargin ? parseFloat(data.budgetBreakdown.profitMargin) : undefined,
        } : undefined,

        milestones: data.milestones?.map(milestone => ({
          title: milestone.title,
          description: milestone.description,
          dueDate: milestone.dueDate ? new Date(milestone.dueDate) : undefined,
          status: milestone.status,
        })),

        phases: data.phases?.map(phase => ({
          name: phase.name,
          description: phase.description,
          startDate: phase.startDate ? new Date(phase.startDate) : undefined,
          endDate: phase.endDate ? new Date(phase.endDate) : undefined,
          status: phase.status,
        })),

        risks: data.risks?.map(risk => ({
          description: risk.description,
          impact: risk.impact,
          probability: risk.probability,
          mitigation: risk.mitigation,
        })),

        progress: data.progress ? {
          overallProgress: data.progress.overallProgress ? parseFloat(data.progress.overallProgress) : undefined,
          completedTasks: data.progress.completedTasks ? parseInt(data.progress.completedTasks) : undefined,
          totalTasks: data.progress.totalTasks ? parseInt(data.progress.totalTasks) : undefined,
          lastUpdated: data.progress.lastUpdated ? new Date(data.progress.lastUpdated) : undefined,
          nextMilestone: data.progress.nextMilestone,
          blockers: data.progress.blockers,
        } : undefined,

        resources: data.resources ? {
          estimatedHours: data.resources.estimatedHours ? parseFloat(data.resources.estimatedHours) : undefined,
          actualHours: data.resources.actualHours ? parseFloat(data.resources.actualHours) : undefined,
          teamSize: data.resources.teamSize ? parseInt(data.resources.teamSize) : undefined,
          tools: data.resources.tools,
          externalResources: data.resources.externalResources,
        } : undefined,

        qualityMetrics: data.qualityMetrics ? {
          requirementsCoverage: data.qualityMetrics.requirementsCoverage ? parseFloat(data.qualityMetrics.requirementsCoverage) : undefined,
          defectDensity: data.qualityMetrics.defectDensity ? parseFloat(data.qualityMetrics.defectDensity) : undefined,
          customerSatisfaction: data.qualityMetrics.customerSatisfaction ? parseFloat(data.qualityMetrics.customerSatisfaction) : undefined,
          onTimeDelivery: data.qualityMetrics.onTimeDelivery,
          withinBudget: data.qualityMetrics.withinBudget,
        } : undefined,
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
          lgCols: 4,
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
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "projectType",
          label: "Project Type",
          type: "text" as const,
          placeholder: "e.g., Web Development, Mobile App, etc.",
          description: "The type or category of project",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
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
        {
          name: "timeline",
          label: "Timeline",
          type: "text" as const,
          placeholder: "Expected project duration (e.g., 3-6 months)",
          description: "Estimated project timeline",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
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
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "startDate",
          label: "Start Date",
          type: "date" as const,
          description: "Planned project start date",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        {
          name: "endDate",
          label: "End Date",
          type: "date" as const,
          description: "Planned project end date",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
      ]
    },
    {
      subform_title: "Budget & Financials",
      fields: [
        {
          name: "budget",
          label: "Total Budget",
          type: "text" as const,
          placeholder: "Enter total budget amount",
          description: "Total project budget (numbers only)",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "budgetBreakdown.labor",
          label: "Labor Costs",
          type: "text" as const,
          placeholder: "Labor budget allocation",
          description: "Budget allocated for labor costs",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "budgetBreakdown.materials",
          label: "Materials Costs",
          type: "text" as const,
          placeholder: "Materials budget allocation",
          description: "Budget allocated for materials and supplies",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "budgetBreakdown.equipment",
          label: "Equipment Costs",
          type: "text" as const,
          placeholder: "Equipment budget allocation",
          description: "Budget allocated for equipment and tools",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "budgetBreakdown.contingency",
          label: "Contingency Budget",
          type: "text" as const,
          placeholder: "Contingency budget allocation",
          description: "Budget allocated for unexpected expenses",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "budgetBreakdown.profitMargin",
          label: "Profit Margin (%)",
          type: "text" as const,
          placeholder: "Expected profit margin",
          description: "Expected profit margin percentage",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
      ]
    },
    {
      subform_title: "Stakeholders & Team",
      fields: [
        {
          name: "stakeholders.clientContact",
          label: "Client Contact",
          type: "text" as const,
          placeholder: "Primary client contact person",
          description: "Main point of contact from the client side",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "stakeholders.projectManager",
          label: "Project Manager",
          type: "text" as const,
          placeholder: "Project manager name",
          description: "Person responsible for project management",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "stakeholders.teamLead",
          label: "Team Lead",
          type: "text" as const,
          placeholder: "Technical team lead",
          description: "Technical lead for the project team",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "stakeholders.keyStakeholders",
          label: "Key Stakeholders",
          type: "textarea" as const,
          placeholder: "List other key stakeholders",
          description: "Other important stakeholders involved in the project",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
      ]
    },
    {
      subform_title: "Timeline & Milestones",
      fields: [
        {
          name: "milestones[0].title",
          label: "Milestone 1 - Title",
          type: "text" as const,
          placeholder: "First milestone title",
          description: "Title of the first major milestone",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "milestones[0].description",
          label: "Milestone 1 - Description",
          type: "textarea" as const,
          placeholder: "Description of first milestone",
          description: "Detailed description of the first milestone",
          cols: 12,
          mdCols: 6,
          lgCols: 8,
        },
        {
          name: "milestones[0].dueDate",
          label: "Milestone 1 - Due Date",
          type: "date" as const,
          description: "Due date for the first milestone",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "milestones[0].status",
          label: "Milestone 1 - Status",
          type: "select" as const,
          options: [
            { value: "pending", label: "Pending" },
            { value: "in-progress", label: "In Progress" },
            { value: "completed", label: "Completed" },
            { value: "delayed", label: "Delayed" },
          ],
          description: "Current status of the first milestone",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "milestones[1].title",
          label: "Milestone 2 - Title",
          type: "text" as const,
          placeholder: "Second milestone title",
          description: "Title of the second major milestone",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "milestones[1].description",
          label: "Milestone 2 - Description",
          type: "textarea" as const,
          placeholder: "Description of second milestone",
          description: "Detailed description of the second milestone",
          cols: 12,
          mdCols: 6,
          lgCols: 8,
        },
        {
          name: "milestones[1].dueDate",
          label: "Milestone 2 - Due Date",
          type: "date" as const,
          description: "Due date for the second milestone",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "milestones[1].status",
          label: "Milestone 2 - Status",
          type: "select" as const,
          options: [
            { value: "pending", label: "Pending" },
            { value: "in-progress", label: "In Progress" },
            { value: "completed", label: "Completed" },
            { value: "delayed", label: "Delayed" },
          ],
          description: "Current status of the second milestone",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
      ]
    },
    {
      subform_title: "Deliverables & Phases",
      fields: [
        {
          name: "phases[0].name",
          label: "Phase 1 - Name",
          type: "text" as const,
          placeholder: "First phase name",
          description: "Name of the first project phase",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "phases[0].description",
          label: "Phase 1 - Description",
          type: "textarea" as const,
          placeholder: "Description of first phase",
          description: "Detailed description of the first phase",
          cols: 12,
          mdCols: 6,
          lgCols: 8,
        },
        {
          name: "phases[0].startDate",
          label: "Phase 1 - Start Date",
          type: "date" as const,
          description: "Start date for the first phase",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        {
          name: "phases[0].endDate",
          label: "Phase 1 - End Date",
          type: "date" as const,
          description: "End date for the first phase",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        {
          name: "phases[0].status",
          label: "Phase 1 - Status",
          type: "select" as const,
          options: [
            { value: "not-started", label: "Not Started" },
            { value: "in-progress", label: "In Progress" },
            { value: "completed", label: "Completed" },
            { value: "on-hold", label: "On Hold" },
          ],
          description: "Current status of the first phase",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "deliverables",
          label: "Key Deliverables",
          type: "textarea" as const,
          placeholder: "List key deliverables for this project",
          description: "Major deliverables expected from this project",
          cols: 12,
          mdCols: 12,
          lgCols: 12,
        },
      ]
    },
    {
      subform_title: "Risk Management",
      fields: [
        {
          name: "risks[0].description",
          label: "Risk 1 - Description",
          type: "textarea" as const,
          placeholder: "Description of potential risk",
          description: "Description of the first potential risk",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        {
          name: "risks[0].impact",
          label: "Risk 1 - Impact",
          type: "select" as const,
          options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "critical", label: "Critical" },
          ],
          description: "Potential impact level of the first risk",
          cols: 12,
          mdCols: 6,
          lgCols: 3,
        },
        {
          name: "risks[0].probability",
          label: "Risk 1 - Probability",
          type: "select" as const,
          options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ],
          description: "Likelihood of the first risk occurring",
          cols: 12,
          mdCols: 6,
          lgCols: 3,
        },
        {
          name: "risks[0].mitigation",
          label: "Risk 1 - Mitigation Plan",
          type: "textarea" as const,
          placeholder: "Plan to mitigate this risk",
          description: "Strategy to reduce or eliminate the first risk",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        {
          name: "risks[1].description",
          label: "Risk 2 - Description",
          type: "textarea" as const,
          placeholder: "Description of second potential risk",
          description: "Description of the second potential risk",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        {
          name: "risks[1].impact",
          label: "Risk 2 - Impact",
          type: "select" as const,
          options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "critical", label: "Critical" },
          ],
          description: "Potential impact level of the second risk",
          cols: 12,
          mdCols: 6,
          lgCols: 3,
        },
        {
          name: "risks[1].probability",
          label: "Risk 2 - Probability",
          type: "select" as const,
          options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ],
          description: "Likelihood of the second risk occurring",
          cols: 12,
          mdCols: 6,
          lgCols: 3,
        },
        {
          name: "risks[1].mitigation",
          label: "Risk 2 - Mitigation Plan",
          type: "textarea" as const,
          placeholder: "Plan to mitigate this risk",
          description: "Strategy to reduce or eliminate the second risk",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
      ]
    },
    {
      subform_title: "Progress Tracking",
      fields: [
        {
          name: "progress.overallProgress",
          label: "Overall Progress (%)",
          type: "text" as const,
          placeholder: "0-100",
          description: "Current overall project progress percentage",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "progress.completedTasks",
          label: "Completed Tasks",
          type: "text" as const,
          placeholder: "Number of completed tasks",
          description: "Number of tasks completed so far",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "progress.totalTasks",
          label: "Total Tasks",
          type: "text" as const,
          placeholder: "Total number of tasks",
          description: "Total number of tasks in the project",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "progress.lastUpdated",
          label: "Last Progress Update",
          type: "date" as const,
          description: "Date when progress was last updated",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "progress.nextMilestone",
          label: "Next Milestone",
          type: "text" as const,
          placeholder: "Next upcoming milestone",
          description: "The next major milestone to be achieved",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        {
          name: "progress.blockers",
          label: "Current Blockers",
          type: "textarea" as const,
          placeholder: "List any current blockers or issues",
          description: "Current issues or blockers affecting progress",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
      ]
    },
    {
      subform_title: "Resources & Quality",
      fields: [
        {
          name: "resources.estimatedHours",
          label: "Estimated Hours",
          type: "text" as const,
          placeholder: "Total estimated hours",
          description: "Total estimated hours for project completion",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "resources.actualHours",
          label: "Actual Hours",
          type: "text" as const,
          placeholder: "Hours worked so far",
          description: "Actual hours worked on the project",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "resources.teamSize",
          label: "Team Size",
          type: "text" as const,
          placeholder: "Number of team members",
          description: "Current number of team members assigned",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "resources.tools",
          label: "Tools & Technologies",
          type: "textarea" as const,
          placeholder: "List tools and technologies used",
          description: "Tools, software, and technologies used in the project",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        {
          name: "resources.externalResources",
          label: "External Resources",
          type: "textarea" as const,
          placeholder: "List external resources or vendors",
          description: "External resources, vendors, or subcontractors",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        {
          name: "qualityMetrics.requirementsCoverage",
          label: "Requirements Coverage (%)",
          type: "text" as const,
          placeholder: "0-100",
          description: "Percentage of requirements covered",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "qualityMetrics.defectDensity",
          label: "Defect Density",
          type: "text" as const,
          placeholder: "Defects per unit",
          description: "Number of defects per unit of work",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "qualityMetrics.customerSatisfaction",
          label: "Customer Satisfaction (%)",
          type: "text" as const,
          placeholder: "0-100",
          description: "Current customer satisfaction rating",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "qualityMetrics.onTimeDelivery",
          label: "On-Time Delivery",
          type: "checkbox" as const,
          description: "Whether the project is on track for on-time delivery",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        {
          name: "qualityMetrics.withinBudget",
          label: "Within Budget",
          type: "checkbox" as const,
          description: "Whether the project is within the allocated budget",
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
      ]
    },
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