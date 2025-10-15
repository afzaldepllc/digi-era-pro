"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppDispatch } from "@/hooks/redux";
import { updateUser, fetchUserById } from "@/store/slices/userSlice";
import PageHeader from "@/components/ui/page-header";
import GenericForm from "@/components/ui/generic-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDepartments } from "@/hooks/use-departments";
import { useRoles } from "@/hooks/use-roles";
import { updateUserSchema, type UpdateUserData } from "@/lib/validations/user";
import type { Role, Department } from "@/types";

import Loader, { FormLoader } from "@/components/ui/loader";

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const dispatch = useAppDispatch();
  const { toast } = useToast();

  const userId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Department and role management
  const { departments, fetchDepartments, loading: departmentsLoading } = useDepartments();
  const { fetchRolesByDepartment, loading: rolesLoading } = useRoles();

  // Available roles based on selected department
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [initialUser, setInitialUser] = useState<any>(null);

  // Ref to track department changes and prevent infinite loops
  const currentDepartmentRef = useRef<string>("");

  const form = useForm<UpdateUserData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      status: "active",
      theme: "system",
      language: "en",
      timezone: "UTC",
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
    },
  });

  // Load departments on component mount
  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // Handle department change and fetch related roles
  const handleDepartmentChange = useCallback(async (departmentId: string) => {
    // Prevent infinite loop by checking if department actually changed
    if (departmentId === selectedDepartment || departmentId === currentDepartmentRef.current) {
      return;
    }

    currentDepartmentRef.current = departmentId;
    setSelectedDepartment(departmentId);
    form.setValue("role", ""); // Reset role selection

    if (departmentId) {
      try {
        const response = await fetchRolesByDepartment(departmentId).unwrap();
        if (response.success) {
          setAvailableRoles(response.data || []);
        }
      } catch (error) {
        console.error("Error fetching roles:", error);
        setAvailableRoles([]);
      }
    } else {
      setAvailableRoles([]);
    }
  }, [selectedDepartment, form]);

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
      fetchUser(userId);
    }
  }, [userId]);

  const fetchUser = async (userId: string) => {
    try {
      setLoading(true);
      const result = await dispatch(fetchUserById(userId)).unwrap();

      if (result.success && result.data) {
        const user = result.data;
        setInitialUser(user);

        // Extract role and department IDs
        const roleId = typeof user.role === 'object' && user.role?._id ? user.role._id : user.role;
        const departmentId = typeof user.department === 'object' && user.department?._id ? user.department._id : user.department;

        // Set department and load its roles
        if (departmentId) {
          currentDepartmentRef.current = departmentId;
          setSelectedDepartment(departmentId);
          // Fetch roles for the department without triggering change handler
          try {
            const response = await fetchRolesByDepartment(departmentId).unwrap();
            if (response.success) {
              setAvailableRoles(response.data || []);
            }
          } catch (error) {
            console.error("Error fetching roles:", error);
            setAvailableRoles([]);
          }
        }

        // Map user data to form format
        form.reset({
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
          role: roleId || "",
          department: departmentId || "",
          position: user.position || "",
          status: user.status as any,
          bio: user.bio || user.metadata?.notes || "",
          // Address fields
          street: user.address?.street || "",
          city: user.address?.city || "",
          state: user.address?.state || "",
          country: user.address?.country || "",
          zipCode: user.address?.zipCode || "",
          // Emergency Contact (if available)
          emergencyName: user.emergencyContact?.name || "",
          emergencyPhone: user.emergencyContact?.phone || "",
          emergencyRelationship: user.emergencyContact?.relationship || "",
          // Preferences
          theme: user.preferences?.theme || "system",
          language: user.preferences?.language || "en",
          timezone: user.preferences?.timezone || "UTC",
          emailNotifications: user.preferences?.notifications?.email ?? true,
          smsNotifications: user.preferences?.notifications?.sms ?? false,
          pushNotifications: user.preferences?.notifications?.push ?? true,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error || "Failed to load user",
        variant: "destructive",
      });
      router.push("/users");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: UpdateUserData) => {
    if (!userId) return;
    setSaving(true);
    try {
      // The updateUserSchema with transformation will handle converting flat form data to nested structure
      const updateData = {
        _id: userId,
        ...data, // The schema transformation will handle the nested structure conversion
      };

      await dispatch(updateUser(updateData)).unwrap();

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      router.push("/users");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error || "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push("/users");
  };

  const formFields = [
    {
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
          name: "phone",
          label: "Phone Number",
          type: "text" as const,
          placeholder: "Enter phone number",
          cols: 12,
          mdCols: 6,
          lgCols: 4,
        },
        {
          name: "department",
          label: "Department",
          type: "select" as const,
          required: true,
          placeholder: "Select department",
          loading: departmentsLoading,
          options: departments.map(dept => ({
            value: dept._id!,
            label: dept.name,
          })),
          cols: 12,
          mdCols: 6,
          lgCols: 6,
        },
        {
          name: "role",
          label: "Role",
          type: "select" as const,
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
          lgCols: 6,
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

        // Address Information
        {
          name: "street",
          label: "Street Address",
          type: "text" as const,
          placeholder: "Enter street address",
          cols: 12,      // Full width on mobile
          mdCols: 6,     // Half width on medium screens
          lgCols: 4,     // Third width on large screens
        },
        {
          name: "city",
          label: "City",
          type: "text" as const,
          placeholder: "Enter city",
          cols: 12,      // Full width on mobile
          mdCols: 6,     // Half width on medium screens
          lgCols: 4,     // Third width on large screens
        },
        {
          name: "state",
          label: "State/Province",
          type: "text" as const,
          placeholder: "Enter state or province",
          cols: 12,      // Full width on mobile
          mdCols: 6,     // Half width on medium screens
          lgCols: 4,     // Third width on large screens
        },
        {
          name: "country",
          label: "Country",
          type: "text" as const,
          placeholder: "Enter country",
          cols: 12,      // Full width on mobile
          mdCols: 6,     // Half width on medium screens
          lgCols: 4,     // Third width on large screens
        },
        {
          name: "zipCode",
          label: "ZIP/Postal Code",
          type: "text" as const,
          placeholder: "Enter ZIP or postal code",
          cols: 12,      // Full width on mobile
          mdCols: 6,     // Half width on medium screens
          lgCols: 4,     // Third width on large screens
        },
        // Emergency Contact
        {
          name: "emergencyName",
          label: "Emergency Contact Name",
          type: "text" as const,
          placeholder: "Enter emergency contact name",
          cols: 12,      // Full width on mobile
          mdCols: 6,     // Half width on medium screens
          lgCols: 4,     // Third width on large screens
        },
        {
          name: "emergencyPhone",
          label: "Emergency Contact Phone",
          type: "text" as const,
          placeholder: "Enter emergency contact phone",
          cols: 12,      // Full width on mobile
          mdCols: 6,     // Half width on medium screens
          lgCols: 4,     // Third width on large screens
        },
        {
          name: "emergencyRelationship",
          label: "Relationship",
          type: "text" as const,
          placeholder: "Enter relationship (e.g., Spouse, Parent)",
          cols: 12,      // Full width on mobile
          mdCols: 6,     // Half width on medium screens
          lgCols: 4,     // Third width on large screens
        },
        // Preferences
        {
          name: "language",
          label: "Language",
          type: "select" as const,
          options: [
            { value: "en", label: "English" },
            { value: "es", label: "Spanish" },
            { value: "fr", label: "French" },
            { value: "de", label: "German" },
          ],
          cols: 12,      // Full width on mobile
          mdCols: 6,     // Half width on medium screens
          lgCols: 4,     // Third width on large screens
        },
        {
          name: "timezone",
          label: "Timezone",
          type: "select" as const,
          options: [
            { value: "UTC", label: "UTC" },
            { value: "America/New_York", label: "Eastern Time" },
            { value: "America/Chicago", label: "Central Time" },
            { value: "America/Denver", label: "Mountain Time" },
            { value: "America/Los_Angeles", label: "Pacific Time" },
          ],
          cols: 12,      // Full width on mobile
          mdCols: 6,     // Half width on medium screens
          lgCols: 4,     // Third width on large screens
        },
        {
          name: "bio",
          label: "Bio/Notes",
          type: "textarea" as const,
          placeholder: "Enter user bio or notes (optional)",
          rows: 3,
          cols: 12,      // Full width on mobile
          mdCols: 12,     // Half width on medium screens
          lgCols: 12,     // Third width on large screens
        },
      ]
    }
  ];

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Edit User"
          subtitle="Loading user data..."
          showAddButton={false}
        />
        <FormLoader fields={9} columns={3} />
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