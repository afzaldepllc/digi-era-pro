"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  fetchDepartmentById,
  updateDepartment,
  clearError,
  setSelectedDepartment
} from "@/store/slices/departmentSlice";
import PageHeader from "@/components/ui/page-header";
import GenericForm from "@/components/ui/generic-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigationLoading } from "@/hooks/use-navigation-loading";
import { updateDepartmentSchema, UpdateDepartmentData } from '@/lib/validations/department'



export default function EditDepartmentPage() {
  const router = useRouter();
  const params = useParams();
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const departmentId = params.id as string;

  // Redux state
  const {
    selectedDepartment,
    actionLoading,
    error
  } = useAppSelector((state) => state.departments);

  const form = useForm<UpdateDepartmentData>({
    resolver: zodResolver(updateDepartmentSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "active",
    },
  });

  // Load department data
  useEffect(() => {
    if (departmentId) {
      dispatch(fetchDepartmentById(departmentId));
    }
  }, [dispatch, departmentId]);

  // Populate form when department data is loaded
  useEffect(() => {
    if (selectedDepartment) {
      form.reset({
        name: selectedDepartment.name,
        description: selectedDepartment.description || "",
        status: selectedDepartment.status,
      });
    }
  }, [selectedDepartment, form]);

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
      dispatch(setSelectedDepartment(null));
    };
  }, [dispatch]);

  const handleSubmit = async (data: UpdateDepartmentData) => {
    if (!selectedDepartment || !selectedDepartment._id) return;

    setLoading(true);
    try {
      console.log('Form data being sent:', data);

      const result = await dispatch(
        updateDepartment({
          id: selectedDepartment._id!,
          data
        })
      ).unwrap();

      toast({
        title: "Success",
        description: "Department updated successfully",
      });

      router.push("/departments");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error || "Failed to update department",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const { isNavigating, handleNavigation } = useNavigationLoading();

  const handleCancel = () => {
    handleNavigation("/departments");
  };

  const formFields = [
    {
      name: "name",
      label: "Department Name",
      type: "text" as const,
      required: true,
      placeholder: "Enter department name",
      description: "A unique name for the department",
      cols: 12,
      mdCols: 8,
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
      mdCols: 4,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea" as const,
      placeholder: "Enter department description (optional)",
      description: "Brief description of the department's purpose and responsibilities",
      cols: 12,
      rows: 4,
    },
  ];

  // Show loading skeleton while fetching department data
  if (actionLoading && !selectedDepartment) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Edit Department"
          subtitle="Update department information"
          showAddButton={false}
          actions={
            <Button variant="outline" disabled>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Departments
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

  // Show error if department not found
  if (!actionLoading && !selectedDepartment) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Department Not Found"
          subtitle="The requested department could not be found"
          showAddButton={false}
          actions={
            <Button variant="outline" onClick={handleCancel}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Departments
            </Button>
          }
        />

        <div className="text-center py-12">
          <p className="text-muted-foreground">
            The department you're looking for doesn't exist or has been deleted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Department"
        subtitle={`Update information for "${selectedDepartment?.name}"`}
        showAddButton={false}
        actions={
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isNavigating || loading}
          >
            <ArrowLeft className={`h-4 w-4 mr-2 ${isNavigating ? 'animate-spin' : ''}`} />
            {isNavigating ? 'Going back...' : 'Back to Departments'}
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
          submitText="Update Department"
          cancelText="Cancel"
        />
      </div>
    </div>
  );
}