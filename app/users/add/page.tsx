"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppDispatch } from "@/hooks/redux";
import { createUser } from "@/store/slices/userSlice";
import PageHeader from "@/components/ui/page-header";
import GenericForm from "@/components/ui/generic-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigationLoading } from "@/hooks/use-navigation-loading";
import { useDepartments } from "@/hooks/use-departments";
import { useRoles } from "@/hooks/use-roles";
import { createUserSchema, type CreateUserData } from "@/lib/validations/user";
import type { Role, Department } from "@/types";

export default function AddUserPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetchingRoles, setFetchingRoles] = useState(false);

  // Department and role management
  const { departments, fetchDepartments, loading: departmentsLoading } = useDepartments();
  const { fetchRolesByDepartment, loading: rolesLoading } = useRoles();

  // Available roles based on selected department
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");

  // Use ref to track if departments are already being fetched
  const departmentsFetched = useRef(false);
  const currentDepartmentRef = useRef<string>("");

  const form = useForm<CreateUserData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      phone: "",
      role: "",
      department: "",
      position: "",
      status: "active",
      bio: "",
    },
  });

  // Load departments only once on mount
  useEffect(() => {
    if (!departmentsFetched.current) {
      departmentsFetched.current = true;
      fetchDepartments();
    }
  }, []); // Empty dependency array

  // Handle department change and fetch related roles
  const handleDepartmentChange = useCallback(async (departmentId: string) => {
    // Prevent duplicate calls
    if (departmentId === currentDepartmentRef.current || fetchingRoles) {
      return;
    }

    currentDepartmentRef.current = departmentId;
    setSelectedDepartment(departmentId);
    form.setValue("role", ""); // Reset role selection
    setAvailableRoles([]); // Clear previous roles

    if (!departmentId) {
      return;
    }

    setFetchingRoles(true);
    try {
      const response = await fetchRolesByDepartment(departmentId).unwrap();
      if (response.success && response.data) {
        setAvailableRoles(response.data || []);
      }
      else if (response.status === 403) {
        toast({
          title: "Permission Denied",
          description: "You don't have permission to view roles for this department",
          variant: "destructive",
        });
        setAvailableRoles([]);
      } else if (response.status === 404) {
        toast({
          title: "Department Not Found",
          description: "The selected department was not found",
          variant: "destructive",
        });
        setAvailableRoles([]);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to fetch roles for department:", errorData);
        toast({
          title: "Error",
          description: errorData.error || "Failed to fetch roles for this department",
          variant: "destructive",
        });
        setAvailableRoles([]);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
      toast({
        title: "Network Error",
        description: "Failed to connect to the server. Please try again.",
        variant: "destructive",
      });
      setAvailableRoles([]);
    } finally {
      setFetchingRoles(false);
    }
  }, [form, toast]);

  // Watch department field changes - Fixed to prevent infinite loops
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name === "department" && type === "change") {
        const newDepartmentId = value.department || "";
        if (newDepartmentId !== currentDepartmentRef.current) {
          handleDepartmentChange(newDepartmentId);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [form, handleDepartmentChange]);

  const handleSubmit = async (data: CreateUserData) => {
    setLoading(true);
    try {
      const result = await dispatch(createUser(data)).unwrap();

      toast({
        title: "Success",
        description: "User created successfully",
      });

      router.push("/users");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error || "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const { isNavigating, handleNavigation } = useNavigationLoading();

  const handleCancel = () => {
    handleNavigation("/users");
  };

  const formFields = [
    {
      name: "name",
      label: "Full Name",
      type: "text" as const,
      required: true,
      placeholder: "Enter full name",
      cols: 12,
      mdCols: 6,
      lgCols: 4,
    },
    {
      name: "email",
      label: "Email Address",
      type: "email" as const,
      required: true,
      placeholder: "Enter email address",
      cols: 12,
      mdCols: 6,
      lgCols: 4,
    },
    {
      name: "password",
      label: "Password",
      type: "password" as const,
      required: true,
      placeholder: "Enter password (min 8 chars with uppercase, lowercase, number)",
      cols: 12,
      mdCols: 6,
      lgCols: 4,
    },
    {
      name: "phone",
      label: "Phone Number",
      type: "text" as const,
      placeholder: "Enter phone number (e.g., +1234567890 or 1234567890)",
      cols: 12,
      mdCols: 6,
      lgCols: 4,
    },
    {
      name: "department",
      label: "Department",
      type: "select" as const,
      required: true,
      placeholder: "Select department first",
      loading: departmentsLoading,
      options: departments.map(dept => ({
        value: dept._id!,
        label: dept.name,
      })),
      cols: 12,
      mdCols: 6,
      lgCols: 4,
    },
    {
      name: "role",
      label: "Role",
      type: "select" as const,
      required: true,
      placeholder: selectedDepartment ? (fetchingRoles ? "Loading roles..." : "Select role") : "Select department first",
      disabled: !selectedDepartment || fetchingRoles,
      loading: fetchingRoles,
      options: availableRoles.map(role => ({
        value: role._id!,
        label: `${role.displayName} (Level ${role.hierarchyLevel})`,
      })),
      cols: 12,
      mdCols: 6,
      lgCols: 4,
    },
    {
      name: "position",
      label: "Position",
      type: "text" as const,
      placeholder: "Enter position/title",
      cols: 12,
      mdCols: 6,
      lgCols: 4,
    },
    {
      name: "status",
      label: "Status",
      type: "select" as const,
      required: true,
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
        { value: "suspended", label: "Suspended" },
      ],
      cols: 12,
      mdCols: 6,
      lgCols: 4,
    },
    {
      name: "bio",
      label: "Bio",
      type: "textarea" as const,
      placeholder: "Enter user bio (optional)",
      cols: 12,
      mdCols: 12,
      lgCols: 12,
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <PageHeader
        title="Add New User"
        subtitle="Create a new user account with roles and permissions"
        showAddButton={false}
        actions={
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isNavigating}
          >
            <ArrowLeft className={`h-4 w-4 mr-2 ${isNavigating ? 'animate-spin' : ''}`} />
            {isNavigating ? 'Going back...' : 'Back to Users'}
          </Button>
        }
      />

      {/* User Form */}
      <div>
        <GenericForm
          form={form}
          fields={formFields}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          loading={loading}
          submitText="Create User"
          cancelText="Cancel"
          gridCols={2}
        />
      </div>
    </div>
  );
}