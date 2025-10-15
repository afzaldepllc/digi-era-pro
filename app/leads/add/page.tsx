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
      name: "",
      email: "",
      phone: "",
      company: "",
      projectName: "",
      projectDescription: "",
      projectBudget: "",
      projectTimeline: "",
      projectRequirements: [],
      status: "active",
      source: "website",
      priority: "medium",
      notes: "",
      nextFollowUpDate: "",
      tags: [],
    },
  });

  const handleSubmit = async (data: CreateLeadFormData) => {
    setLoading(true);
    try {
      // Transform form data to API format
      const cleanedData = {
        ...data,
        phone: data.phone?.trim() || undefined,
        company: data.company?.trim() || undefined,
        projectDescription: data.projectDescription?.trim() || undefined,
        projectTimeline: data.projectTimeline?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
        projectBudget: data.projectBudget ? Number(data.projectBudget) : undefined,
        projectRequirements: data.projectRequirements?.filter(req => req.trim().length > 0),
        tags: data.tags?.filter(tag => tag.trim().length > 0),
        nextFollowUpDate: data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : undefined,
        status: data.status || "active", // Ensure status is always set
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
          name: "company",
          label: "Company Name",
          type: "text" as const,
          placeholder: "Enter company name",
          description: "Company or organization name",
          cols: 12,
          mdCols: 6,
        },
        {
          name: "projectName",
          label: "Project Name",
          type: "text" as const,
          required: true,
          placeholder: "Enter project name",
          description: "Name or title of the proposed project",
          cols: 12,
          mdCols: 8,
        },
        {
          name: "projectBudget",
          label: "Budget (USD)",
          type: "number" as const,
          placeholder: "50000",
          description: "Estimated project budget in USD",
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
          name: "projectTimeline",
          label: "Timeline",
          type: "text" as const,
          placeholder: "3-6 months",
          description: "Expected project duration or timeline",
          cols: 12,
          mdCols: 6,
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