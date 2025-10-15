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
import { updateClientSchema, UpdateClientData } from '@/lib/validations/client';

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

  const form = useForm<UpdateClientData>({
    resolver: zodResolver(updateClientSchema),
    defaultValues: {
      name: "",
      phone: "",
      company: "",
      status: "qualified",
      projectInterests: [],
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
        name: selectedClient.name,
        phone: selectedClient.phone || "",
        company: selectedClient.company,
        status: selectedClient.status,
        projectInterests: selectedClient.projectInterests || [],
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

  const handleSubmit = async (data: UpdateClientData) => {
    if (!selectedClient || !selectedClient._id) return;

    setLoading(true);
    try {
      console.log('Form data being sent:', data);

      // Clean up data
      const cleanedData = {
        ...data,
        phone: data.phone?.trim() || undefined,
        projectInterests: data.projectInterests?.filter(interest => interest.trim().length > 0),
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
    }];

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