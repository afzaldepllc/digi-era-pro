"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/generic-form";
import CustomModal from "@/components/ui/custom-modal";
import RichTextEditor from "@/components/ui/rich-text-editor";
import HtmlTextRenderer from "@/components/ui/html-text-renderer";
import { useUsers } from '@/hooks/use-users';
import { useTasks } from '@/hooks/use-tasks';
import { useToast } from '@/hooks/use-toast';
import { createTaskFormSchema, updateTaskFormSchema, CreateTaskFormData } from '@/lib/validations/task';
import { User as UserType, Task, CreateTaskData, UpdateTaskData } from '@/types';
import { Clock, AlertCircle, User, CheckCircle2, Edit2, UserPlus } from "lucide-react";

type TaskModalMode = 'create' | 'edit' | 'assign';

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: TaskModalMode;
    task?: Task | null;
    projectId: string;
    departmentId: string;
    selectedDepartmentName?: string;
    parentTaskId?: string;
    onSuccess?: () => void;
}

export function TaskModal({
    isOpen,
    onClose,
    mode,
    task,
    projectId,
    departmentId,
    selectedDepartmentName,
    parentTaskId,
    onSuccess
}: TaskModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = React.useState(false);
    const { users } = useUsers();
    const { createTask, updateTask, assignTask } = useTasks();

    // Form schema based on mode
    const getFormSchema = () => {
        if (mode === 'create') return createTaskFormSchema;
        return updateTaskFormSchema;
    };

    // Form setup
    const form = useForm<CreateTaskFormData>({
        mode: 'onSubmit',
        resolver: zodResolver(getFormSchema()),
        defaultValues: {
            title: "",
            description: "",
            projectId,
            departmentId,
            type: parentTaskId ? "sub-task" : "task",
            priority: "medium",
            parentTaskId: parentTaskId || "",
            assigneeId: "",
            dueDate: "",
            estimatedHours: "",
        },
    });

    // Reset form when modal opens/closes or mode changes
    useEffect(() => {
        if (isOpen) {
            if (mode === 'create') {
                form.reset({
                    title: "",
                    description: "",
                    projectId,
                    departmentId,
                    type: parentTaskId ? "sub-task" : "task",
                    priority: "medium",
                    parentTaskId: parentTaskId || "",
                    assigneeId: "",
                    dueDate: "",
                    estimatedHours: "",
                });
            } else if (mode === 'edit' && task) {
                form.reset({
                    title: task.title,
                    description: task.description || "",
                    projectId: task.projectId,
                    departmentId: task.departmentId,
                    type: task.type,
                    priority: task.priority,
                    parentTaskId: task.parentTaskId || "",
                    assigneeId: task.assigneeId || "",
                    dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : "",
                    estimatedHours: task.estimatedHours ? task.estimatedHours.toString() : "",
                });
            } else if (mode === 'assign' && task) {
                form.reset({
                    title: task.title,
                    description: task.description || "",
                    projectId: task.projectId,
                    departmentId: task.departmentId,
                    type: task.type,
                    priority: task.priority,
                    parentTaskId: task.parentTaskId || "",
                    assigneeId: task.assigneeId || "",
                    dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : "",
                    estimatedHours: task.estimatedHours ? task.estimatedHours.toString() : "",
                });
            }
        } else {
            form.reset();
        }
    }, [isOpen, mode, task, projectId, departmentId, parentTaskId, form]);

    // Get department users for assignment - simplified approach
    const departmentUsers = React.useMemo(() => {
        // Use the task's departmentId for edit and assign modes to ensure consistency
        const targetDepartmentId = (mode === 'edit' || mode === 'assign') && task ? task.departmentId : departmentId;

        console.log('TaskModal - Simple user filtering:', {
            mode,
            targetDepartmentId,
            totalUsers: users.length
        });

        const result = users.filter(user => user.department?._id === targetDepartmentId && user.status === 'active');
        console.log('Final unique users for TaskModal:', result.length);
        
        return result;
    }, [users, departmentId, mode, task]);
    console.log('Actual Users148:', users);
    console.log('TaskModal Render - departmentUsers count: 148', departmentUsers);
    // Handle form submission
    const handleSubmit = async (data: CreateTaskFormData) => {
        setLoading(true);
        try {
            if (mode === 'create') {
                // Transform form data to match API expectations for create
                const transformedData: CreateTaskData = {
                    title: data.title,
                    description: data.description,
                    projectId: data.projectId,
                    departmentId: data.departmentId,
                    parentTaskId: data.parentTaskId || undefined,
                    assigneeId: data.assigneeId === 'unassigned' ? undefined : data.assigneeId,
                    status: data.status,
                    priority: data.priority,
                    type: data.type,
                    // Convert string fields to numbers where needed
                    estimatedHours: data.estimatedHours ? parseFloat(data.estimatedHours) : undefined,
                    actualHours: data.actualHours ? parseFloat(data.actualHours) : undefined,
                    // Convert date strings to Date objects
                    startDate: data.startDate ? new Date(data.startDate) : undefined,
                    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
                };
                
                await createTask(transformedData);
                toast({
                    title: "Task Created",
                    description: `${data.type === 'task' ? 'Task' : 'Sub-task'} "${data.title}" has been created successfully.`,
                });
            } else if (mode === 'edit' && task) {
                // Transform form data to match API expectations for update
                const transformedData: UpdateTaskData = {
                    title: data.title,
                    description: data.description,
                    projectId: data.projectId,
                    departmentId: data.departmentId,
                    parentTaskId: data.parentTaskId || undefined,
                    assigneeId: data.assigneeId === 'unassigned' ? undefined : data.assigneeId,
                    status: data.status,
                    priority: data.priority,
                    type: data.type,
                    // Convert string fields to numbers where needed
                    estimatedHours: data.estimatedHours ? parseFloat(data.estimatedHours) : undefined,
                    actualHours: data.actualHours ? parseFloat(data.actualHours) : undefined,
                    // Convert date strings to Date objects
                    startDate: data.startDate ? new Date(data.startDate) : undefined,
                    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
                };

                await updateTask(task._id!, transformedData);
                toast({
                    title: "Task Updated",
                    description: `Task "${data.title}" has been updated successfully.`,
                });
            } else if (mode === 'assign' && task) {
                if (data.assigneeId && data.assigneeId !== 'unassigned' && data.assigneeId !== task.assigneeId) {
                    await assignTask(task._id!, data.assigneeId);
                    const assigneeName = departmentUsers.find(u => u._id === data.assigneeId)?.name || 'Unknown';
                    toast({
                        title: "Task Assigned",
                        description: `Task "${task.title}" has been assigned to ${assigneeName}.`,
                    });
                } else if (data.assigneeId === 'unassigned' && task.assigneeId) {
                    await assignTask(task._id!, ""); // Unassign
                    toast({
                        title: "Task Unassigned",
                        description: `Task "${task.title}" has been unassigned.`,
                    });
                }
            }

            onSuccess?.();
            onClose();
        } catch (error: any) {
            toast({
                title: `${mode === 'create' ? 'Creation' : mode === 'edit' ? 'Update' : 'Assignment'} Failed`,
                description: error.message || `Failed to ${mode} task`,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    // Get modal title and icon
    const getModalTitle = () => {
        if (mode === 'create') {
            const taskType = form.watch('type') === 'sub-task' ? 'Sub-Task' : 'Task';
            return `Create New ${taskType}`;
        } else if (mode === 'edit') {
            const taskType = task?.type === 'sub-task' ? 'Sub-Task' : 'Task';
            return `Edit ${taskType}`;
        } else {
            return 'Assign Task';
        }
    };

    const getModalIcon = () => {
        if (mode === 'create') return CheckCircle2;
        if (mode === 'edit') return Edit2;
        return UserPlus;
    };

    // Check if fields should be disabled
    const isFieldDisabled = (fieldName: string) => {
        if (mode === 'assign') {
            return fieldName !== 'assigneeId';
        }
        return false;
    };

    const priorityConfig = {
        low: { color: 'bg-blue-100 text-blue-800', icon: Clock },
        medium: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
        high: { color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
        urgent: { color: 'bg-red-100 text-red-800', icon: AlertCircle }
    };

    const Icon = getModalIcon();

    return (
        <CustomModal
            isOpen={isOpen}
            onClose={onClose}
            title={getModalTitle()}
            modalSize="lg"
        >
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3 pb-4 border-b">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">{getModalTitle()}</h3>
                        <p className="text-sm text-muted-foreground">
                            {mode === 'create' && `Create a new ${form.watch('type') === 'sub-task' ? 'sub-task' : 'task'} for ${selectedDepartmentName}`}
                            {mode === 'edit' && `Edit task details and properties`}
                            {mode === 'assign' && `Assign task to team member in ${selectedDepartmentName}`}
                        </p>
                    </div>
                </div>

                {/* Task Overview Card (for edit and assign modes) */}
                {(mode === 'edit' || mode === 'assign') && task && (
                    <Card className="border-l-4 border-l-primary">
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <CardTitle className="text-base">{task.title}</CardTitle>
                                    <div className="flex items-center gap-2">
                                        <Badge 
                                            className={`text-xs ${priorityConfig[task.priority as keyof typeof priorityConfig]?.color}`}
                                        >
                                            {task.priority}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs">
                                            {task.status}
                                        </Badge>
                                        <Badge variant="secondary" className="text-xs">
                                            {task.type}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        {task.description && (
                            <CardContent className="pt-0">
                                <HtmlTextRenderer
                                    content={task.description}
                                    maxLength={120}
                                    className="text-sm text-muted-foreground leading-relaxed"
                                    fallbackText="No description"
                                    showFallback={false}
                                    renderAsHtml={true}
                                    truncateHtml={true}
                                />
                            </CardContent>
                        )}
                    </Card>
                )}

                {/* Current Assignment (for assign mode only) */}
                {mode === 'assign' && task?.assigneeId && (
                    <Card className="border-blue-200 bg-blue-50/50">
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-full">
                                        <User className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">Currently Assigned To</p>
                                        <p className="text-blue-600 font-medium">
                                            {departmentUsers.find(u => u._id === task.assigneeId)?.name || 'Unknown User'}
                                        </p>
                                    </div>
                                </div>
                                <Badge className="bg-blue-100 text-blue-800">
                                    Current Assignee
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Form */}
                <Card>
                    <CardContent className="pt-6">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                                <div className="grid grid-cols-1 gap-4">
                                    {/* Title Field */}
                                    <FormField
                                        control={form.control}
                                        name="title"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Task Title</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        placeholder="Enter task title" 
                                                        disabled={isFieldDisabled('title')}
                                                        {...field} 
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Description Field */}
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Description</FormLabel>
                                                <FormControl>
                                                    <RichTextEditor
                                                        value={field.value || ''}
                                                        onChange={field.onChange}
                                                        placeholder="Task description (optional)"
                                                        disabled={loading || isFieldDisabled('description')}
                                                        height="100px"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Priority Field */}
                                        <FormField
                                            control={form.control}
                                            name="priority"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Priority</FormLabel>
                                                    <FormControl>
                                                        <SearchableSelect
                                                            options={[
                                                                { label: "Low Priority", value: "low" },
                                                                { label: "Medium Priority", value: "medium" },
                                                                { label: "High Priority", value: "high" },
                                                                { label: "Urgent Priority", value: "urgent" }
                                                            ]}
                                                            value={field.value}
                                                            onValueChange={field.onChange}
                                                            placeholder="Select priority..."
                                                            disabled={isFieldDisabled('priority')}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {/* Assignee Field */}
                                        <FormField
                                            control={form.control}
                                            name="assigneeId"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {mode === 'assign' ? 'Assignee' : 'Assignee (Optional)'}
                                                        {mode === 'assign' && <span className="text-red-500 ml-1">*</span>}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <SearchableSelect
                                                            options={[
                                                                { label: "No assignee", value: "unassigned" },
                                                                ...departmentUsers.map((user: UserType) => ({
                                                                    label: `${user.name} (${user.email})`,
                                                                    value: user._id!
                                                                }))
                                                            ]}
                                                            value={field.value || "unassigned"}
                                                            onValueChange={field.onChange}
                                                            placeholder="Search and select assignee..."
                                                            disabled={isFieldDisabled('assigneeId')}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    {/* Date Fields - Only for create and edit modes */}
                                    {mode !== 'assign' && (
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Due Date Field */}
                                            <FormField
                                                control={form.control}
                                                name="dueDate"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Due Date (Optional)</FormLabel>
                                                        <FormControl>
                                                            <Input 
                                                                type="date"
                                                                {...field}
                                                                disabled={isFieldDisabled('dueDate')}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            {/* Estimated Hours Field */}
                                            <FormField
                                                control={form.control}
                                                name="estimatedHours"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Estimated Hours (Optional)</FormLabel>
                                                        <FormControl>
                                                            <Input 
                                                                type="number"
                                                                min="0"
                                                                step="0.5"
                                                                placeholder="0"
                                                                {...field}
                                                                disabled={isFieldDisabled('estimatedHours')}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}

                                    {/* Type Field - Hidden but needed for validation */}
                                    <FormField
                                        control={form.control}
                                        name="type"
                                        render={({ field }) => (
                                            <input type="hidden" {...field} />
                                        )}
                                    />

                                    {/* Project and Department IDs - Hidden but needed for validation */}
                                    <FormField
                                        control={form.control}
                                        name="projectId"
                                        render={({ field }) => (
                                            <input type="hidden" {...field} />
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="departmentId"
                                        render={({ field }) => (
                                            <input type="hidden" {...field} />
                                        )}
                                    />

                                    {/* Parent Task ID - Hidden but needed for sub-tasks */}
                                    {parentTaskId && (
                                        <FormField
                                            control={form.control}
                                            name="parentTaskId"
                                            render={({ field }) => (
                                                <input type="hidden" {...field} />
                                            )}
                                        />
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex justify-end gap-2 pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={onClose}
                                        disabled={loading}
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        type="submit" 
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            mode === 'create' ? "Creating..." : 
                                            mode === 'edit' ? "Updating..." : 
                                            "Assigning..."
                                        ) : (
                                            mode === 'create' ? `Create ${form.watch('type') === 'sub-task' ? 'Sub-Task' : 'Task'}` :
                                            mode === 'edit' ? "Update Task" :
                                            "Assign Task"
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </CustomModal>
    );
}