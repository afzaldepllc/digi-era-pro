"use client";

import { useState, useMemo } from "react";
import { useTasks } from "@/hooks/use-tasks";
import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckSquare, CheckCircle2, Clock } from "lucide-react";
import { Project, Department, Task } from '@/types';
import GenericForm from "@/components/ui/generic-form";
import DataTable from "@/components/ui/data-table";
import { createTaskFormSchema } from '@/lib/validations/task';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

interface TaskManagementSectionProps {
  projectId: string;
  project: Project;
  departments: Department[];
}

export default function TaskManagementSection({ projectId, project, departments }: TaskManagementSectionProps) {
  const {
    tasks,
    fetchTaskHierarchy,
    createTask,
    loading,
  } = useTasks();
  const { canCreate } = usePermissions();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  // Fetch hierarchy on mount or when projectId changes
  useMemo(() => {
    fetchTaskHierarchy(projectId);
  }, [projectId, fetchTaskHierarchy]);

  // Stats
  const totalTasks = tasks.filter(t => t.projectId === projectId && t.type === 'task').length;
  const totalSubTasks = tasks.filter(t => t.projectId === projectId && t.type === 'sub-task').length;
  const completed = tasks.filter(t => t.projectId === projectId && t.status === 'completed').length;

  // Department-wise grouping
  const tasksByDept = useMemo(() => {
    const map: Record<string, Task[]> = {};
    departments.forEach(dept => {
      map[dept._id!] = tasks.filter(t => t.projectId === projectId && t.departmentId === dept._id && t.type === 'task');
    });
    return map;
  }, [departments, tasks, projectId]);

  // Task creation form
  const form = useForm({
    resolver: zodResolver(createTaskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      projectId,
      departmentId: selectedDept || '',
      type: 'task',
      priority: 'medium',
    },
  });

  const handleCreate = async (data: any) => {
    await createTask({ ...data, projectId, departmentId: selectedDept });
    setShowTaskForm(false);
    form.reset();
    fetchTaskHierarchy(projectId);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Total Tasks</p><p className="text-2xl font-bold">{totalTasks}</p></div><CheckSquare className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Sub-tasks</p><p className="text-2xl font-bold">{totalSubTasks}</p></div><CheckSquare className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Completed</p><p className="text-2xl font-bold text-green-600">{completed}</p></div><CheckCircle2 className="h-8 w-8 text-green-500" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Pending</p><p className="text-2xl font-bold">{totalTasks + totalSubTasks - completed}</p></div><Clock className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
      </div>
      {/* Department-wise task lists */}
      {departments.map(dept => (
        <Card key={dept._id} className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Badge>{dept.name}</Badge>
              <span className="text-xs text-muted-foreground">{tasksByDept[dept._id!]?.length || 0} tasks</span>
            </CardTitle>
            {canCreate('tasks') && (
              <Button size="sm" onClick={() => { setSelectedDept(dept._id!); setShowTaskForm(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Create Task
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                {
                  key: 'title',
                  label: 'Title',
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (_value, row) => <Badge variant={row.status === 'completed' ? 'default' : 'outline'}>{row.status}</Badge>,
                },
                {
                  key: 'priority',
                  label: 'Priority',
                },
                {
                  key: 'assignee',
                  label: 'Assignee',
                  render: (_value, row) => row.assignee?.name || '-',
                },
              ]}
              data={tasksByDept[dept._id!] || []}
              resourceName="tasks"
              loading={loading}
            />
          </CardContent>
        </Card>
      ))}
      {/* Task creation modal */}
      {showTaskForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-2">Create Task for Department</h3>
            <GenericForm
              form={form}
              fields={[
                { name: 'title', label: 'Title', type: 'text', required: true },
                { name: 'description', label: 'Description', type: 'textarea' },
                { name: 'priority', label: 'Priority', type: 'select', options: [ { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' } ] },
              ]}
              onSubmit={handleCreate}
              loading={loading}
              submitText="Create Task"
              cancelText="Cancel"
              onCancel={() => setShowTaskForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
