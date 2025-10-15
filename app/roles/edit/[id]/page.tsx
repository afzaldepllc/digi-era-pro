"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRoles } from "@/hooks/use-roles";
import { useDepartments } from "@/hooks/use-departments";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FormLoader } from "@/components/ui/loader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import PageHeader from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import GenericForm from "@/components/ui/generic-form";
import { useNavigationLoading } from "@/hooks/use-navigation-loading";
import { updateRoleSchema, UpdateRoleData } from "@/lib/validations/role";


export default function EditRolePage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const roleId = params?.id as string;


  const {
    roles,
    selectedRole,
    loading,
    actionLoading,
    error,
    fetchRoles,
    updateRole,
    setSelectedRole
  } = useRoles();

  const { departments, fetchDepartments } = useDepartments();
  const { isNavigating, handleNavigation } = useNavigationLoading();

  // Initialize form
  const form = useForm<UpdateRoleData>({
    resolver: zodResolver(updateRoleSchema),
    defaultValues: {
      name: "",
      displayName: "",
      description: "",
      department: "",
      hierarchyLevel: 1,
      maxUsers: "", // Use empty string instead of undefined to keep it controlled
      status: "active" as const,
    },
  });


  // Load data on mount
  useEffect(() => {


    const loadData = async () => {
      try {
        await Promise.all([
          fetchRoles(),
          fetchDepartments(),
        ]);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load data",
          variant: "destructive",
        });
      }
    };
    loadData();
  }, [router, fetchRoles, fetchDepartments, toast]);

  // Load specific role data
  useEffect(() => {
    if (roles.length > 0 && roleId) {
      const role = roles.find((r) => r._id === roleId);
      if (role) {
        setSelectedRole(role);

        // Ensure permissions is always an array
        const rolePermissions = Array.isArray(role.permissions) ? role.permissions : [];

        // Reset form with role data
        form.reset({
          name: role.name || "",
          displayName: role.displayName || "",
          description: role.description || "",
          department: typeof role.department === 'string' ? role.department : role.department?._id || "",
          hierarchyLevel: role.hierarchyLevel || 1,
          maxUsers: role.maxUsers ? role.maxUsers.toString() : "", // Convert to string or empty string
          status: role.status || "active",
        });
      }
    }
  }, [roles, roleId, setSelectedRole, form]);

  // Handle form submission
  const onSubmit = async (data: UpdateRoleData) => {
    if (!selectedRole || !selectedRole._id) return;

    try {
      // Transform form data to handle number fields properly
      const transformedData = {
        _id: selectedRole._id,
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        department: data.department,
        hierarchyLevel: typeof data.hierarchyLevel === 'string' ? parseInt(data.hierarchyLevel) : data.hierarchyLevel,
        maxUsers: data.maxUsers && data.maxUsers !== "" ? (typeof data.maxUsers === 'string' ? parseInt(data.maxUsers) : data.maxUsers) : undefined,
        status: data.status,
      };

      await updateRole(transformedData).unwrap();

      toast({
        title: "Success",
        description: "Role updated successfully",
      });

      router.push("/roles");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
    }
  };



  const handleCancel = () => {
    handleNavigation("/roles");
  };

  // Loading state
  if (loading || !selectedRole) {
    return (
      <div>
        <PageHeader
          title="Edit Role"
          subtitle="Loading role data..."
          showAddButton={false}
        />
        <FormLoader fields={6} columns={3} />
      </div>
    );
  }

  // Check if role is protected
  const isProtectedRole = selectedRole?.name === 'super_admin' || selectedRole?.name === 'superadmin';

  // Define form fields configuration
  const formFields = [
    {
      fields: [
        {
          name: "name",
          label: "Role Name",
          type: "text" as const,
          required: true,
          placeholder: "Enter role name",
          description: "A unique name for this role",
          disabled: isProtectedRole,
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        {
          name: "displayName",
          label: "Display Name",
          type: "text" as const,
          required: true,
          placeholder: "Enter display name",
          description: "Human-readable name for the role",
          disabled: isProtectedRole,
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        {
          name: "department",
          label: "Department",
          type: "select" as const,
          required: true,
          placeholder: "Select department",
          description: "The department this role belongs to",
          disabled: isProtectedRole,
          options: departments.map(dept => ({
            value: dept._id!,
            label: dept.name,
          })),
          cols: 12,
          mdCols: 4,
          lgCols: 3,
        },
        {
          name: "status",
          label: "Status",
          type: "select" as const,
          required: true,
          placeholder: "Select status",
          disabled: isProtectedRole,
          options: [
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
            { value: "archived", label: "Archived" },
          ],
          cols: 12,
          mdCols: 4,
          lgCols: 3,
        },
        {
          name: "hierarchyLevel",
          label: "Authority Level",
          type: "number" as const,
          required: true,
          placeholder: "1-10",
          description: "Higher numbers indicate more authority (1-10)",
          disabled: isProtectedRole,
          cols: 12,
          mdCols: 4,
          lgCols: 3,
        },
        {
          name: "maxUsers",
          label: "Max Users",
          type: "number" as const,
          placeholder: "Unlimited",
          description: "Maximum number of users for this role (optional)",
          disabled: isProtectedRole,
          cols: 12,
          mdCols: 4,
          lgCols: 3,
        },
        {
          name: "description",
          label: "Description",
          type: "textarea" as const,
          placeholder: "Describe the role's purpose and responsibilities...",
          description: "Optional description of the role's purpose and responsibilities",
          disabled: isProtectedRole,
          rows: 4,
          cols: 12,
          mdCols: 12,
          lgCols: 12,
        },
      ]
    }
  ];

  return (
    <div>
      {/* Page Header */}
      <PageHeader
        title="Edit Role"
        subtitle={selectedRole ? `Modify role: ${selectedRole.displayName || selectedRole.name}` : "Loading role..."}
        showAddButton={false}
        actions={
          <div className="flex items-center gap-2">
            {selectedRole && (
              <>
                <Badge variant={selectedRole.status === 'active' ? "default" : "secondary"}>
                  {selectedRole.status === 'active' ? "Active" : selectedRole.status === 'inactive' ? "Inactive" : "Archived"}
                </Badge>
                <Badge variant="outline">
                  Level {selectedRole.hierarchyLevel}
                </Badge>
              </>
            )}
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isNavigating}
            >
              <ArrowLeft className={`h-4 w-4 mr-2 ${isNavigating ? 'animate-spin' : ''}`} />
              {isNavigating ? 'Going back...' : 'Back to Roles'}
            </Button>
          </div>
        }
      />

      {/* Protection Warning */}
      {isProtectedRole && (
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Protected Role:</strong> This is the Super Administrator role which cannot be modified to maintain system security.
            All changes will be blocked.
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Role Form */}
      <div>
        <GenericForm
          form={form}
          fields={formFields}
          onSubmit={onSubmit}
          onCancel={handleCancel}
          loading={actionLoading}
          submitText={actionLoading ? "Updating..." : "Update Role"}
          cancelText="Cancel"
          gridCols={3}
        />
      </div>
    </div>
  );
}