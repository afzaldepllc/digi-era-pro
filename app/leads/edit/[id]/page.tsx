"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLeads } from "@/hooks/use-leads";
import { useGenericQueryById } from "@/hooks/use-generic-query";
import PageHeader from "@/components/ui/page-header";
import GenericForm from "@/components/ui/generic-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import Swal from 'sweetalert2';
import { updateLeadFormSchema } from '@/lib/validations/lead';
import type { UpdateLeadFormData } from '@/lib/validations/lead';

export default function EditLeadPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const { canCreate } = usePermissions();
  const leadId = params?.id as string;

  // Generic options for leads
  const genericOptions = {
    entityName: 'leads',
    baseUrl: '/api/leads',
    reduxDispatchers: {
      setEntity: (lead: any) => { }, // Will be handled by the query
    },
  };

  // Fetch lead data
  const { data: lead, isLoading: leadLoading } = useGenericQueryById(genericOptions, leadId, !!leadId);

  const { updateLead, actionLoading } = useLeads();

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

  // Populate form when lead data is loaded
  useEffect(() => {
    if (lead) {
      form.reset({
        name: lead.name,
        email: lead.email,
        phone: lead.phone || "",
        position: lead.position || "",
        company: lead.company || "",
        website: lead.website || "",
        industry: lead.industry || "",
        companySize: (lead.companySize && ['startup', 'small', 'medium', 'large', 'enterprise'].includes(lead.companySize)) ? lead.companySize as any : undefined,
        annualRevenue: lead.annualRevenue ? String(lead.annualRevenue) : "",
        employeeCount: lead.employeeCount ? String(lead.employeeCount) : "",
        status: lead.status,
        source: lead.source,
        priority: lead.priority,
        nextFollowUpDate: lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate).toISOString().split('T')[0] : "",
        notes: lead.notes || "",
        projectName: lead.projectName,
        projectType: (lead.projectType && ['web', 'mobile', 'desktop', 'api', 'consulting', 'other'].includes(lead.projectType)) ? lead.projectType as any : undefined,
        complexity: (lead.complexity && ['simple', 'medium', 'complex'].includes(lead.complexity)) ? lead.complexity as any : undefined,
        projectBudget: lead.projectBudget ? String(lead.projectBudget) : "",
        estimatedHours: lead.estimatedHours ? String(lead.estimatedHours) : "",
        projectTimeline: lead.projectTimeline || "",
        projectDescription: lead.projectDescription || "",
        technologies: lead.technologies ? lead.technologies.join(", ") : "",
        projectRequirements: lead.projectRequirements ? lead.projectRequirements.join(", ") : "",
        deliverables: lead.deliverables ? lead.deliverables.join(", ") : "",
      });
    }
  }, [lead, form]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup if needed
    };
  }, []);

  const handleSubmit = async (data: UpdateLeadFormData) => {
    if (!lead || !lead._id) return;

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

      const result = await updateLead(leadId, cleanedData);

      toast({
        title: "Success",
        description: "Lead updated successfully",
      });

      router.push("/leads");
    } catch (error: any) {
      console.error('Update lead error:', error)

      // Handle structured API errors
      let errorMessage = "Failed to update lead"
      let errorDetails = ""

      if (error?.error) {
        errorMessage = error.error
        if (error.details && Array.isArray(error.details)) {
          errorDetails = error.details.join(', ')
        } else if (error.details) {
          errorDetails = typeof error.details === 'string' ? error.details : JSON.stringify(error.details)
        }
      } else if (error?.message) {
        errorMessage = error.message
      }

      toast({
        title: "Error",
        description: errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    router.push("/leads");
  };

  const handleCreateClient = async () => {
    if (!lead) return;

    try {
      // Show confirmation dialog
      const result = await Swal.fire({
       customClass: {
        popup: 'swal-bg',
        title: 'swal-title',
        htmlContainer: 'swal-content',
      },
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
      const response = await fetch(`/api/leads/${leadId}/create-client`, {
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
          mdCols: 12,
        },
      ]
    },
    {
      subform_title: "Company Information",
      collapse: true,
      defaultOpen: false,
      fields: [
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
          name: "position",
          label: "Job Title",
          type: "text" as const,
          placeholder: "CEO, CTO, Manager, etc.",
          description: "Contact's job title or position",
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
          mdCols: 6,
        },
        {
          name: "companySize",
          label: "Company Size",
          type: "select" as const,
          searchable: true,
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
      ]
    },
    {
      subform_title: "Source & Follow-up",
      collapse: true,
      defaultOpen: false,
      fields: [
        {
          name: "source",
          label: "Lead Source",
          type: "select" as const,
          searchable: true,
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
          name: "status",
          label: "Status",
          type: "select" as const,
          searchable: true,
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
          name: "priority",
          label: "Priority",
          type: "select" as const,
          searchable: true,
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
      collapse: true,
      defaultOpen: false,
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
          searchable: true,
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
          searchable: true,
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
  if (leadLoading && !lead) {
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
  if (!actionLoading && !lead) {
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
        subtitle={`Update information for "${lead?.name}"`}
        showAddButton={false}
        actions={
          <div className="flex items-center gap-2">
            {/* Create Client button - only show if lead can be converted */}
            {lead &&
              lead.status === 'active' &&
              !lead.clientId &&
              canCreate('clients') && (
                <Button
                  variant="default"
                  onClick={handleCreateClient}
                  disabled={actionLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Client
                </Button>
              )}

            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={actionLoading}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Leads
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
          loading={actionLoading}
          submitText="Update Lead"
          cancelText="Cancel"
        />
      </div>
    </div>
  );
}