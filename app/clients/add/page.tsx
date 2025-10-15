"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppDispatch } from "@/hooks/redux";
import { createClient } from "@/store/slices/clientSlice";
import PageHeader from "@/components/ui/page-header";
import GenericForm from "@/components/ui/generic-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigationLoading } from "@/hooks/use-navigation-loading";
import { CreateClientData, createClientSchema } from '@/lib/validations/client';

export default function AddClientPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<CreateClientData>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      status: "qualified",
      projectInterests: [""],
      // role and department will be set by API
    },
  });

  // Dynamic field array for projectInterests
  const { fields: interestFields, append, remove } = useFieldArray({
    control: form.control,
    name: "projectInterests",
  });

  const handleSubmit = async (data: CreateClientData) => {
    // console.log("Form Data37:"); // Debug log
    // return;
    setLoading(true);
    try {
      const cleanedData: CreateClientData = {
        ...data,
        phone: data.phone?.trim() || undefined,
        projectInterests: data.projectInterests?.filter(interest => interest.trim().length > 0),
        // Remove empty role and department - API will handle these
        ...(data.role && { role: data.role }),
        ...(data.department && { department: data.department }),
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
          name: "status",
          label: "Status",
          type: "select" as const,
          required: true,
          options: [
            { value: "qualified", label: "Qualified" },
            { value: "unqualified", label: "Unqualified" },
          ],
          cols: 12,
          mdCols: 4,
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
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <GenericForm
            form={form}
            fields={formFields}
            onSubmit={() => { }}
            onCancel={handleCancel}
            loading={loading}
            cancelText="Cancel"
            showCancel={false} // We'll render buttons manually
          />

          {/* Dynamic Project Interests - improved UI */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-2 w-full">
              <label className="block text-sm font-medium mb-2">Project Interests</label>
              {interestFields.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append("")}
                  disabled={loading}
                  className="transition-colors"
                >
                  + Add Interest
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {interestFields.map((field, idx) => (
                <div
                  key={field.id}
                  className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2 shadow-sm transition-all group hover:bg-muted"
                >
                  <span className="text-xs text-muted-foreground font-semibold w-6 text-center select-none">
                    {idx + 1}.
                  </span>
                  <input
                    className="flex-1 px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/40 bg-background transition-all"
                    type="text"
                    placeholder={`Interest #${idx + 1}`}
                    {...form.register(`projectInterests.${idx}` as const)}
                    disabled={loading}
                  />
                  {interestFields.length > 1 && (
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => remove(idx)}
                      disabled={loading}
                      className="ml-1 p-1 rounded-full text-destructive hover:bg-destructive/10 transition-colors focus:outline-none focus:ring-2 focus:ring-destructive/30"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">You can add up to 10 project interests.</p>
          </div>

          {/* Submit/Cancel buttons */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <span className="mr-2">Loading...</span>}
              Create Client
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}