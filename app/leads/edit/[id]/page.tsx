"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  fetchLeadById,
  updateLead,
  clearError,
  setSelectedLead
} from "@/store/slices/leadSlice";
import PageHeader from "@/components/ui/page-header";
import GenericForm from "@/components/ui/generic-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigationLoading } from "@/hooks/use-navigation-loading";
import { usePermissions } from "@/hooks/use-permissions";
import Swal from 'sweetalert2';
import { updateLeadFormSchema } from '@/lib/validations/lead';
import type { UpdateLeadFormData } from '@/lib/validations/lead';

export default function EditLeadPage() {
  const router = useRouter();
  const params = useParams();
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const { canCreate } = usePermissions();
  const [loading, setLoading] = useState(false);

  const leadId = params?.id as string;

 

  // Redux state
  const {
    selectedLead,
    actionLoading,
    error
  } = useAppSelector((state) => state.leads);

  const form = useForm<UpdateLeadFormData>({
    resolver: zodResolver(updateLeadFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      position: "",
      company: "",
      website: "",
      industry: "",
      companySize: undefined,
      annualRevenue: "",
      employeeCount: "",
      status: "active",
      source: "website",
      priority: "medium",
      nextFollowUpDate: "",
      notes: "",
      projectName: "",
      projectType: undefined,
      complexity: undefined,
      projectBudget: "",
      estimatedHours: "",
      projectTimeline: "",
      projectDescription: "",
      technologies: "",
      projectRequirements: "",
      deliverables: "",
    },
  });

  // Load lead data
  useEffect(() => {
    if (leadId) {
      dispatch(fetchLeadById(leadId));
    }
  }, [dispatch, leadId]);

  // Populate form when lead data is loaded
  useEffect(() => {
    if (selectedLead) {
      form.reset({
        name: selectedLead.name,
        email: selectedLead.email,
        phone: selectedLead.phone || "",
        position: selectedLead.position || "",
        company: selectedLead.company || "",
        website: selectedLead.website || "",
        industry: selectedLead.industry || "",
        companySize: (selectedLead.companySize && ['startup', 'small', 'medium', 'large', 'enterprise'].includes(selectedLead.companySize)) ? selectedLead.companySize as any : undefined,
        annualRevenue: selectedLead.annualRevenue ? String(selectedLead.annualRevenue) : "",
        employeeCount: selectedLead.employeeCount ? String(selectedLead.employeeCount) : "",
        status: selectedLead.status,
        source: selectedLead.source,
        priority: selectedLead.priority,
        nextFollowUpDate: selectedLead.nextFollowUpDate ? new Date(selectedLead.nextFollowUpDate).toISOString().split('T')[0] : "",
        notes: selectedLead.notes || "",
        projectName: selectedLead.projectName,
        projectType: (selectedLead.projectType && ['web', 'mobile', 'desktop', 'api', 'consulting', 'other'].includes(selectedLead.projectType)) ? selectedLead.projectType as any : undefined,
        complexity: (selectedLead.complexity && ['simple', 'medium', 'complex'].includes(selectedLead.complexity)) ? selectedLead.complexity as any : undefined,
        projectBudget: selectedLead.projectBudget ? String(selectedLead.projectBudget) : "",
        estimatedHours: selectedLead.estimatedHours ? String(selectedLead.estimatedHours) : "",
        projectTimeline: selectedLead.projectTimeline || "",
        projectDescription: selectedLead.projectDescription || "",
        technologies: selectedLead.technologies ? selectedLead.technologies.join(", ") : "",
        projectRequirements: selectedLead.projectRequirements ? selectedLead.projectRequirements.join(", ") : "",
      deliverables: selectedLead.deliverables ? selectedLead.deliverables.join(", ") : "",
      });
    }
  }, [selectedLead, form]);

  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
      dispatch(clearError());
    }
  }, [error, toast, dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispatch(setSelectedLead(null));
    };
  }, [dispatch]);

  const handleSubmit = async (data: UpdateLeadFormData) => {
    if (!selectedLead || !selectedLead._id) return;

    setLoading(true);
    try {
      console.log('Form data being sent:', data);

      // Transform form data to API format
      const cleanedData = {
        ...data,
        phone: data.phone?.trim() || undefined,
        position: data.position?.trim() || undefined,
        company: data.company?.trim() || undefined,
        website: data.website?.trim() || undefined,
        industry: data.industry?.trim() || undefined,
        annualRevenue: data.annualRevenue ? Number(data.annualRevenue) : undefined,
        employeeCount: data.employeeCount ? Number(data.employeeCount) : undefined,
        projectDescription: data.projectDescription?.trim() || undefined,
        projectTimeline: data.projectTimeline?.trim() || undefined,
        projectBudget: data.projectBudget ? Number(data.projectBudget) : undefined,
        estimatedHours: data.estimatedHours ? Number(data.estimatedHours) : undefined,
        technologies: data.technologies ? data.technologies.split(',').map(tech => tech.trim()).filter(tech => tech.length > 0) : undefined,
        projectRequirements: data.projectRequirements ? data.projectRequirements.split(',').map(req => req.trim()).filter(req => req.length > 0) : undefined,
        deliverables: data.deliverables ? data.deliverables.split(',').map(del => del.trim()).filter(del => del.length > 0) : undefined,
        notes: data.notes?.trim() || undefined,
        nextFollowUpDate: data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : undefined,
      };

      const result = await dispatch(
        updateLead({
          id: selectedLead._id!,
          data: cleanedData
        })
      ).unwrap();

      toast({
        title: "Success",
        description: "Lead updated successfully",
      });

      router.push("/leads");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error || "Failed to update lead",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const { isNavigating, handleNavigation } = useNavigationLoading();

  const handleCancel = () => {
    handleNavigation("/leads");
  };

  const handleCreateClient = async () => {
    if (!selectedLead) return;

    try {
      // Show confirmation dialog
      const result = await Swal.fire({
        title: 'Create Client from Lead',
        text: `Are you sure you want to create a client account for ${selectedLead.name}? This will qualify the lead and create a new client profile.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Create Client',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#3B82F6',
        cancelButtonColor: '#6B7280',
      });

      if (!result.isConfirmed) return;

      // Call API to create client from lead
      const response = await fetch(`/api/leads/${selectedLead._id}/create-client`, {
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
        description: `Client created successfully for ${selectedLead.name}`,
      });

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
  };

  const formFields = [
    {
      subform_title: "Client Information",
      fields: [
        {
          name: "name",
          label: "Contact Name",
          type: "text" as const,
          required: true,
          placeholder: "Enter contact name",
          description: "Full name of the primary contact",
          cols: 12,
          mdCols: 6,
        },
        {
          name: "email",
          label: "Email Address",
          type: "email" as const,
          required: true,
          placeholder: "contact@company.com",
          description: "Primary email address for communication",
          cols: 12,
          mdCols: 6,
        },
        {
          name: "phone",
          label: "Phone Number",
          type: "text" as const,
          placeholder: "+1 (555) 123-4567",
          description: "Phone number with country code",
          cols: 12,
          mdCols: 6,
        },
        {
          name: "position",
          label: "Job Title",
          type: "text" as const,
          placeholder: "CEO, CTO, Manager, etc.",
          description: "Contact's job title or position",
          cols: 12,
          mdCols: 6,
        },
        {
          name: "company",
          label: "Company Name",
          type: "text" as const,
          placeholder: "Enter company name",
          description: "Company or organization name",
          cols: 12,
          mdCols: 6,
        },
        {
          name: "website",
          label: "Company Website",
          type: "text" as const,
          placeholder: "https://www.company.com",
          description: "Company website URL",
          cols: 12,
          mdCols: 6,
        },
        {
          name: "industry",
          label: "Industry",
          type: "text" as const,
          placeholder: "Technology, Healthcare, Finance, etc.",
          description: "Industry or sector the company operates in",
          cols: 12,
          mdCols: 4,
        },
        {
          name: "companySize",
          label: "Company Size",
          type: "select" as const,
          options: [
            { value: "startup", label: "Startup (1-10 employees)" },
            { value: "small", label: "Small (11-50 employees)" },
            { value: "medium", label: "Medium (51-200 employees)" },
            { value: "large", label: "Large (201-1000 employees)" },
            { value: "enterprise", label: "Enterprise (1000+ employees)" },
          ],
          description: "Approximate company size",
          cols: 12,
          mdCols: 4,
        },
        {
          name: "annualRevenue",
          label: "Annual Revenue",
          type: "text" as const,
          placeholder: "5000000",
          description: "Annual revenue in USD (optional)",
          cols: 12,
          mdCols: 4,
        },
        {
          name: "employeeCount",
          label: "Employee Count",
          type: "text" as const,
          placeholder: "50",
          description: "Number of employees in the company",
          cols: 12,
          mdCols: 4,
        },
        {
          name: "status",
          label: "Status",
          type: "select" as const,
          required: true,
          options: [
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
            { value: "qualified", label: "Qualified" },
            { value: "unqualified", label: "Unqualified" },
          ],
          cols: 12,
          mdCols: 3,
        },
        {
          name: "source",
          label: "Lead Source",
          type: "select" as const,
          required: true,
          options: [
            { value: "website", label: "Website" },
            { value: "referral", label: "Referral" },
            { value: "cold_call", label: "Cold Call" },
            { value: "email", label: "Email Marketing" },
            { value: "social_media", label: "Social Media" },
            { value: "event", label: "Event/Conference" },
            { value: "partner", label: "Partner" },
            { value: "advertising", label: "Advertising" },
            { value: "other", label: "Other" },
          ],
          cols: 12,
          mdCols: 3,
        },
        {
          name: "priority",
          label: "Priority",
          type: "select" as const,
          required: true,
          options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "urgent", label: "Urgent" },
          ],
          cols: 12,
          mdCols: 3,
        },
        {
          name: "nextFollowUpDate",
          label: "Next Follow-up",
          type: "date" as const,
          description: "Schedule next follow-up date",
          cols: 12,
          mdCols: 3,
        },
        {
          name: "notes",
          label: "Notes",
          type: "textarea" as const,
          placeholder: "Add any additional notes about this lead...",
          description: "Internal notes about the lead",
          cols: 12,
          rows: 3,
        },
      ]
    },
    {
      subform_title: "Project Information",
      fields: [
        {
          name: "projectName",
          label: "Project Name",
          type: "text" as const,
          required: true,
          placeholder: "Enter project name",
          description: "Name or title of the proposed project",
          cols: 12,
          mdCols: 6,
        },
        {
          name: "projectType",
          label: "Project Type",
          type: "select" as const,
          options: [
            { value: "web", label: "Web Development" },
            { value: "mobile", label: "Mobile App" },
            { value: "desktop", label: "Desktop Software" },
            { value: "api", label: "API Development" },
            { value: "consulting", label: "Consulting" },
            { value: "other", label: "Other" },
          ],
          description: "Type of project",
          cols: 12,
          mdCols: 3,
        },
        {
          name: "complexity",
          label: "Complexity",
          type: "select" as const,
          options: [
            { value: "simple", label: "Simple" },
            { value: "medium", label: "Medium" },
            { value: "complex", label: "Complex" },
          ],
          description: "Project complexity level",
          cols: 12,
          mdCols: 3,
        },
        {
          name: "projectBudget",
          label: "Budget (USD)",
          type: "text" as const,
          placeholder: "50000",
          description: "Estimated project budget in USD",
          cols: 12,
          mdCols: 4,
        },
        {
          name: "estimatedHours",
          label: "Estimated Hours",
          type: "text" as const,
          placeholder: "160",
          description: "Estimated total hours for the project",
          cols: 12,
          mdCols: 4,
        },
        {
          name: "projectTimeline",
          label: "Timeline",
          type: "text" as const,
          placeholder: "3-6 months",
          description: "Expected project duration or timeline",
          cols: 12,
          mdCols: 4,
        },
        {
          name: "projectDescription",
          label: "Project Description",
          type: "textarea" as const,
          placeholder: "Describe the project requirements and goals...",
          description: "Detailed description of the project",
          cols: 12,
          rows: 4,
        },
        {
          name: "technologies",
          label: "Technologies",
          type: "text" as const,
          placeholder: "React, Node.js, MongoDB, etc.",
          description: "Comma-separated list of required technologies",
          cols: 12,
        },
        {
          name: "projectRequirements",
          label: "Key Requirements",
          type: "textarea" as const,
          placeholder: "List the main project requirements...",
          description: "Key requirements and features needed",
          cols: 12,
          rows: 3,
        },
        {
          name: "deliverables",
          label: "Expected Deliverables",
          type: "textarea" as const,
          placeholder: "Website, mobile app, documentation, etc.",
          description: "Expected deliverables from the project",
          cols: 12,
          rows: 3,
        },
      ]
    }
  ];

  // Show loading skeleton while fetching lead data
  if (actionLoading && !selectedLead) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Edit Lead"
          subtitle="Update lead information"
          showAddButton={false}
          actions={
            <Button variant="outline" disabled>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Leads
            </Button>
          }
        />

        <div className=" space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-48" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error if lead not found
  if (!actionLoading && !selectedLead) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Lead Not Found"
          subtitle="The requested lead could not be found"
          showAddButton={false}
          actions={
            <Button variant="outline" onClick={handleCancel}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Leads
            </Button>
          }
        />

        <div className="text-center py-12">
          <p className="text-muted-foreground">
            The lead you're looking for doesn't exist or has been deleted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Lead"
        subtitle={`Update information for "${selectedLead?.name}"`}
        showAddButton={false}
        actions={
          <div className="flex items-center gap-2">
            {/* Create Client button - only show if lead can be converted */}
            {selectedLead &&
              selectedLead.status === 'active' &&
              !selectedLead.clientId &&
              canCreate('clients') && (
                <Button
                  variant="default"
                  onClick={handleCreateClient}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Client
                </Button>
              )}

            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isNavigating || loading}
            >
              <ArrowLeft className={`h-4 w-4 mr-2 ${isNavigating ? 'animate-spin' : ''}`} />
              {isNavigating ? 'Going back...' : 'Back to Leads'}
            </Button>
          </div>
        }
      />

      <div>
        <GenericForm
          form={form}
          fields={formFields}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          loading={loading}
          submitText="Update Lead"
          cancelText="Cancel"
        />
      </div>
    </div>
  );
}