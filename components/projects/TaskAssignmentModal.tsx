"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/generic-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import CustomModal from "@/components/ui/custom-modal";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { User, Calendar, Clock, AlertCircle, CheckCircle2, Briefcase, Target } from "lucide-react";
import { useUsers } from "@/hooks/use-users";
import { useTasks } from "@/hooks/use-tasks";
import { Task } from "@/types";
import { useToast } from "@/hooks/use-toast";

const taskAssignmentSchema = z.object({
  assigneeId: z.string().min(1, "Please select an assignee"),
  notes: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueDate: z.string().optional(),
});

type TaskAssignmentFormData = z.infer<typeof taskAssignmentSchema>;

interface TaskAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  departmentId: string;
  onAssignmentComplete?: () => void;
}

export function TaskAssignmentModal({
  isOpen,
  onClose,
  task,
  departmentId,
  onAssignmentComplete
}: TaskAssignmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const { users } = useUsers();
  const { assignTask, updateTask } = useTasks();
  const { toast } = useToast();

  const form = useForm<TaskAssignmentFormData>({
    resolver: zodResolver(taskAssignmentSchema),
    defaultValues: {
      assigneeId: task?.assigneeId || "",
      notes: "",
      priority: task?.priority || "medium",
      dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : "",
    },
  });

  // Simple department user filtering - no duplicates, no complex grouping
  const departmentUsers = React.useMemo(() => {
    console.log('TaskAssignmentModal - Simple filtering:');
    console.log('departmentId:', departmentId);
    console.log('Available users:', users.length);

    // Use Map to ensure uniqueness by user ID
    const uniqueUsers = new Map();
    
    users.forEach(user => {
      // Skip if user has no ID or is not active
      if (!user._id || user.status !== 'active') return;
      
      const userDeptId = typeof user.department === 'string' ? user.department : user.department?._id;
      const matches = userDeptId === departmentId;
      
      if (matches && !uniqueUsers.has(user._id)) {
        uniqueUsers.set(user._id, user);
        console.log('Added user:', user.name, 'Email:', user.email, 'Department ID:', userDeptId);
      }
    });

    const result = Array.from(uniqueUsers.values());
    console.log('Final unique users:', result.length);
    
    return result;
  }, [users, departmentId]);

  const handleAssign = async (data: TaskAssignmentFormData) => {
    if (!task) return;

    setLoading(true);
    try {
      // If this is a reassignment or new assignment
      await assignTask(task._id!, data.assigneeId);

      // Update task with additional details if provided
      const updateData: any = {};
      if (data.priority && data.priority !== task.priority) {
        updateData.priority = data.priority;
      }
      if (data.dueDate && data.dueDate !== task.dueDate) {
        updateData.dueDate = data.dueDate;
      }

      if (Object.keys(updateData).length > 0) {
        await updateTask(task._id!, updateData);
      }

      toast({
        title: "Task Assigned Successfully",
        description: `Task "${task.title}" has been assigned to ${departmentUsers.find(u => u._id === data.assigneeId)?.name}`,
      });

      onAssignmentComplete?.();
      onClose();
    } catch (error: any) {
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign task",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async () => {
    if (!task) return;

    setLoading(true);
    try {
      await assignTask(task._id!, ""); // Empty string to unassign

      toast({
        title: "Task Unassigned",
        description: `Task "${task.title}" has been unassigned`,
      });

      onAssignmentComplete?.();
      onClose();
    } catch (error: any) {
      toast({
        title: "Unassignment Failed",
        description: error.message || "Failed to unassign task",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!task) return null;

  const priorityConfig = {
    low: { color: 'bg-blue-100 text-blue-800', icon: Clock },
    medium: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    high: { color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
    urgent: { color: 'bg-red-100 text-red-800', icon: AlertCircle }
  };

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title="Task Assignment"
      modalSize="lg"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b">
          <div className="p-2 bg-primary/10 rounded-lg">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Task Assignment</h3>
            <p className="text-sm text-muted-foreground">Assign task to team member</p>
          </div>
        </div>
        {/* Task Overview Card */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h4 className="font-semibold text-lg flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  {task.title}
                </h4>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    className={`${priorityConfig[task.priority as keyof typeof priorityConfig]?.color} border-0`}
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {task.priority?.charAt(0).toUpperCase() + task.priority?.slice(1)}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {task.type === 'task' ? 'Main Task' : 'Sub Task'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          {task.description && (
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {task.description.length > 150
                  ? `${task.description.substring(0, 150)}...`
                  : task.description
                }
              </p>
            </CardContent>
          )}
        </Card>

        {/* Current Assignment */}
        {task.assigneeId && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Currently Assigned</p>
                    <p className="text-blue-700">{task.assignee?.name || "Unknown User"}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUnassign}
                  disabled={loading}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Unassign
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Assignment Form */}
        <Card>
          <CardHeader>
            <h4 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Assignment Details
            </h4>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleAssign)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="assigneeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">Assign to Team Member</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={departmentUsers.map((user) => ({
                            label: `${user.name} (${user.email})`,
                            value: user._id!
                          }))}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder={departmentUsers.length === 0 
                            ? "No team members available" 
                            : "Search and select team member..."
                          }
                          disabled={departmentUsers.length === 0 || loading}
                          loading={loading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium">Priority Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Set task priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low" className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                <span>Low Priority</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="medium" className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                                <span>Medium Priority</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="high" className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-orange-500 rounded-full" />
                                <span>High Priority</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="urgent" className="p-3">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-3 w-3 text-red-500" />
                                <span className="text-red-600 font-medium">Urgent</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium">Due Date</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <input
                              type="date"
                              {...field}
                              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">Assignment Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add specific instructions, context, or requirements for the assignee..."
                          {...field}
                          rows={4}
                          className="resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={onClose} className="min-w-24">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || departmentUsers.length === 0}
                    className="min-w-32"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Assigning...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {task.assigneeId ? "Reassign Task" : "Assign Task"}
                      </>
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