"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  fetchClientById,
  updateClient,
  clearError,
  setSelectedClient
} from "@/store/slices/clientSlice";
import PageHeader from "@/components/ui/page-header";
import GenericForm from "@/components/ui/generic-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FolderPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigationLoading } from "@/hooks/use-navigation-loading";
import { updateClientFormSchema, UpdateClientFormData } from '@/lib/validations/client';

export default function EditClientPage() {
  const router = useRouter();
  const params = useParams();
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const clientId = params?.id as string;

  
  // Redux state
  const {
    selectedClient,
    actionLoading,
    error
  } = useAppSelector((state) => state.clients);

  const form = useForm<UpdateClientFormData>({
    resolver: zodResolver(updateClientFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      position: "",
      company: "",
      industry: "",
      companySize: undefined,
      annualRevenue: "",
      employeeCount: "",
      clientStatus: "qualified",
      status: "active",
      projectInterests: "",
      address: {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "",
      },
      socialLinks: {
        linkedin: "",
        twitter: "",
        github: "",
      },
      preferences: {
        theme: "system",
        language: "en",
        timezone: "UTC",
        notifications: {
          email: true,
          push: true,
          sms: false,
        },
      },
      notes: "",
    },
  });

  // Load client data
  useEffect(() => {
    if (clientId) {
      dispatch(fetchClientById(clientId));
    }
  }, [dispatch, clientId]);

  // Populate form when client data is loaded
  useEffect(() => {
    if (selectedClient) {
      form.reset({
        name: selectedClient.name || "",
        phone: selectedClient.phone || "",
        position: selectedClient.position || "",
        company: selectedClient.company || "",
        industry: (selectedClient as any).industry || "",
        companySize: (selectedClient as any).companySize && ['startup', 'small', 'medium', 'large', 'enterprise'].includes((selectedClient as any).companySize) ? (selectedClient as any).companySize : "",
        annualRevenue: (selectedClient as any).annualRevenue || "",
        employeeCount: (selectedClient as any).employeeCount || "",
        clientStatus: selectedClient.clientStatus || "qualified",
        status: selectedClient.status || "active",
                projectInterests: selectedClient.projectInterests ? selectedClient.projectInterests.join(", ") : "",
        address: {
          street: selectedClient.address?.street || "",
          city: selectedClient.address?.city || "",
          state: selectedClient.address?.state || "",
          zipCode: selectedClient.address?.zipCode || "",
          country: selectedClient.address?.country || "",
        },
        socialLinks: {
          linkedin: selectedClient.socialLinks?.linkedin || "",
          twitter: selectedClient.socialLinks?.twitter || "",
          github: selectedClient.socialLinks?.github || "",
        },
        preferences: {
          theme: selectedClient.preferences?.theme || "system",
          language: selectedClient.preferences?.language || "en",
          timezone: selectedClient.preferences?.timezone || "UTC",
          notifications: {
            email: selectedClient.preferences?.notifications?.email ?? true,
            push: selectedClient.preferences?.notifications?.push ?? false,
            sms: selectedClient.preferences?.notifications?.sms ?? false,
          },
        },
        notes: (selectedClient as any).notes || "",
      });
    }
  }, [selectedClient, form]);

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
      dispatch(setSelectedClient(null));
    };
  }, [dispatch]);

  const handleSubmit = async (data: UpdateClientFormData) => {
    if (!selectedClient || !selectedClient._id) return;

    setLoading(true);
    try {
      console.log('Form data being sent:', data);

      // Clean up data
            const cleanedData = {
              ...data,
              phone: data.phone?.trim() || undefined,
              projectInterests: data.projectInterests ? data.projectInterests.split(',').map(interest => interest.trim()).filter(interest => interest.length > 0) : [],
              preferences: data.preferences ? {
                // ensure required preference fields are present with sensible defaults
                theme: data.preferences.theme ?? "system",
                language: data.preferences.language ?? "en",
                timezone: data.preferences.timezone ?? "UTC",
                notifications: {
                  email: data.preferences.notifications?.email ?? true,
                  push: data.preferences.notifications?.push ?? false,
                  sms: data.preferences.notifications?.sms ?? false,
                },
              } : undefined,
            };

      const result = await dispatch(
        updateClient({
          id: selectedClient._id!,
          data: cleanedData
        })
      ).unwrap();

      toast({
        title: "Success",
        description: "Client updated successfully",
      });

      router.push("/clients");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error || "Failed to update client",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const { isNavigating, handleNavigation } = useNavigationLoading();

  const handleCancel = () => {
    handleNavigation("/clients");
  };

  const formFields = [
    {
      subform_title: "Basic Information",
      fields: [
        {
          name: "name",
          label: "Client Name",
          type: "text" as const,
          required: true,
          placeholder: "Enter client name",
          description: "Full name of the client",
          cols: 12,
          mdCols: 6,
        },
        {
          name: "email",
          label: "Email Address",
          type: "email" as const,
          required: true,
          placeholder: "client@company.com",
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
          description: "Client's job title or position",
          cols: 12,
          mdCols: 6,
        },
      ]
    },
    {
      subform_title: "Company Information",
      fields: [
        {
          name: "company",
          label: "Company Name",
          type: "text" as const,
          required: true,
          placeholder: "Enter company name",
          description: "Company or organization name",
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
      subform_title: "Client Status",
      fields: [
        {
          name: "clientStatus",
          label: "Client Status",
          type: "select" as const,
          required: true,
          options: [
            { value: "qualified", label: "Qualified" },
            { value: "unqualified", label: "Unqualified" },
          ],
          description: "Client qualification status",
          cols: 12,
          mdCols: 6,
        },
        {
          name: "status",
          label: "Account Status",
          type: "select" as const,
          required: true,
          options: [
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
            { value: "qualified", label: "Qualified" },
            { value: "unqualified", label: "Unqualified" },
          ],
          description: "Account status",
          cols: 12,
          mdCols: 6,
        },
      ]
    },
    {
      subform_title: "Project Interests",
      fields: [
        {
          name: "projectInterests",
          label: "Project Interests",
          type: "textarea" as const,
          placeholder: "Web Development, Mobile Apps, Consulting, etc.",
          description: "Comma-separated list of project types the client is interested in",
          cols: 12,
          rows: 3,
        },
      ]
    },
    {
      subform_title: "Address Information",
      fields: [
        {
          name: "address.street",
          label: "Street Address",
          type: "text" as const,
          placeholder: "123 Main Street",
          description: "Street address",
          cols: 12,
          mdCols: 6,
        },
        {
          name: "address.city",
          label: "City",
          type: "text" as const,
          placeholder: "New York",
          description: "City",
          cols: 12,
          mdCols: 6,
        },
        {
          name: "address.state",
          label: "State/Province",
          type: "text" as const,
          placeholder: "NY",
          description: "State or province",
          cols: 12,
          mdCols: 4,
        },
        {
          name: "address.zipCode",
          label: "ZIP/Postal Code",
          type: "text" as const,
          placeholder: "10001",
          description: "ZIP or postal code",
          cols: 12,
          mdCols: 4,
        },
        {
          name: "address.country",
          label: "Country",
          type: "text" as const,
          placeholder: "United States",
          description: "Country",
          cols: 12,
          mdCols: 4,
        },
      ]
    },
    {
      subform_title: "Social Links",
      fields: [
        {
          name: "socialLinks.linkedin",
          label: "LinkedIn",
          type: "text" as const,
          placeholder: "https://linkedin.com/in/username",
          description: "LinkedIn profile URL",
          cols: 12,
          mdCols: 4,
        },
        {
          name: "socialLinks.twitter",
          label: "Twitter",
          type: "text" as const,
          placeholder: "https://twitter.com/username",
          description: "Twitter profile URL",
          cols: 12,
          mdCols: 4,
        },
        {
          name: "socialLinks.github",
          label: "GitHub",
          type: "text" as const,
          placeholder: "https://github.com/username",
          description: "GitHub profile URL",
          cols: 12,
          mdCols: 4,
        },
      ]
    },
    {
      subform_title: "Preferences",
      fields: [
        {
          name: "preferences.theme",
          label: "Theme",
          type: "select" as const,
          options: [
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ],
          description: "Preferred theme",
          cols: 12,
          mdCols: 4,
        },
        {
          name: "preferences.language",
          label: "Language",
          type: "text" as const,
          placeholder: "en",
          description: "Preferred language code",
          cols: 12,
          mdCols: 4,
        },
        {
          name: "preferences.timezone",
          label: "Timezone",
          type: "text" as const,
          placeholder: "UTC",
          description: "Preferred timezone",
          cols: 12,
          mdCols: 4,
        },
        {
          name: "preferences.notifications.email",
          label: "Email Notifications",
          type: "checkbox" as const,
          description: "Receive email notifications",
          cols: 12,
          mdCols: 4,
        },
        {
          name: "preferences.notifications.push",
          label: "Push Notifications",
          type: "checkbox" as const,
          description: "Receive push notifications",
          cols: 12,
          mdCols: 4,
        },
        {
          name: "preferences.notifications.sms",
          label: "SMS Notifications",
          type: "checkbox" as const,
          description: "Receive SMS notifications",
          cols: 12,
          mdCols: 4,
        },
      ]
    },
    {
      subform_title: "Additional Notes",
      fields: [
        {
          name: "notes",
          label: "Notes",
          type: "textarea" as const,
          placeholder: "Add any additional notes about this client...",
          description: "Internal notes about the client",
          cols: 12,
          rows: 3,
        },
      ]
    }
  ];

  // Show loading skeleton while fetching client data
  if (actionLoading && !selectedClient) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Edit Client"
          subtitle="Update client information"
          showAddButton={false}
          actions={
            <Button variant="outline" disabled>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Clients
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

  // Show error if client not found
  if (!actionLoading && !selectedClient) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Client Not Found"
          subtitle="The requested client could not be found"
          showAddButton={false}
          actions={
            <Button variant="outline" onClick={handleCancel}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Clients
            </Button>
          }
        />

        <div className="text-center py-12">
          <p className="text-muted-foreground">
            The client you're looking for doesn't exist or has been deleted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Client"
        subtitle={`Update information for "${selectedClient?.name}"`}
        showAddButton={false}
        actions={
          <div className="flex gap-2">
            {selectedClient?.status === 'qualified' && (
              <Button
                onClick={() => router.push(`/projects/add?clientId=${selectedClient._id}&prefill=true`)}
                disabled={loading}
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isNavigating || loading}
            >
              <ArrowLeft className={`h-4 w-4 mr-2 ${isNavigating ? 'animate-spin' : ''}`} />
              {isNavigating ? 'Going back...' : 'Back to Clients'}
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
          submitText="Update Client"
          cancelText="Cancel"
        />
      </div>
    </div>
  );
}