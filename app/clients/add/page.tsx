"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppDispatch } from "@/hooks/redux";
import { createClient } from "@/store/slices/clientSlice";
import PageHeader from "@/components/ui/page-header";
import GenericForm from "@/components/ui/generic-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigationLoading } from "@/hooks/use-navigation-loading";
import { CreateClientFormData, createClientFormSchema } from '@/lib/validations/client';

export default function AddClientPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<CreateClientFormData>({
    resolver: zodResolver(createClientFormSchema),
    defaultValues: {
      // Basic Information
      name: "",
      email: "",
      phone: "",
      position: "",

      // Company Information
      company: "",
      industry: "",
      companySize: undefined,
      annualRevenue: "",
      employeeCount: "",

      // Client Status
      clientStatus: "qualified",
      status: "qualified",

      // Project Interests
      projectInterests: "",

      // Address Information
      address: {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "",
      },

      // Social Links
      socialLinks: {
        linkedin: "",
        twitter: "",
        github: "",
      },

      // Preferences
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

      // Notes
      notes: "",
    },
  });

  const handleSubmit = async (data: CreateClientFormData) => {
    setLoading(true);
    try {
      // Transform form data to API format
      const cleanedData = {
        ...data,
        // Basic transformations
        phone: data.phone?.trim() || undefined,
        position: data.position?.trim() || undefined,
        company: data.company?.trim() || '',
        industry: data.industry?.trim() || undefined,
        companySize: data.companySize || undefined,
        annualRevenue: data.annualRevenue ? Number(data.annualRevenue) : undefined,
        employeeCount: data.employeeCount ? Number(data.employeeCount) : undefined,

        // Project interests - split comma-separated string
        projectInterests: data.projectInterests?.split(',').map(interest => interest.trim()).filter(interest => interest.length > 0) || [],

        // Address transformations
        address: {
          street: data.address?.street?.trim() || undefined,
          city: data.address?.city?.trim() || undefined,
          state: data.address?.state?.trim() || undefined,
          zipCode: data.address?.zipCode?.trim() || undefined,
          country: data.address?.country?.trim() || undefined,
        },

        // Social links transformations
        socialLinks: {
          linkedin: data.socialLinks?.linkedin?.trim() || undefined,
          twitter: data.socialLinks?.twitter?.trim() || undefined,
          github: data.socialLinks?.github?.trim() || undefined,
        },

        // Preferences
        preferences: data.preferences,

        // Notes
        notes: data.notes?.trim() || undefined,

        // Client-specific fields
        isClient: true,
        emailVerified: false,
        phoneVerified: false,
        twoFactorEnabled: false,
        permissions: [],
      };

      await dispatch(createClient(cleanedData)).unwrap();

      toast({
        title: "Success",
        description: "Client created successfully",
      });

      router.push("/clients");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error || "Failed to create client",
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add New Client"
        subtitle="Create a new client record"
        showAddButton={false}
        actions={
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isNavigating}
          >
            <ArrowLeft className={`h-4 w-4 mr-2 ${isNavigating ? 'animate-spin' : ''}`} />
            {isNavigating ? 'Going back...' : 'Back to Clients'}
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
          submitText="Create Client"
          cancelText="Cancel"
        />
      </div>
    </div>
  );
}