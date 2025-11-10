"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useClients } from "@/hooks/use-clients";
import { useGenericQueryById } from "@/hooks/use-generic-query";
import PageHeader from "@/components/ui/page-header";
import GenericForm from "@/components/ui/generic-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FolderPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigationLoading } from "@/hooks/use-navigation-loading";
import { updateClientFormSchema, UpdateClientFormData, UpdateClientData } from '@/lib/validations/client';

export default function EditClientPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const clientId = params?.id as string;

  const { updateClient, actionLoading } = useClients();

  // Fetch client data using generic query
  const { data: client, isLoading: clientLoading } = useGenericQueryById({
    entityName: 'clients',
    baseUrl: '/api/clients',
    reduxDispatchers: {
      setEntity: (client) => {
        // Client data will be used directly from the query
      },
    },
  }, clientId);

  const form = useForm<UpdateClientFormData>({
    resolver: zodResolver(updateClientFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      position: "",
      company: "",
      industry: "",
      companySize: "",
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
          push: false,
          sms: false,
        },
      },
      notes: "",
    },
  });

  // Load client data - REMOVED: TanStack Query handles automatic fetching
  // useEffect(() => {
  //   if (clientId) {
  //     dispatch(fetchClientById(clientId));
  //   }
  // }, [dispatch, clientId]);

  // Populate form when client data is loaded
  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        position: client.position || "",
        company: client.company || "",
        industry: (client as any).industry || "",
        companySize: (client as any).companySize && ['startup', 'small', 'medium', 'large', 'enterprise'].includes((client as any).companySize) ? (client as any).companySize as "startup" | "small" | "medium" | "large" | "enterprise" : "",
        annualRevenue: (client as any).annualRevenue ? String((client as any).annualRevenue) : "",
        employeeCount: (client as any).employeeCount ? String((client as any).employeeCount) : "",
        clientStatus: client.clientStatus || "qualified",
        status: client.status || "active",
        projectInterests: client.projectInterests ? client.projectInterests.join(", ") : "",
        address: {
          street: client.address?.street || "",
          city: client.address?.city || "",
          state: client.address?.state || "",
          zipCode: client.address?.zipCode || "",
          country: client.address?.country || "",
        },
        socialLinks: {
          linkedin: client.socialLinks?.linkedin || "",
          twitter: client.socialLinks?.twitter || "",
          github: client.socialLinks?.github || "",
        },
        preferences: {
          theme: client.preferences?.theme || "system",
          language: client.preferences?.language || "en",
          timezone: client.preferences?.timezone || "UTC",
          notifications: {
            email: client.preferences?.notifications?.email ?? true,
            push: client.preferences?.notifications?.push ?? false,
            sms: client.preferences?.notifications?.sms ?? false,
          },
        },
        notes: (client as any).notes || "",
      });
    }
  }, [client, form]);

  // Handle errors - REMOVED: TanStack Query handles errors automatically

  // Cleanup on unmount - REMOVED: Not needed with TanStack Query

  const handleSubmit = async (data: UpdateClientFormData) => {
    console.log('Form data being sent: form ready to submit');
    console.log('Form data being sent:133', data);
    console.log('clientId:134', clientId);
    if (!clientId) return;

    try {
      console.log('Form data being sent:', data);

      // Clean up data
      const cleanedData: UpdateClientData = {
        ...data,
        phone: data.phone?.trim() || undefined,
        projectInterests: data.projectInterests ? data.projectInterests.split(',').map(interest => interest.trim()).filter(interest => interest.length > 0) : [],
        companySize: (data.companySize && data.companySize.length > 0) ? data.companySize as "startup" | "small" | "medium" | "large" | "enterprise" : undefined,
        annualRevenue: data.annualRevenue || undefined,
        employeeCount: data.employeeCount || undefined,
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

      const result = await updateClient(clientId, cleanedData);

      toast({
        title: "Success",
        description: "Client updated successfully",
      });

      router.push("/clients");
    } catch (error: any) {
      console.error('Update client error:', error)

      // Handle structured API errors
      let errorMessage = "Failed to update client"
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
      collapse: true,
      defaultOpen: false,
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
      subform_title: "Client Status",
      collapse: true,
      defaultOpen: false,
      fields: [
        {
          name: "clientStatus",
          label: "Client Status",
          type: "select" as const,
          searchable: true,
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
          searchable: true,
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
      collapse: true,
      defaultOpen: false,
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
      collapse: true,
      defaultOpen: false,
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
      collapse: true,
      defaultOpen: false,
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
      collapse: true,
      defaultOpen: false,
      fields: [
        {
          name: "preferences.theme",
          label: "Theme",
          type: "select" as const,
          searchable: true,
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
      collapse: true,
      defaultOpen: false,
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
  if (clientLoading) {
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
  if (!clientLoading && !client) {
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
        subtitle={`Update information for "${client?.name}"`}
        showAddButton={false}
        actions={
          <div className="flex gap-2">
            {client?.status === 'qualified' && (
              <Button
                onClick={() => router.push(`/projects/add?clientId=${client._id}&prefill=true`)}
                disabled={actionLoading}
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isNavigating || actionLoading}
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
          loading={actionLoading}
          submitText="Update Client"
          cancelText="Cancel"
        />
      </div>
    </div>
  );
}