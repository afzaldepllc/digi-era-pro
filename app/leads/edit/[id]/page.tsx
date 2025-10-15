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
        company: selectedLead.company || "",
        projectName: selectedLead.projectName,
        projectDescription: selectedLead.projectDescription || "",
        projectBudget: selectedLead.projectBudget ? String(selectedLead.projectBudget) : "",
        projectTimeline: selectedLead.projectTimeline || "",
        projectRequirements: selectedLead.projectRequirements || [],
        status: selectedLead.status,
        source: selectedLead.source,
        priority: selectedLead.priority,
        notes: selectedLead.notes || "",
        nextFollowUpDate: selectedLead.nextFollowUpDate ? new Date(selectedLead.nextFollowUpDate).toISOString().split('T')[0] : "",
        tags: selectedLead.tags || [],
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
        company: data.company?.trim() || undefined,
        projectDescription: data.projectDescription?.trim() || undefined,
        projectTimeline: data.projectTimeline?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
        projectBudget: data.projectBudget ? Number(data.projectBudget) : undefined,
        projectRequirements: data.projectRequirements?.filter(req => req.trim().length > 0),
        tags: data.tags?.filter(tag => tag.trim().length > 0),
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