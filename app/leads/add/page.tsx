"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppDispatch } from "@/hooks/redux";
import { createLead } from "@/store/slices/leadSlice";
import PageHeader from "@/components/ui/page-header";
import GenericForm from "@/components/ui/generic-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigationLoading } from "@/hooks/use-navigation-loading";
import { CreateLeadFormData, createLeadFormSchema } from '@/lib/validations/lead';
export default function AddLeadPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<CreateLeadFormData>({
    resolver: zodResolver(createLeadFormSchema),
    defaultValues: {
      // Client Information
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

      // Project Information
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

      // Arrays
      tags: [],
    },
  });

  const handleSubmit = async (data: CreateLeadFormData) => {
    setLoading(true);
    try {
      // Transform form data to API format
      const cleanedData = {
        ...data,
        // Client Information
        phone: data.phone?.trim() || undefined,
        position: data.position?.trim() || undefined,
        company: data.company?.trim() || undefined,
        website: data.website?.trim() || undefined,
        industry: data.industry?.trim() || undefined,
        companySize: data.companySize || undefined,
        annualRevenue: data.annualRevenue ? Number(data.annualRevenue) : undefined,
        employeeCount: data.employeeCount ? Number(data.employeeCount) : undefined,
        notes: data.notes?.trim() || undefined,
        nextFollowUpDate: data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : undefined,
        status: data.status || "active", // Ensure status is always set

        // Project Information
        projectName: data.projectName?.trim() || '',
        projectType: data.projectType || undefined,
        complexity: data.complexity || undefined,
        projectBudget: data.projectBudget ? Number(data.projectBudget) : undefined,
        estimatedHours: data.estimatedHours ? Number(data.estimatedHours) : undefined,
        projectTimeline: data.projectTimeline?.trim() || undefined,
        projectDescription: data.projectDescription?.trim() || undefined,
        technologies: data.technologies?.split(',').map(tech => tech.trim()).filter(tech => tech.length > 0) || [],
        projectRequirements: data.projectRequirements?.split(',').map(req => req.trim()).filter(req => req.length > 0) || [],
        deliverables: data.deliverables?.split(',').map(del => del.trim()).filter(del => del.length > 0) || [],

        // Arrays and other fields
        tags: data.tags?.filter(tag => tag.trim().length > 0) || [],
        milestones: data.milestones?.map(milestone => ({
          ...milestone,
          title: milestone.title?.trim() || '',
          description: milestone.description?.trim() || undefined,
          dueDate: milestone.dueDate ? new Date(milestone.dueDate) : undefined,
          completed: milestone.completed || false,
        })) || [],

        // Default values for required fields
        hotLead: false,
      };

      await dispatch(createLead(cleanedData)).unwrap();

      toast({
        title: "Success",
        description: "Lead created successfully",
      });

      router.push("/leads");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error || "Failed to create lead",
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add New Lead"
        subtitle="Create a new sales lead with client and project information"
        showAddButton={false}
        actions={
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isNavigating}
          >
            <ArrowLeft className={`h-4 w-4 mr-2 ${isNavigating ? 'animate-spin' : ''}`} />
            {isNavigating ? 'Going back...' : 'Back to Leads'}
          </Button>
        }
      />

      <div>
        <GenericForm
          form={form}
          fields={formFields}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          loading={loading}
          submitText="Create Lead"
          cancelText="Cancel"
        />
      </div>
    </div>
  );
}