"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Flag,
  Plus,
  Edit3,
  Trash2,
  Calendar,
  Target,
  Clock,
  User,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Link as LinkIcon,
  DollarSign,
  RefreshCw
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CustomModal from "@/components/ui/custom-modal";
import { createMilestoneFormSchema, updateMilestoneFormSchema, getMilestoneStatusColor, getMilestonePriorityColor } from "@/lib/validations/milestone";
import type { CreateMilestoneFormData, UpdateMilestoneFormData } from "@/lib/validations/milestone";
import { useToast } from "@/hooks/use-toast";
import { useMilestoneManagement } from "@/hooks/use-milestones";
import { useUsers } from "@/hooks/use-users";
import { usePermissions } from "@/hooks/use-permissions";
import { formatDistanceToNow } from "date-fns";
import type { IMilestone } from "@/models/Milestone";

interface MilestonesSectionProps {
  projectId: string;
  phaseId?: string;
  onMilestoneUpdate?: () => void;
}

export function MilestonesSection({ projectId, phaseId, onMilestoneUpdate }: MilestonesSectionProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<IMilestone | null>(null);
  const [viewFilter, setViewFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed' | 'overdue'>('all');

  const { toast } = useToast();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { users } = useUsers();

  // Use milestone management hook
  const {
    milestones,
    loading,
    error,
    refetch,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    completedMilestones,
    pendingMilestones,
    inProgressMilestones,
    overdueMilestones,
    overallProgress,
    completionRate
  } = useMilestoneManagement(projectId, phaseId);

  // Forms
  const addForm = useForm<CreateMilestoneFormData>({
    resolver: zodResolver(createMilestoneFormSchema),
    defaultValues: {
      title: "",
      description: "",
      projectId,
      phaseId: phaseId || "",
      dueDate: "",
      priority: "medium",
      assigneeId: "",
      deliverables: [],
      successCriteria: [],
      budgetAllocation: "",
    },
  });

  const editForm = useForm<UpdateMilestoneFormData>({
    resolver: zodResolver(updateMilestoneFormSchema),
    defaultValues: {
      title: "",
      description: "",
      dueDate: "",
      priority: "medium",
      assigneeId: "",
      deliverables: [],
      successCriteria: [],
      budgetAllocation: "",
    },
  });



  // Filter milestones based on view filter
  const filteredMilestones = (milestones || []).filter((milestone: IMilestone) => {
    if (viewFilter === 'all') return true;
    return milestone.status === viewFilter;
  });

  // Calculate statistics
  const milestoneStats = {
    total: (milestones || []).length,
    completed: (milestones || []).filter((m: IMilestone) => m.status === 'completed').length,
    inProgress: (milestones || []).filter((m: IMilestone) => m.status === 'in-progress').length,
    overdue: (milestones || []).filter((m: IMilestone) => m.status === 'overdue').length,
    totalBudget: (milestones || []).reduce((sum: number, m: IMilestone) => sum + (m.budgetAllocation || 0), 0),
    actualCost: (milestones || []).reduce((sum: number, m: IMilestone) => sum + (m.actualCost || 0), 0),
    averageProgress: Math.round((milestones || []).reduce((sum: number, m: IMilestone) => sum + (m.progress || 0), 0) / ((milestones || []).length || 1)) || 0,
  };

  // Handle milestone creation
  const handleAddMilestone = async (data: CreateMilestoneFormData) => {
    try {
      await createMilestone({
        title: data.title,
        description: data.description || "",
        projectId: projectId,
        phaseId: phaseId || "",
        dueDate: new Date(data.dueDate),
        priority: data.priority,
        assigneeId: data.assigneeId || "",
        deliverables: data.deliverables,
        successCriteria: data.successCriteria,
        budgetAllocation: data.budgetAllocation ? Number(data.budgetAllocation) : undefined,
        progress: 0,
        status: "pending" as const,
        linkedTaskIds: [],
        dependencies: [],
      });

      setShowAddModal(false);
      addForm.reset();
      onMilestoneUpdate?.();
    } catch (error) {
      console.error('Error creating milestone:', error);
    }
  };

  // Handle milestone editing
  const handleEditMilestone = (milestone: IMilestone) => {
    setEditingMilestone(milestone);
    editForm.reset({
      title: milestone.title,
      description: milestone.description,
      dueDate: new Date(milestone.dueDate).toISOString().split('T')[0],
      priority: milestone.priority,
      assigneeId: milestone.assigneeId?.toString(),
      deliverables: milestone.deliverables,
      successCriteria: milestone.successCriteria,
      budgetAllocation: milestone.budgetAllocation?.toString(),
    });
  };

  // Handle milestone update
  const handleUpdateMilestone = async (data: UpdateMilestoneFormData) => {
    if (!editingMilestone) return;

    try {
      await updateMilestone(editingMilestone._id, {
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        priority: data.priority,
        assigneeId: data.assigneeId,
        deliverables: data.deliverables,
        successCriteria: data.successCriteria,
        budgetAllocation: data.budgetAllocation ? parseFloat(data.budgetAllocation) : undefined,
      });

      setEditingMilestone(null);
      editForm.reset();
      onMilestoneUpdate?.();
    } catch (error) {
      console.error('Error updating milestone:', error);
    }
  };

  // Handle milestone deletion
  const handleDeleteMilestone = async (milestoneId: string) => {
    try {
      await deleteMilestone(milestoneId);
      onMilestoneUpdate?.();
    } catch (error) {
      console.error('Error deleting milestone:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <span>Loading Project Milestones...</span>
      </div>
    );
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Project Milestones</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select value={viewFilter} onValueChange={(value: any) => setViewFilter(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Milestones</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowAddModal(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Milestone
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-primary">{milestoneStats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </div>
          <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{milestoneStats.completed}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
          <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{milestoneStats.inProgress}</div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </div>
          <div className="text-center p-3 bg-destructive/10 rounded-lg">
            <div className="text-2xl font-bold text-destructive">{milestoneStats.overdue}</div>
            <div className="text-sm text-muted-foreground">Overdue</div>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">{milestoneStats.averageProgress}%</span>
          </div>
          <Progress value={milestoneStats.averageProgress} className="h-2" />
        </div>

        <Separator />

        {/* Milestones List */}
        {filteredMilestones?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Flag className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No milestones found</p>
            <p className="text-sm">Create your first milestone to track project progress!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMilestones.map((milestone: IMilestone) => (
              <Card key={milestone._id} className="border-l-4 border-l-primary/30 hover:shadow-md transition-shadow group">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Milestone Header */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-3 h-3 rounded-full ${milestone.status === 'completed' ? 'bg-emerald-500' :
                            milestone.status === 'in-progress' ? 'bg-primary' :
                              milestone.status === 'overdue' ? 'bg-destructive' :
                                'bg-muted-foreground/30'
                          }`} />
                        <h4 className="font-semibold text-foreground truncate">{milestone.title}</h4>
                        <div className="flex gap-1 flex-shrink-0">
                          <Badge className={getMilestoneStatusColor(milestone.status)}>
                            {milestone.status.replace('-', ' ')}
                          </Badge>
                          <Badge variant="outline" className={getMilestonePriorityColor(milestone.priority)}>
                            {milestone.priority} priority
                          </Badge>
                        </div>
                      </div>

                      {milestone.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {milestone.description}
                        </p>
                      )}

                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">Progress</span>
                          <span className="text-xs font-medium">{milestone.progress}%</span>
                        </div>
                        <Progress value={milestone.progress} className="h-2" />
                      </div>

                      {/* Milestone Metadata */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due: {new Date(milestone.dueDate).toLocaleDateString()}
                          {milestone.status === 'overdue' && (
                            <span className="text-destructive font-medium">
                              (Overdue)
                            </span>
                          )}
                        </span>
                        {milestone.assigneeId && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Assigned
                          </span>
                        )}
                        {milestone.linkedTaskIds && milestone.linkedTaskIds.length > 0 && (
                          <span className="flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" />
                            {milestone.linkedTaskIds.length} linked tasks
                          </span>
                        )}
                        {milestone.budgetAllocation && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            Budget: ${milestone.budgetAllocation.toLocaleString()}
                            {milestone.actualCost && (
                              <span className={milestone.actualCost > milestone.budgetAllocation ? 'text-destructive' : 'text-emerald-600'}>
                                / ${milestone.actualCost.toLocaleString()}
                              </span>
                            )}
                          </span>
                        )}
                      </div>

                      {/* Deliverables Preview */}
                      {milestone.deliverables && milestone.deliverables.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs text-muted-foreground mb-1">Deliverables:</div>
                          <div className="flex flex-wrap gap-1">
                            {milestone.deliverables.slice(0, 3).map((deliverable: string, index: number) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {deliverable}
                              </Badge>
                            ))}
                            {milestone.deliverables.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{milestone.deliverables.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Milestone Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Target className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditMilestone(milestone)}>
                          <Edit3 className="h-4 w-4 mr-2" />
                          Edit Milestone
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteMilestone(milestone._id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Milestone
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add Milestone Modal */}
        <CustomModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Create New Milestone"
          modalSize="lg"
        >
          <form onSubmit={addForm.handleSubmit(handleAddMilestone)} className="space-y-4">
            <div>
              <Label htmlFor="title">Milestone Title</Label>
              <Input
                id="title"
                {...addForm.register("title")}
                placeholder="Enter milestone title"
              />
              {addForm.formState.errors.title && (
                <p className="text-sm text-destructive mt-1">
                  {addForm.formState.errors.title.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...addForm.register("description")}
                placeholder="Describe the milestone objectives..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  {...addForm.register("dueDate")}
                />
                {addForm.formState.errors.dueDate && (
                  <p className="text-sm text-destructive mt-1">
                    {addForm.formState.errors.dueDate.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select onValueChange={(value) => addForm.setValue("priority", value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="budgetAllocation">Budget Allocation (Optional)</Label>
              <Input
                id="budgetAllocation"
                type="number"
                {...addForm.register("budgetAllocation")}
                placeholder="Enter budget amount"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Milestone"}
              </Button>
            </div>
          </form>
        </CustomModal>

        {/* Edit Milestone Modal */}
        <CustomModal
          isOpen={!!editingMilestone}
          onClose={() => setEditingMilestone(null)}
          title="Edit Milestone"
        >
          <form onSubmit={editForm.handleSubmit(handleUpdateMilestone)} className="space-y-4">
            <div>
              <Label htmlFor="editTitle">Milestone Title</Label>
              <Input
                id="editTitle"
                {...editForm.register("title")}
                placeholder="Enter milestone title"
              />
            </div>

            <div>
              <Label htmlFor="editDescription">Description</Label>
              <Textarea
                id="editDescription"
                {...editForm.register("description")}
                placeholder="Describe the milestone objectives..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editDueDate">Due Date</Label>
                <Input
                  id="editDueDate"
                  type="date"
                  {...editForm.register("dueDate")}
                />
              </div>

              <div>
                <Label htmlFor="editPriority">Priority</Label>
                <Select onValueChange={(value) => editForm.setValue("priority", value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="editBudgetAllocation">Budget Allocation</Label>
              <Input
                id="editBudgetAllocation"
                type="number"
                {...editForm.register("budgetAllocation")}
                placeholder="Enter budget amount"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingMilestone(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Updating..." : "Update Milestone"}
              </Button>
            </div>
          </form>
        </CustomModal>
      </CardContent>
    </Card>
  );
}