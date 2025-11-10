"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckSquare, Edit, Trash2, Calendar, User as UserIcon, Building2, ChevronDown, Folder, FolderOpen, Eye, MessageCircle, Timer, CheckCircle, RefreshCw, MoreHorizontal, ChevronUp } from "lucide-react";
import CustomModal from "@/components/ui/custom-modal";
import { TaskModal } from "@/components/projects/TaskModal";
import { TaskCommentsSection } from "@/components/projects/TaskCommentsSection";
import { TimeTrackingSection } from "@/components/projects/TimeTrackingSection";
import { useDepartments } from '@/hooks/use-departments';
import { useTasks } from '@/hooks/use-tasks';
import { useUsers } from '@/hooks/use-users';
import { useProjects } from '@/hooks/use-projects';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import Swal from 'sweetalert2';
import { User as UserType } from '@/types';
import { Label } from "@/components/ui/label";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { CardLoader } from "@/components/ui/loader";
import HtmlTextRenderer from "../ui/html-text-renderer";

interface ProjectCategorizationProps {
    projectId: string;
    project: any;
    onProjectUpdate?: () => void;
}

interface DepartmentSelection {
    departmentId: string;
    additionalInfo: string;
}

export function ProjectCategorization({ projectId, project, onProjectUpdate }: ProjectCategorizationProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Modal and UI state
    const [taskModal, setTaskModal] = useState<{
        isOpen: boolean;
        mode: 'create' | 'edit' | 'assign';
        task?: any;
        departmentId?: string;
        departmentName?: string;
        parentTaskId?: string;
    }>({
        isOpen: false,
        mode: 'create'
    });
    const [showTaskDetails, setShowTaskDetails] = useState(false);
    const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<any>(null);
    const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());
    // Collapsed departments (for collapsing entire department cards)
    const [collapsedDepartments, setCollapsedDepartments] = useState<Set<string>>(new Set());

    // State for selected departments for this project
    const [selectedDepartments, setSelectedDepartments] = useState<DepartmentSelection[]>([]);

    // Hook dependencies
    const { departments, loading: departmentsLoading, error: departmentsError } = useDepartments();
    const { tasks, createTask, updateTask, deleteTask, loading: taskLoading, setFilters: setTaskFilters, refreshTasks, error: tasksError } = useTasks();
    const { users, loading: usersLoading, setFilters: setUserFilters, clearError: clearUserError, fetchUsers } = useUsers();
    const { updateProject } = useProjects();
    const { canCreate, canUpdate, canDelete } = usePermissions();

    // Ensure all users are loaded for assignment - clear any department filters
    useEffect(() => {
        setUserFilters({});
        clearUserError();
        if (users.length === 0) {
            fetchUsers();
        }
    }, []); // Empty dependency array to run only once on mount
    // Auto-refresh tasks when component becomes visible/active
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && selectedDepartments.length > 0) {
                setTaskFilters({ projectId });
                refreshTasks();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [selectedDepartments.length, projectId]);

    // Categorization form
    const categorizationForm = useForm({
        defaultValues: {
            departmentIds: [] as string[],
        },
    });

    // Watch form changes to trigger re-renders
    const watchedDepartmentIds = categorizationForm.watch('departmentIds');

    // Refresh tasks when departments are selected/deselected
    useEffect(() => {
        if (watchedDepartmentIds && watchedDepartmentIds.length > 0) {
            setTaskFilters({ projectId });
            refreshTasks();
        }
    }, [watchedDepartmentIds, projectId]);

    // Helper functions to open the modal in different modes
    const openCreateTaskModal = (departmentId: string, departmentName: string, parentTaskId?: string) => {
        setTaskModal({
            isOpen: true,
            mode: 'create',
            departmentId,
            departmentName,
            parentTaskId
        });
    };

    const openEditTaskModal = (task: any) => {
        setTaskModal({
            isOpen: true,
            mode: 'edit',
            task,
            departmentId: task.departmentId,
            departmentName: getDepartmentName(task.departmentId)
        });
    };

    const openAssignTaskModal = (task: any) => {
        setTaskModal({
            isOpen: true,
            mode: 'assign',
            task,
            departmentId: task.departmentId,
            departmentName: getDepartmentName(task.departmentId)
        });
    };

    const closeTaskModal = () => {
        setTaskModal({
            isOpen: false,
            mode: 'create'
        });
    };

    // Centralized task management - set filters and refresh tasks when needed
    useEffect(() => {
        if (!projectId || typeof projectId !== 'string') return;

        let refreshTimer: NodeJS.Timeout;

        try {
            // Set task filters for this project
            setTaskFilters({ projectId });

            // Always refresh tasks when project ID changes or when we have departments available
            const shouldRefresh = departments.length > 0;

            if (shouldRefresh) {
                refreshTimer = setTimeout(() => {
                    try {
                        refreshTasks();
                    } catch (error) {
                        console.error('Error refreshing tasks:', error);
                        toast({
                            variant: "destructive",
                            title: "Error",
                            description: "Failed to refresh tasks"
                        });
                    }
                }, 200);
            }
        } catch (error) {
            console.error('Error in task management effect:', error);
        }

        return () => {
            if (refreshTimer) clearTimeout(refreshTimer);
        };
    }, [projectId, departments.length]);

    // Separate effect to handle task refresh when selected departments change
    useEffect(() => {
        if (selectedDepartments.length > 0 && tasks.length === 0) {
            const refreshTimer = setTimeout(() => {
                try {
                    refreshTasks();
                } catch (error) {
                    console.error('Error refreshing tasks on department change:', error);
                }
            }, 300);

            return () => clearTimeout(refreshTimer);
        }
    }, [selectedDepartments.length, tasks.length]);

    // Initialize selected departments from project
    useEffect(() => {

        // Try different possible field names for departments - prioritize departmentIds for categorization
        let departmentIds: string[] | undefined;

        if (project?.departmentIds && Array.isArray(project.departmentIds) && project.departmentIds.length > 0) {
            // Use departmentIds (preferred for categorization)
            departmentIds = project.departmentIds.map((id: any) => typeof id === 'string' ? id : id.toString());
        } else if (project?.departmentTasks && Array.isArray(project.departmentTasks) && project.departmentTasks.length > 0) {
            // Fallback to departmentTasks structure
            departmentIds = project.departmentTasks.map((deptTask: any) => deptTask.departmentId.toString());
        }

        if (departmentIds && departmentIds.length > 0) {
            const deptSelections: DepartmentSelection[] = departmentIds.map((deptId: string): DepartmentSelection => ({
                departmentId: deptId,
                additionalInfo: ""
            }));

            // Always set both state and form values
            setSelectedDepartments(deptSelections);
            categorizationForm.setValue('departmentIds', departmentIds);

            // Also trigger a task refresh to ensure tasks are loaded
            setTimeout(() => {
                setTaskFilters({ projectId });
                refreshTasks();
            }, 100);

            toast({
                title: "Project Departments Loaded",
                description: `${departmentIds.length} departments loaded for this project`
            });
        } else if (project) {
            // If project has no department info, try to infer from existing tasks
            if (tasks.length > 0) {
                const taskDepartmentIds = [...new Set(
                    tasks
                        .filter(task => task.projectId?.toString() === projectId.toString() && task.departmentId)
                        .map(task => task.departmentId.toString())
                )];

                if (taskDepartmentIds.length > 0) {
                    const inferredDeptSelections: DepartmentSelection[] = taskDepartmentIds.map((deptId: string): DepartmentSelection => ({
                        departmentId: deptId,
                        additionalInfo: ""
                    }));

                    setSelectedDepartments(inferredDeptSelections);
                    categorizationForm.setValue('departmentIds', taskDepartmentIds);

                    toast({
                        title: "Departments Inferred",
                        description: `Found ${taskDepartmentIds.length} departments from existing tasks`,
                        variant: "default"
                    });

                    return; // Exit early since we found departments
                }
            }

            // Fallback: clear state
            setSelectedDepartments([]);
            categorizationForm.setValue('departmentIds', []);
        }
    }, [project, projectId, tasks.length]);

    // Toggle task collapse state
    const toggleTaskCollapse = (taskId: string) => {
        setCollapsedTasks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(taskId)) {
                newSet.delete(taskId);
            } else {
                newSet.add(taskId);
            }
            return newSet;
        });
    };

    // Toggle department collapse state (collapses/expands whole department card body)
    const toggleDepartmentCollapse = (departmentId: string) => {
        setCollapsedDepartments(prev => {
            const newSet = new Set(prev);
            if (newSet.has(departmentId)) {
                newSet.delete(departmentId);
            } else {
                newSet.add(departmentId);
            }
            return newSet;
        });
    };

    // Handle errors from hooks
    useEffect(() => {
        if (departmentsError) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load departments"
            });
        }

        if (tasksError) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load tasks"
            });
        }
    }, [departmentsError, tasksError, toast]);

    // Handle department selection update
    const handleDepartmentSelectionUpdate = async (data: { departmentIds: string[] }) => {
        try {
            setLoading(true);

            console.log('Updating project departments:', data.departmentIds);

            // Update local state immediately to reflect changes
            const updatedDepartments: DepartmentSelection[] = data.departmentIds.map((deptId: string): DepartmentSelection => ({
                departmentId: deptId,
                additionalInfo: ""
            }));
            setSelectedDepartments(updatedDepartments);

            // Update project with selected departments using the singleton pattern
            await updateProject(projectId, {
                departmentIds: data.departmentIds
            });

            // Trigger task refresh after updating departments
            setTaskFilters({ projectId });
            refreshTasks();

            // Trigger callback to refresh parent component
            if (onProjectUpdate) {
                onProjectUpdate();
            }

            toast({
                title: "Success",
                description: `Project departments updated successfully (${data.departmentIds.length} departments selected)`
            });

        } catch (error) {
            console.error('Error updating departments:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to update project departments"
            });
            // Revert local state on error
            if (project?.departmentIds) {
                const revertedDepartments: DepartmentSelection[] = project.departmentIds.map((deptId: string): DepartmentSelection => ({
                    departmentId: deptId,
                    additionalInfo: ""
                }));
                setSelectedDepartments(revertedDepartments);
                categorizationForm.setValue('departmentIds', project.departmentIds);
            }
        } finally {
            setLoading(false);
        }
    };





    // Handle task deletion
    const handleDeleteTask = async (taskId: string) => {
        const result = await Swal.fire({
            customClass: {
                popup: 'swal-bg',
                title: 'swal-title',
                htmlContainer: 'swal-content',
            },
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteTask(taskId);
                refreshTasks();
                if (onProjectUpdate) {
                    onProjectUpdate();
                }

                toast({
                    title: "Success",
                    description: "Task deleted successfully"
                });

            } catch (error) {
                console.error('Error deleting task:', error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to delete task"
                });
            }
        }
    };

    // Get tasks grouped by department (now using memoized data)
    const getTasksByDepartment = (departmentId: string) => {
        if (!departmentId) return [];

        const departmentTasks = tasksByDepartment[departmentId] || [];

        return departmentTasks;
    };

    // Get sub-tasks for a parent task (now using memoized data)
    const getSubTasks = (parentTaskId: string) => {
        if (!parentTaskId) return [];
        return subTasksByParent[parentTaskId] || [];
    };

    // Get department name by ID
    const getDepartmentName = (departmentId: string) => {
        if (!departmentId || !Array.isArray(departments)) {
            return 'Unknown Department';
        }

        try {
            const department = departments.find(d => d?._id === departmentId);
            return department?.name || 'Unknown Department';
        } catch (error) {
            console.error('Error finding department name:', error);
            return 'Unknown Department';
        }
    };

    // Memoized task filtering to prevent recalculation on every render
    const tasksByDepartment = useMemo(() => {
        // Get departments to work with - prioritize form field, then selectedDepartments, then project departments
        let departmentsToUse: DepartmentSelection[] = [];

        // First check form field values (most current)
        const formDepartmentIds = categorizationForm.getValues('departmentIds') || [];
        if (formDepartmentIds.length > 0) {
            departmentsToUse = formDepartmentIds.map((deptId: string) => ({ departmentId: deptId, additionalInfo: "" }));
        } else if (selectedDepartments.length > 0) {
            departmentsToUse = selectedDepartments;
        } else if (project?.departmentIds && Array.isArray(project.departmentIds) && project.departmentIds.length > 0) {
            departmentsToUse = project.departmentIds.map((deptId: string) => ({ departmentId: deptId, additionalInfo: "" }));
        } else if (project?.departments && Array.isArray(project.departments) && project.departments.length > 0) {
            const departmentIds = project.departments.map((dept: any) => typeof dept === 'string' ? dept : dept._id || dept.id);
            departmentsToUse = departmentIds.map((deptId: string) => ({ departmentId: deptId, additionalInfo: "" }));
        } else if (tasks.length > 0 && projectId) {
            // Infer departments from tasks as last resort
            const taskDepartmentIds = [...new Set(
                tasks
                    .filter(task => task.projectId?.toString() === projectId.toString() && task.departmentId)
                    .map(task => task.departmentId.toString())
            )];
            departmentsToUse = taskDepartmentIds.map((deptId: string) => ({ departmentId: deptId, additionalInfo: "" }));
        }

        // Check if we have the new optimized departmentTasks structure
        if (project?.departmentTasks && Array.isArray(project.departmentTasks) && project.departmentTasks.length > 0) {
            // Use the optimized departmentTasks structure directly
            const grouped: { [key: string]: any[] } = {};

            project.departmentTasks.forEach((deptTask: any) => {
                const deptId = deptTask.departmentId?.toString();
                if (deptId && deptTask.tasks && Array.isArray(deptTask.tasks)) {
                    grouped[deptId] = deptTask.tasks; // Tasks already include subtasks
                }
            });

            return grouped;
        }

        // Fallback to hook tasks only (no more project.tasks array)
        let tasksToUse = tasks;

        if (!Array.isArray(tasksToUse) || !projectId || departmentsToUse.length === 0) {
            // Initialize empty arrays for all departments
            const grouped: { [key: string]: any[] } = {};
            departmentsToUse.forEach(({ departmentId }: DepartmentSelection) => {
                grouped[departmentId] = [];
            });
            return grouped;
        }

        try {
            const grouped: { [key: string]: any[] } = {};

            // Initialize with empty arrays for all departments
            departmentsToUse.forEach(({ departmentId }: DepartmentSelection) => {
                grouped[departmentId] = [];
            });

            // Filter and group tasks
            departmentsToUse.forEach(({ departmentId }: DepartmentSelection) => {
                grouped[departmentId] = tasksToUse.filter(task => {
                    if (!task) return false;

                    const taskDeptId = task.departmentId?.toString();
                    const taskProjId = task.projectId?.toString();
                    const targetDeptId = departmentId.toString();
                    const targetProjId = projectId.toString();

                    const matchesDepartment = taskDeptId === targetDeptId;
                    const matchesProject = taskProjId === targetProjId;
                    const isParentTask = !task.parentTaskId;

                    return matchesDepartment && matchesProject && isParentTask;
                });
            });

            return grouped;
        } catch (error) {
            console.error('Error grouping tasks by department:', error);
            // Return empty arrays for all departments even on error
            const grouped: { [key: string]: any[] } = {};
            departmentsToUse.forEach(({ departmentId }: DepartmentSelection) => {
                grouped[departmentId] = [];
            });
            return grouped;
        }
    }, [tasks, project?.departmentTasks, projectId, selectedDepartments, project?.departmentIds, watchedDepartmentIds]);

    // Memoized sub-tasks mapping
    const subTasksByParent = useMemo(() => {
        // Use project.departmentTasks if available for better performance
        if (project?.departmentTasks && Array.isArray(project.departmentTasks) && project.departmentTasks.length > 0) {
            const grouped: { [key: string]: any[] } = {};

            project.departmentTasks.forEach((deptTask: any) => {
                if (deptTask.tasks && Array.isArray(deptTask.tasks)) {
                    deptTask.tasks.forEach((task: any) => {
                        if (task.subTasks && Array.isArray(task.subTasks)) {
                            grouped[task._id.toString()] = task.subTasks;
                        }
                    });
                }
            });

            return grouped;
        }

        // Fallback to hook tasks only (no more project.tasks array)
        const tasksToUse = tasks;

        if (!Array.isArray(tasksToUse)) return {};

        try {
            const grouped: { [key: string]: any[] } = {};

            tasksToUse.forEach(task => {
                if (task?.parentTaskId) {
                    const parentId = task.parentTaskId.toString();
                    if (!grouped[parentId]) {
                        grouped[parentId] = [];
                    }
                    grouped[parentId].push(task);
                }
            });

            return grouped;
        } catch (error) {
            console.error('Error grouping sub-tasks:', error);
            return {};
        }
    }, [tasks, project?.departmentTasks]);

    // Memoized department task status to prevent repeated calculations during render
    const departmentTaskStatus = useMemo(() => {
        const status: { [key: string]: { hasTasks: boolean; taskCount: number } } = {};

        Object.keys(tasksByDepartment).forEach(departmentId => {
            const departmentTasks = tasksByDepartment[departmentId];
            status[departmentId] = {
                hasTasks: departmentTasks.length > 0,
                taskCount: departmentTasks.length
            };
        });

        return status;
    }, [tasksByDepartment]);

    // Check if department has existing tasks (now using memoized data)
    const departmentHasTasks = (departmentId: string) => {
        return departmentTaskStatus[departmentId]?.hasTasks || false;
    };

    // Get department task count (now using memoized data)
    const getDepartmentTaskCount = (departmentId: string) => {
        return departmentTaskStatus[departmentId]?.taskCount || 0;
    };

    // Get departments to display - prioritize form field values, then selectedDepartments, then project departments
    const getDepartmentsToRender = (): DepartmentSelection[] => {
        // First check form field values (most current)
        const formDepartmentIds = categorizationForm.getValues('departmentIds') || [];
        if (formDepartmentIds.length > 0) {
            return formDepartmentIds.map((deptId: string): DepartmentSelection => ({
                departmentId: deptId,
                additionalInfo: ""
            }));
        }

        // Then check selectedDepartments state
        if (selectedDepartments.length > 0) {
            return selectedDepartments;
        }

        // Then fallback to project departments
        if (project) {
            // Try different possible field names for departments
            let departmentIds: string[] | undefined;

            if (project.departmentIds && Array.isArray(project.departmentIds) && project.departmentIds.length > 0) {
                departmentIds = project.departmentIds;
            } else if (project.departments && Array.isArray(project.departments) && project.departments.length > 0) {
                // Handle case where departments are objects with _id field
                departmentIds = project.departments.map((dept: any) => typeof dept === 'string' ? dept : dept._id || dept.id);
            }

            if (departmentIds && departmentIds.length > 0) {
                return departmentIds.map((deptId: string): DepartmentSelection => ({
                    departmentId: deptId,
                    additionalInfo: ""
                }));
            }

            // Last resort: infer from tasks
            if (tasks.length > 0) {
                const taskDepartmentIds = [...new Set(
                    tasks
                        .filter(task => task.projectId?.toString() === projectId.toString() && task.departmentId)
                        .map(task => task.departmentId.toString())
                )];

                if (taskDepartmentIds.length > 0) {
                    return taskDepartmentIds.map((deptId: string): DepartmentSelection => ({
                        departmentId: deptId,
                        additionalInfo: ""
                    }));
                }
            }
        }
        return [];
    };



    // Handle department deselection with confirmation if it has tasks
    const handleDepartmentToggle = async (departmentId: string, currentlySelected: boolean) => {
        if (currentlySelected && departmentHasTasks(departmentId)) {
            const taskCount = getDepartmentTaskCount(departmentId);
            // Department has tasks, show confirmation for deletion
            const result = await Swal.fire({
                customClass: {
                    popup: 'swal-bg',
                    title: 'swal-title',
                    htmlContainer: 'swal-content',
                },
                title: 'Department has existing tasks',
                text: `This department has ${taskCount} task(s) and their subtasks. Removing it will permanently delete all associated tasks and subtasks. This action cannot be undone. Continue?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, delete tasks and remove department'
            });

            if (!result.isConfirmed) {
                return; // User cancelled
            }

            // Delete all tasks for this department and their subtasks
            const tasksToDelete = getTasksByDepartment(departmentId);
            const mainTaskIds = tasksToDelete.map(task => task._id);

            // Find all subtasks that belong to the tasks being deleted
            const subtasksToDelete = tasks.filter(task =>
                task.type === 'sub-task' &&
                task.parentTaskId &&
                mainTaskIds.includes(task.parentTaskId)
            );

            // Delete subtasks first, then main tasks
            const allTasksToDelete = [...subtasksToDelete, ...tasksToDelete];

            for (const task of allTasksToDelete) {
                try {
                    await deleteTask(task._id);
                } catch (error) {
                    console.error('Failed to delete task:', task._id, error);
                    toast({
                        title: "Error",
                        description: `Failed to delete task: ${task.title}`,
                        variant: "destructive",
                    });
                }
            }
        }

        // Toggle department selection
        const currentDepartments = categorizationForm.getValues('departmentIds') || [];
        let updatedDepartments: string[];

        if (currentlySelected) {
            updatedDepartments = currentDepartments.filter((id: string) => id !== departmentId);
            console.log('Deselecting department:', departmentId, 'Updated list:', updatedDepartments);
        } else {
            updatedDepartments = [...currentDepartments, departmentId];
            console.log('Selecting department:', departmentId, 'Updated list:', updatedDepartments);
        }

        // Update form field
        categorizationForm.setValue('departmentIds', updatedDepartments);

        // Update local state to keep it in sync
        const updatedDepartmentSelections: DepartmentSelection[] = updatedDepartments.map((deptId: string): DepartmentSelection => ({
            departmentId: deptId,
            additionalInfo: ""
        }));
        setSelectedDepartments(updatedDepartmentSelections);
    };

    if (departmentsLoading || taskLoading) {
        return (
            <div className="space-y-4">
                <CardLoader />
                <div className="text-center text-muted-foreground flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                    Loading departments and project data...
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Department Selection */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-md bg-primary/10">
                                <Building2 className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-semibold">Departments</CardTitle>
                                <CardDescription className="text-sm">
                                    Select departments for this project
                                </CardDescription>
                            </div>
                        </div>
                        <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                            {(watchedDepartmentIds?.length || 0)} selected
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                    <Form {...categorizationForm}>
                        <form onSubmit={categorizationForm.handleSubmit(handleDepartmentSelectionUpdate)}>
                            <FormField
                                control={categorizationForm.control}
                                name="departmentIds"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                                {departments.map((department) => {
                                                    const isSelected = field.value?.includes(department._id) || false;
                                                    const hasTasks = departmentHasTasks(department._id);
                                                    const taskCount = getDepartmentTaskCount(department._id);

                                                    return (
                                                        <div
                                                            key={department._id}
                                                            className={`group relative p-3 rounded-lg border cursor-pointer transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-lg ${isSelected
                                                                ? 'border-primary bg-primary/8 shadow-md ring-1 ring-primary/20'
                                                                : 'border-border hover:border-primary hover:bg-primary/5 hover:shadow-xl'
                                                                } ${hasTasks ? 'border-border hover:border-primary hover:bg-primary/5 hover:shadow-xl' : ''}`}
                                                            onClick={() => handleDepartmentToggle(department._id, isSelected)}
                                                        >
                                                            {/* Content */}
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                    <div
                                                                        className="w-3 h-3 rounded-full flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md"
                                                                        style={{
                                                                            backgroundColor: hasTasks
                                                                                ? "#FF9800" // orange for departments with tasks
                                                                                : department.color || 'hsl(var(--primary))'
                                                                        }}
                                                                    />
                                                                    <span className="font-medium text-foreground truncate text-sm transition-colors duration-300 group-hover:text-primary">
                                                                        {department.name}
                                                                    </span>
                                                                </div>
                                                                {isSelected && (
                                                                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:text-primary/80" />
                                                                )}
                                                            </div>

                                                            {/* Description (truncated) */}
                                                            {department.description && (
                                                                <HtmlTextRenderer
                                                                    content={department.description}
                                                                    maxLength={120}
                                                                    className="line-clamp-1"
                                                                    fallbackText="No description"
                                                                    showFallback={true}
                                                                    renderAsHtml={false}
                                                                    truncateHtml={true}
                                                                />
                                                            )}

                                                            {/* Bottom info */}
                                                            <div className="flex items-center justify-between text-xs">
                                                                {hasTasks ? (
                                                                    <Badge variant="outline" className="h-4 px-1.5 text-xs bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800">
                                                                        {taskCount} task{taskCount !== 1 ? 's' : ''}
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-muted-foreground">No tasks</span>
                                                                )}

                                                                {isSelected && (
                                                                    <span className="text-primary font-medium">Selected</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex items-center justify-end mt-4 pt-3 border-t">
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={loading || (watchedDepartmentIds?.length || 0) === 0}
                                >
                                    {loading ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                                            Updating...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="h-4 w-4 mr-1" />
                                            Select Departments for Categorization
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>



            {/* Tasks by Department */}
            {(getDepartmentsToRender().length > 0 || (tasks.length > 0 && tasks.some(t => t.projectId?.toString() === projectId.toString()))) && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Tasks by Department</h3>
                        <div className="flex items-center gap-2">

                            <div className="text-xs text-muted-foreground">
                                Total: {tasks.length} tasks | Project: {tasks.filter(t => t.projectId?.toString() === projectId.toString()).length}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setTaskFilters({ projectId });
                                    refreshTasks();
                                }}
                                disabled={taskLoading}
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh Tasks
                            </Button>
                        </div>
                    </div>

                    {/* No departments selected message */}
                    {getDepartmentsToRender().length === 0 ? (
                        <Card className="border-dashed border-2 border-muted-foreground/20">
                            <CardContent className="p-8 text-center">
                                <div className="flex flex-col items-center">
                                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                                        <Building2 className="h-6 w-6 text-muted-foreground/60" />
                                    </div>
                                    <h3 className="font-semibold mb-2 text-foreground">No Departments Selected</h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Select departments above to organize and manage tasks.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        getDepartmentsToRender().map(({ departmentId }: DepartmentSelection) => {
                            const departmentTasks = getTasksByDepartment(departmentId);
                            const departmentName = getDepartmentName(departmentId);
                            console.log("collapsedDepartments:860", collapsedDepartments);
                            const isDeptCollapsed = collapsedDepartments.has(departmentId);

                            return (
                                <Card key={departmentId} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
                                    <CardHeader className="border-b border-border/50 py-2 px-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-primary/10">
                                                    <Building2 className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-lg font-bold text-foreground">
                                                        {departmentName}
                                                    </CardTitle>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="secondary" className="bg-primary/10 text-primary text-xs h-5">
                                                            {departmentTasks.length} {departmentTasks.length === 1 ? 'task' : 'tasks'}
                                                        </Badge>
                                                        {departmentTasks.length > 0 && (
                                                            <>
                                                                <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950 text-xs h-5">
                                                                    {departmentTasks.filter(t => t.status === 'completed').length} done
                                                                </Badge>
                                                                <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950 text-xs h-5">
                                                                    {departmentTasks.filter(t => t.status === 'in-progress').length} active
                                                                </Badge>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {canCreate("tasks") && (
                                                    <Button
                                                        onClick={() => openCreateTaskModal(departmentId, departmentName)}
                                                        size="sm"
                                                        className="shadow-sm"
                                                    >
                                                        <Plus className="h-4 w-4 mr-1" />
                                                        New Task
                                                    </Button>
                                                )}
                                                {/* Department collapse/expand button */}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0"
                                                    onClick={() => toggleDepartmentCollapse(departmentId)}
                                                >
                                                    {isDeptCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        {isDeptCollapsed ? (
                                            <div className="p-4 flex items-center justify-between text-sm text-muted-foreground">
                                                <div>
                                                    <span className="font-medium">{departmentTasks.length}</span> {departmentTasks.length === 1 ? 'task' : 'tasks'}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="bg-primary/10 text-primary text-xs h-5">
                                                        {departmentTasks.filter(t => t.status === 'completed').length} done
                                                    </Badge>
                                                    <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950 text-xs h-5">
                                                        {departmentTasks.filter(t => t.status === 'in-progress').length} active
                                                    </Badge>
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleDepartmentCollapse(departmentId)}>
                                                        <ChevronUp className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            departmentTasks.length === 0 ? (
                                                <div className="text-center py-8 px-4 text-muted-foreground">
                                                    <div className="flex flex-col items-center">
                                                        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                                                            <CheckSquare className="h-6 w-6 opacity-50" />
                                                        </div>
                                                        <h3 className="font-medium mb-1">No tasks yet</h3>
                                                        <p className="text-sm">Create your first task to get started.</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="p-4 space-y-3">
                                                    {departmentTasks.map((task) => {
                                                        const subTasks = getSubTasks(task._id);
                                                        const completedSubTasks = subTasks.filter(st => st.status === 'completed').length;
                                                        const progressPercentage = subTasks.length > 0 ? Math.round((completedSubTasks / subTasks.length) * 100) : 0;
                                                        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

                                                        const statusColors = {
                                                            pending: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
                                                            'in-progress': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
                                                            completed: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
                                                            'on-hold': 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                                                        };

                                                        const priorityColors = {
                                                            low: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/10 dark:text-green-400 dark:border-green-800',
                                                            medium: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/10 dark:text-yellow-400 dark:border-yellow-800',
                                                            high: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/10 dark:text-orange-400 dark:border-orange-800',
                                                            urgent: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800'
                                                        };

                                                        const isCollapsed = collapsedTasks.has(task._id);

                                                        return (
                                                            <Card key={task._id} className="group transition-all duration-200 hover:shadow-sm border-l-2 border-l-muted-foreground/20 hover:border-l-primary/60">
                                                                <CardContent className="p-4">
                                                                    {/* Compact Task Header */}
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                            {/* Status Dot */}
                                                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.status === 'completed' ? 'bg-emerald-500' :
                                                                                task.status === 'in-progress' ? 'bg-blue-500' :
                                                                                    task.status === 'on-hold' ? 'bg-amber-500' :
                                                                                        'bg-slate-400'
                                                                                }`} />

                                                                            {/* Title and Quick Info */}
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    <h4 className="font-medium text-foreground truncate">{task.title}</h4>
                                                                                    {isOverdue && (
                                                                                        <Badge variant="destructive" className="text-xs h-5">
                                                                                            Overdue
                                                                                        </Badge>
                                                                                    )}
                                                                                </div>

                                                                                {/* Compact Badges */}
                                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                                    <Badge className={`text-xs h-5 ${statusColors[task.status as keyof typeof statusColors] || statusColors.pending}`}>
                                                                                        {task.status?.replace('-', ' ') || 'pending'}
                                                                                    </Badge>
                                                                                    <Badge variant="outline" className={`text-xs h-5 ${priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.medium}`}>
                                                                                        {task.priority || 'medium'}
                                                                                    </Badge>
                                                                                    {task.assigneeId && (
                                                                                        <Badge variant="outline" className="text-xs h-5">
                                                                                            <UserIcon className="h-3 w-3 mr-1" />
                                                                                            {task.assignee?.name || 'Assigned'}
                                                                                        </Badge>
                                                                                    )}
                                                                                    {task.dueDate && (
                                                                                        <Badge variant="outline" className="text-xs h-5">
                                                                                            <Calendar className="h-3 w-3 mr-1" />
                                                                                            {new Date(task.dueDate).toLocaleDateString()}
                                                                                        </Badge>
                                                                                    )}
                                                                                    {subTasks.length > 0 && (
                                                                                        <Badge variant="outline" className="text-xs h-5">
                                                                                            <CheckSquare className="h-3 w-3 mr-1" />
                                                                                            {completedSubTasks}/{subTasks.length}
                                                                                        </Badge>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Action Buttons */}
                                                                        <div className="flex items-center gap-1">
                                                                            {/* Add Sub-task Button */}
                                                                            {canCreate("tasks") && (
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    className="h-7 w-full"
                                                                                    onClick={() => openCreateTaskModal(departmentId, departmentName, task._id)}
                                                                                >
                                                                                    <Plus className="h-3 w-3 mr-1" />
                                                                                    Add Subtask
                                                                                </Button>
                                                                            )}
                                                                            {subTasks.length > 0 && (
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    onClick={() => toggleTaskCollapse(task._id)}
                                                                                    className="h-7 w-7 p-0"
                                                                                >
                                                                                    {isCollapsed ?
                                                                                        <ChevronDown className="h-4 w-4" /> :
                                                                                        <ChevronUp className="h-4 w-4" />
                                                                                    }
                                                                                </Button>
                                                                            )}

                                                                            <DropdownMenu>
                                                                                <DropdownMenuTrigger asChild>
                                                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                                    </Button>
                                                                                </DropdownMenuTrigger>
                                                                                <DropdownMenuContent align="end">
                                                                                    <DropdownMenuItem onClick={() => {
                                                                                        setSelectedTaskForDetails(task);
                                                                                        setShowTaskDetails(true);
                                                                                    }}>
                                                                                        <Eye className="h-4 w-4 mr-2" />
                                                                                        View Details
                                                                                    </DropdownMenuItem>
                                                                                    <DropdownMenuItem onClick={() => openAssignTaskModal(task)}>
                                                                                        <UserIcon className="h-4 w-4 mr-2" />
                                                                                        Assign
                                                                                    </DropdownMenuItem>
                                                                                    {canUpdate("tasks") && (
                                                                                        <DropdownMenuItem onClick={() => openEditTaskModal(task)}>
                                                                                            <Edit className="h-4 w-4 mr-2" />
                                                                                            Edit
                                                                                        </DropdownMenuItem>
                                                                                    )}
                                                                                    <DropdownMenuSeparator />
                                                                                    {canDelete("tasks") && (
                                                                                        <DropdownMenuItem
                                                                                            onClick={() => handleDeleteTask(task._id)}
                                                                                            className="text-red-600 focus:text-red-600"
                                                                                        >
                                                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                                                            Delete
                                                                                        </DropdownMenuItem>
                                                                                    )}
                                                                                </DropdownMenuContent>
                                                                            </DropdownMenu>
                                                                        </div>
                                                                    </div>

                                                                    {/* Description (if present and not collapsed) */}
                                                                    {!isCollapsed && task.description && (
                                                                        <div className="mt-3 pl-5">
                                                                            <HtmlTextRenderer
                                                                                content={task.description}
                                                                                maxLength={120}
                                                                                className="line-clamp-3"
                                                                                fallbackText="No description"
                                                                                showFallback={true}
                                                                                renderAsHtml={true}
                                                                                truncateHtml={true}
                                                                            />
                                                                        </div>
                                                                    )}

                                                                    {/* Sub-tasks */}
                                                                    {subTasks.length > 0 && !isCollapsed && (
                                                                        <div className="mt-3 pl-5 border-l border-border/30">
                                                                            <div className="space-y-1">
                                                                                {subTasks.map((subTask, index) => (
                                                                                    <div key={subTask._id} className="flex items-center justify-between p-2 rounded bg-muted/30 hover:bg-muted/50 transition-colors group">
                                                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${subTask.status === 'completed' ? 'bg-emerald-500' :
                                                                                                subTask.status === 'in-progress' ? 'bg-blue-500' :
                                                                                                    subTask.status === 'on-hold' ? 'bg-amber-500' :
                                                                                                        'bg-slate-400'
                                                                                                }`} />
                                                                                            <span className="text-sm font-medium truncate">{subTask.title}</span>
                                                                                            <div className="flex items-center gap-1">
                                                                                                <Badge className={`text-xs h-4 px-1 ${statusColors[subTask.status as keyof typeof statusColors] || statusColors.pending}`}>
                                                                                                    {subTask.status?.replace('-', ' ') || 'pending'}
                                                                                                </Badge>
                                                                                                {subTask.priority !== 'medium' && (
                                                                                                    <Badge variant="outline" className={`text-xs h-4 px-1 ${priorityColors[subTask.priority as keyof typeof priorityColors] || priorityColors.medium}`}>
                                                                                                        {subTask.priority}
                                                                                                    </Badge>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>

                                                                                        <DropdownMenu>
                                                                                            <DropdownMenuTrigger asChild>
                                                                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                                    <MoreHorizontal className="h-3 w-3" />
                                                                                                </Button>
                                                                                            </DropdownMenuTrigger>
                                                                                            <DropdownMenuContent align="end">
                                                                                                <DropdownMenuItem onClick={() => {
                                                                                                    setSelectedTaskForDetails(subTask);
                                                                                                    setShowTaskDetails(true);
                                                                                                }}>
                                                                                                    <Eye className="h-3 w-3 mr-2" />
                                                                                                    View
                                                                                                </DropdownMenuItem>
                                                                                                <DropdownMenuItem onClick={() => openAssignTaskModal(subTask)}>
                                                                                                    <UserIcon className="h-3 w-3 mr-2" />
                                                                                                    Assign
                                                                                                </DropdownMenuItem>
                                                                                                <DropdownMenuItem onClick={() => openEditTaskModal(subTask)}>
                                                                                                    <Edit className="h-3 w-3 mr-2" />
                                                                                                    Edit
                                                                                                </DropdownMenuItem>
                                                                                                <DropdownMenuSeparator />
                                                                                                <DropdownMenuItem
                                                                                                    onClick={() => handleDeleteTask(subTask._id)}
                                                                                                    className="text-red-600 focus:text-red-600"
                                                                                                >
                                                                                                    <Trash2 className="h-3 w-3 mr-2" />
                                                                                                    Delete
                                                                                                </DropdownMenuItem>
                                                                                            </DropdownMenuContent>
                                                                                        </DropdownMenu>
                                                                                    </div>
                                                                                ))}


                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </CardContent>
                                                            </Card>
                                                        );
                                                    })}
                                                </div>
                                            )
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>
            )}

            {/* Unified Task Modal for Create, Edit, and Assignment */}
            <TaskModal
                isOpen={taskModal.isOpen}
                onClose={closeTaskModal}
                mode={taskModal.mode}
                task={taskModal.task}
                projectId={projectId}
                departmentId={taskModal.departmentId || ''}
                selectedDepartmentName={taskModal.departmentName}
                parentTaskId={taskModal.parentTaskId}
                onSuccess={() => {
                    refreshTasks();
                    if (onProjectUpdate) {
                        onProjectUpdate();
                    }
                }}
            />

            {/* Task Details Modal */}
            {showTaskDetails && selectedTaskForDetails && (
                <CustomModal
                    isOpen={showTaskDetails}
                    onClose={() => {
                        setShowTaskDetails(false);
                        setSelectedTaskForDetails(null);
                    }}
                    title={selectedTaskForDetails.title}
                    modalSize="xl"
                >
                    <div className="space-y-6">
                        {/* Task Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Status</Label>
                                <Badge className="ml-2">{selectedTaskForDetails.status}</Badge>
                            </div>
                            <div>
                                <Label>Priority</Label>
                                <Badge className="ml-2" variant="outline">{selectedTaskForDetails.priority}</Badge>
                            </div>
                            <div>
                                <Label>Department</Label>
                                <p className="text-sm">{getDepartmentName(selectedTaskForDetails.departmentId)}</p>
                            </div>
                            <div>
                                <Label>Assignee</Label>
                                <p className="text-sm">{selectedTaskForDetails.assignee?.name || 'Unassigned'}</p>
                            </div>
                        </div>

                        {selectedTaskForDetails.description && (
                            <div>
                                <Label>Description</Label>
                                <HtmlTextRenderer
                                    content={selectedTaskForDetails.description}
                                    maxLength={120}
                                    className="line-clamp-3"
                                    fallbackText="No description"
                                    showFallback={true}
                                    renderAsHtml={true}
                                    truncateHtml={true}
                                />
                            </div>
                        )}

                        {/* Comments Section */}
                        <TaskCommentsSection
                            taskId={selectedTaskForDetails._id}
                            projectId={projectId}
                            departmentId={selectedTaskForDetails.departmentId}
                        />

                        {/* Time Tracking Section */}
                        <TimeTrackingSection
                            taskId={selectedTaskForDetails._id}
                            projectId={projectId}
                            estimatedHours={selectedTaskForDetails.estimatedHours}
                            currentActualHours={selectedTaskForDetails.actualHours}
                        />
                    </div>
                </CustomModal>
            )}
        </div>
    );
}   