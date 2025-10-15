"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Plus, Clock, CheckCircle2 } from "lucide-react";
import { Project, Department } from '@/types';

interface TaskManagementSectionProps {
  projectId: string;
  project: Project;
  departments: Department[];
}

export default function TaskManagementSection({ 
  projectId, 
  project, 
  departments 
}: TaskManagementSectionProps) {

  return (
    <div className="space-y-6">
      {/* Task Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">0</p>
              </div>
              <CheckSquare className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sub-tasks</p>
                <p className="text-2xl font-bold">0</p>
              </div>
              <CheckSquare className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">0</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">0</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tasks Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Project Tasks
            </CardTitle>
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" />
              Create Task (Coming Soon)
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Task Management</h3>
            <p className="text-muted-foreground mb-4">
              Task and sub-task management functionality will be available soon.
            </p>
            <div className="text-sm text-muted-foreground">
              <p>Features coming:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Create tasks for each department</li>
                <li>Assign tasks to team members</li>
                <li>Create sub-tasks for task breakdown</li>
                <li>Track task status and progress</li>
                <li>Task hierarchy and dependencies</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Department Assignment Info */}
      {project.departmentIds && project.departmentIds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assigned Departments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {project.departmentIds.map(deptId => {
                const dept = departments.find(d => d._id === deptId);
                return dept ? (
                  <Badge key={deptId} variant="outline" className="px-3 py-1">
                    {dept.name}
                  </Badge>
                ) : null;
              })}
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Tasks can be created for each assigned department. Department leads can then 
              break down tasks into sub-tasks and assign them to team members.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}