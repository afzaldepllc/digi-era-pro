"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUsers } from "@/hooks/use-users";
import { handleAPIError } from "@/lib/utils/api-client";
import PageHeader from "@/components/ui/page-header";
import GenericForm from "@/components/ui/generic-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDepartments } from "@/hooks/use-departments";
import { useRoles } from "@/hooks/use-roles";
import { updateUserSchema, type UpdateUserData } from "@/lib/validations/user";
import type { Role, Department } from "@/types";


export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const userId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Combine loading states


  // Use users hook for CRUD operations
  const { updateUser, selectedUser, setSelectedUser, fetchUserById, users, userByIdLoading, error: userError } = useUsers();

  // Department and role management
  const { allDepartments, loading: departmentsLoading } = useDepartments();
  const { fetchRolesByDepartment, loading: rolesLoading } = useRoles();
  const [selectedDepartment, setSelectedDepartment] = useState<string | undefined>("");
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [initialUser, setInitialUser] = useState<any>(null);
  const isLoading = loading || userByIdLoading || departmentsLoading || rolesLoading;
  // Ref to track department changes and prevent infinite loops
  const currentDepartmentRef = useRef<string | undefined>("");

  const form = useForm<UpdateUserData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: "Loading...",
      email: "loading@example.com",
      phone: "",
      role: "",
      department: "",
      position: "",
      status: "active",
      // Address fields
      street: "",
      city: "",
      state: "",
      country: "",
      zipCode: "",
      // Preferences
      theme: "system",
      language: "en",
      timezone: "UTC",
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
    },
  });

  // Departments are loaded automatically by the useDepartments hook

  // Handle department change and fetch related roles
  const handleDepartmentChange = useCallback(async (departmentId: string) => {
    // Prevent infinite loop by checking if department actually changed
    if (departmentId === selectedDepartment || departmentId === currentDepartmentRef.current) {
      return;
    }

    currentDepartmentRef.current = departmentId;
    setSelectedDepartment(departmentId);
    form.setValue("role", ""); // Reset role selection
    setAvailableRoles([]); // Clear previous roles

    if (departmentId) {
      try {
        const result = await fetchRolesByDepartment(departmentId);
        // Handle Redux thunk result
        if (result.payload) {
          // Check if payload is an array (direct roles data) or wrapped response
          if (Array.isArray(result.payload)) {
            setAvailableRoles(result.payload);
          } else if (result.payload.success && result.payload.data) {
            setAvailableRoles(result.payload.data || []);
          } else {
            console.error("Failed to fetch roles for department:", result.payload);
            setAvailableRoles([]);
          }
        } else {
          // Handle rejected thunk
          console.error("Failed to fetch roles for department");
          setAvailableRoles([]);
        }
      } catch (error) {
        console.error("Error fetching roles:", error);
        setAvailableRoles([]);
      }
    }
  }, [selectedDepartment, form, fetchRolesByDepartment]);

  // Watch department field changes
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name === "department" && type === "change") {
        const newDepartmentId = value.department || "";
        if (newDepartmentId !== selectedDepartment && newDepartmentId !== currentDepartmentRef.current) {
          handleDepartmentChange(newDepartmentId);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, selectedDepartment, handleDepartmentChange]);

  useEffect(() => {
    if (userId) {
      // Fetch the user data
      fetchUserById(userId);
    }
  }, [userId, fetchUserById]);

  // Handle loading completion
  useEffect(() => {
    if (!userByIdLoading && selectedUser && selectedUser._id === userId && !initialUser) {
      const user = selectedUser;
      setInitialUser(user);

      // Extract role and department IDs
      const roleId = typeof user.role === 'object' && user.role?._id ? user.role._id : user.role;
      const departmentId = typeof user.department === 'object' && user.department?._id ? user.department._id : user.department;

      // Set department and load its roles
      if (departmentId && typeof departmentId === 'string' && /^[0-9a-fA-F]{24}$/.test(departmentId)) {
        setSelectedDepartment(departmentId);
        // Fetch roles for the department without triggering change handler
        // Only fetch if we haven't already fetched for this department
        if (currentDepartmentRef.current !== departmentId) {
          currentDepartmentRef.current = departmentId;
          fetchRolesByDepartment(departmentId).then((result) => {
            if (result.payload) {
              let roles = result.payload;
              // Handle different response formats
              if (Array.isArray(roles)) {
                setAvailableRoles(roles);
                // Set the role value after roles are loaded
                if (roleId) {
                  form.setValue('role', roleId);
                }
              } else if (roles.success && roles.data && Array.isArray(roles.data)) {
                setAvailableRoles(roles.data);
                // Set the role value after roles are loaded
                if (roleId) {
                  form.setValue('role', roleId);
                }
              } else {
                console.error("Unexpected response format for roles:", roles);
                setAvailableRoles([]);
              }
            } else {
              // Handle rejected thunk
              const error = (result as any).error || (result.meta as any)?.rejectedWithValue;
              if (Array.isArray(error)) {
                // The error is actually the data
                setAvailableRoles(error);
                // Set the role value after roles are loaded
                if (roleId) {
                  form.setValue('role', roleId);
                }
              } else {
                console.error("Failed to fetch roles for department:", error);
                setAvailableRoles([]);
              }
            }
          }).catch((error) => {
            console.error("Error fetching roles:", error);
            setAvailableRoles([]);
          });
        } else {
          // Roles already fetched for this department, just set the role
          if (roleId) {
            form.setValue('role', roleId);
          }
        }
      }

      // Map user data to form format
      form.reset({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        role: "", // Will be set after roles are loaded
        department: departmentId || "",
        position: user.position || "",
        status: user.status as any,
        // Address fields
        street: user.address?.street || "",
        city: user.address?.city || "",
        state: user.address?.state || "",
        country: user.address?.country || "",
        zipCode: user.address?.zipCode || "",
        // Preferences
        theme: user.preferences?.theme || "system",
        language: user.preferences?.language || "en",
        timezone: user.preferences?.timezone || "UTC",
        emailNotifications: user.preferences?.notifications?.email ?? true,
        smsNotifications: user.preferences?.notifications?.sms ?? false,
        pushNotifications: user.preferences?.notifications?.push ?? true,
      });

      setLoading(false);
    } else if (!userByIdLoading && !selectedUser && !userError) {
      // If loading is complete but no user data and no error, set loading to false
      setLoading(false);
    }
  }, [selectedUser, userId, userByIdLoading, userError, form, setSelectedDepartment, fetchRolesByDepartment]);

  // Set loading to false when user loading is done
  useEffect(() => {
    if (!userByIdLoading && userId) {
      setLoading(false);
    }
  }, [userByIdLoading, userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setSelectedUser(null);
    };
  }, [setSelectedUser]);

  const handleSubmit = async (data: UpdateUserData) => {
    if (!selectedUser || !selectedUser._id) return;
    setSaving(true);
    try {
      // The updateUserSchema with transformation will handle converting flat form data to nested structure
      const updateData = {
        _id: selectedUser._id,
        ...data, // The schema transformation will handle the nested structure conversion
      };

      await updateUser(updateData);

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      router.push("/users");
    } catch (error: any) {
      handleAPIError(error, 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push("/users");
  };

  const formFields = [
    {
      subform_title: "Personal Information",
      fields: [
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
          name: "status",
          label: "Status",
          type: "select" as const,
          searchable: true,
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
      ]
    },
    {
      subform_title: "Contact Information",
      collapse: true,
      defaultOpen: false,
      fields: [
        {
          name: "phone",
          label: "Phone Number",
          type: "text" as const,
          placeholder: "Enter phone number",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "street",
          label: "Street Address",
          type: "text" as const,
          placeholder: "Enter street address",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "city",
          label: "City",
          type: "text" as const,
          placeholder: "Enter city",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "state",
          label: "State/Province",
          type: "text" as const,
          placeholder: "Enter state or province",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "country",
          label: "Country",
          type: "text" as const,
          placeholder: "Enter country",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "zipCode",
          label: "ZIP/Postal Code",
          type: "text" as const,
          placeholder: "Enter ZIP or postal code",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
      ]
    },
    {
      subform_title: "Role & Department",
      collapse: true,
      defaultOpen: false,
      fields: [
        {
          name: "department",
          label: "Department",
          type: "select" as const,
          searchable: true,
          required: true,
          placeholder: "Select department",
          loading: departmentsLoading,
          options: allDepartments?.map(dept => ({
            value: dept._id!,
            label: dept.name,
          })) || [],
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "role",
          label: "Role",
          type: "select" as const,
          searchable: true,
          required: true,
          placeholder: selectedDepartment ? "Select role" : "Select department first",
          disabled: !selectedDepartment || availableRoles.length === 0,
          loading: rolesLoading,
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
          name: "bio",
          label: "Bio",
          type: "textarea" as const,
          placeholder: "Enter user bio (optional)",
          cols: 12,
          mdCols: 12,
          lgCols: 12,
        },
      ]
    },
    {
      subform_title: "Preferences",
      collapse: true,
      defaultOpen: false,
      fields: [
        {
          name: "language",
          label: "Language",
          type: "select" as const,
          searchable: true,
          options: [
            { value: "en", label: "English" },
            { value: "es", label: "Spanish" },
            { value: "fr", label: "French" },
            { value: "de", label: "German" },
          ],
          cols: 12,
          mdCols: 6,
        },
        {
          name: "timezone",
          label: "Timezone",
          type: "select" as const,
          searchable: true,
          options: [
            { value: "UTC", label: "UTC" },
            { value: "America/New_York", label: "Eastern Time" },
            { value: "America/Chicago", label: "Central Time" },
            { value: "America/Denver", label: "Mountain Time" },
            { value: "America/Los_Angeles", label: "Pacific Time" },
          ],
          cols: 12,
          mdCols: 6,
        },
      ]
    }
  ];

  if (userError && !isLoading) {
    return (
      <div>
        <PageHeader
          title="Edit User"
          subtitle="Error loading user data"
          showAddButton={false}
        />
        <div className="p-6 text-center">
          <p className="text-red-600 mb-4">Failed to load user data. Please try again.</p>
          <Button onClick={() => fetchUserById(userId)} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div>
      {/* Page Header */}
      <PageHeader
        title="Edit User"
        subtitle="Update user information, roles, and preferences"
        showAddButton={false}
        actions={
          <Button variant="outline" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
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
          loading={saving}
          submitText="Update User"
          cancelText="Cancel"
          gridCols={3}
        />
      </div>
    </div>

  );
}