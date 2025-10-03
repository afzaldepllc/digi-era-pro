"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppDispatch } from "@/hooks/redux";
import { createDepartment } from "@/store/slices/departmentSlice";
import PageHeader from "@/components/ui/page-header";
import GenericForm from "@/components/ui/generic-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigationLoading } from "@/hooks/use-navigation-loading";
import { CreateDepartmentData, createDepartmentSchema } from '@/lib/validations/department'


export default function AddDepartmentPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<CreateDepartmentData>({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "active",
    },
  });

  const handleSubmit = async (data: CreateDepartmentData) => {
    setLoading(true);
    try {
      const cleanedData: CreateDepartmentData = {
        ...data,
        description: data.description?.trim() || undefined,
      };

      await dispatch(createDepartment(cleanedData)).unwrap();

      toast({
        title: "Success",
        description: "Department created successfully",
      });

      router.push("/departments");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error || "Failed to create department",
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add New Department"
        subtitle="Create a new department in your organization"
        showAddButton={false}
        actions={
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isNavigating}
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
          submitText="Create Department"
          cancelText="Cancel"
        />
      </div>
    </div>
  );
}