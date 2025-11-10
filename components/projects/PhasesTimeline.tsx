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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Calendar,
  Plus,
  Edit3,
  Trash2,
  CheckCircle,
  Clock,
  User,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  MoreVertical,
  PlayCircle,
  PauseCircle,
  Target,
  DollarSign,
  AlertCircle,
  Users,
  RefreshCw,
  Ban
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import CustomModal from "@/components/ui/custom-modal";
import { createPhaseFormSchema, updatePhaseFormSchema, getPhaseStatusColor } from "@/lib/validations/phase";
import type { CreatePhaseFormData, UpdatePhaseFormData } from "@/lib/validations/phase";
import { useToast } from "@/hooks/use-toast";
import { usePhaseManagement } from "@/hooks/use-phases";
import { useUsers } from "@/hooks/use-users";
import { useAuthUser } from "@/hooks/use-auth-user";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import type { IPhase } from "@/models/Phase";
import RichTextEditor from "../ui/rich-text-editor";
import HtmlTextRenderer from "../ui/html-text-renderer";

interface PhasesTimelineProps {
  projectId: string;
  onPhaseUpdate?: () => void;
}



export function PhasesTimeline({ projectId, onPhaseUpdate }: PhasesTimelineProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPhase, setEditingPhase] = useState<IPhase | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');

  const { toast } = useToast();

  // Get current user for approval actions
  const { user: currentUser } = useAuthUser();

  // Use the phase management hook
  const {
    phases,
    stats,
    loading,
    actionLoading,
    error,
    refetch,
    createPhase,
    updatePhase,
    deletePhase,
    completedPhases,
    activePhases,
    plannedPhases,
    overduePhases,
    overallProgress
  } = usePhaseManagement(projectId);

  // Get users for dropdowns
  const { users } = useUsers();

  // Forms
  const addForm = useForm<CreatePhaseFormData>({
    resolver: zodResolver(createPhaseFormSchema),
    defaultValues: {
      title: "",
      description: "",
      projectId: projectId || "",
      order: "",
      startDate: "",
      endDate: "",
      objectives: [],
      deliverables: [],
      resources: [],
      risks: [],
      budgetAllocation: "",
      approvalRequired: false,
    },
  });

  const editForm = useForm<UpdatePhaseFormData>({
    resolver: zodResolver(updatePhaseFormSchema),
    defaultValues: {
      title: "",
      description: "",
      order: "",
      startDate: "",
      endDate: "",
      objectives: [],
      deliverables: [],
      resources: [],
      risks: [],
      budgetAllocation: "",
      approvalRequired: false,
    },
  });

  // Refetch when projectId changes and call onPhaseUpdate when needed
  useEffect(() => {
    if (onPhaseUpdate) {
      onPhaseUpdate();
    }
  }, [(phases || []).length, onPhaseUpdate]);

  // Update form when projectId changes
  useEffect(() => {
    if (projectId) {
      addForm.setValue('projectId', projectId);
    }
  }, [projectId, addForm]);

  // Calculate timeline statistics using real data
  const phaseStats = {
    total: (phases || []).length,
    completed: (completedPhases || []).length,
    active: (activePhases || []).length,
    planned: (plannedPhases || []).length,
    totalBudget: (phases || []).reduce((sum: number, p: IPhase) => sum + (p.budgetAllocation || 0), 0),
    totalDuration: (phases || []).reduce((sum: number, p: IPhase) => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      const diffTime = end.getTime() - start.getTime();
      return sum + Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }, 0),
    averageProgress: overallProgress,
  };

  // Handle phase creation
  const handleAddPhase = async (data: CreatePhaseFormData) => {

    try {
      const phaseData = {
        title: data.title,
        description: data.description || "",
        projectId,
        order: data.order && data.order.trim() !== "" ? parseInt(data.order) : phases.length + 1,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: 'planning' as const,
        progress: 0,
        objectives: data.objectives || [],
        deliverables: data.deliverables || [],
        resources: data.resources || [],
        risks: data.risks || [],
        dependencies: [],
        budgetAllocation: data.budgetAllocation && data.budgetAllocation.trim() !== "" ? parseFloat(data.budgetAllocation) : undefined,
        approvalRequired: data.approvalRequired || false,
      };

      const result = await createPhase(phaseData);

      toast({
        title: "Success",
        description: "Phase created successfully",
      });

      setShowAddModal(false);
      addForm.reset();
      onPhaseUpdate?.();
    } catch (error: any) {
      console.error('Error creating phase:', error);

      toast({
        title: "Error",
        description: error?.message || error?.response?.data?.error || "Failed to create phase. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle phase editing
  const handleEditPhase = (phase: IPhase) => {
    setEditingPhase(phase);
    editForm.reset({
      title: phase.title,
      description: phase.description,
      order: phase.order.toString(),
      startDate: new Date(phase.startDate).toISOString().split('T')[0],
      endDate: new Date(phase.endDate).toISOString().split('T')[0],
      objectives: phase.objectives || [],
      deliverables: phase.deliverables,
      resources: phase.resources || [],
      risks: phase.risks || [],
      budgetAllocation: phase.budgetAllocation?.toString(),
      approvalRequired: phase.approvalRequired || false,
    });
  };

  // Handle phase update
  const handleUpdatePhase = async (data: UpdatePhaseFormData) => {
    if (!editingPhase) return;

    try {
      await updatePhase(editingPhase._id, {
        title: data.title,
        description: data.description,
        order: data.order ? parseInt(data.order) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        deliverables: data.deliverables,
        resources: data.resources,
        objectives: data.objectives,
        risks: data.risks,
        budgetAllocation: data.budgetAllocation ? parseFloat(data.budgetAllocation) : undefined,
        approvalRequired: data.approvalRequired,
      });

      setEditingPhase(null);
      editForm.reset();
      onPhaseUpdate?.();
    } catch (error) {
      console.error('Error updating phase:', error);
    }
  };

  // Handle phase actions
  const handlePhaseAction = async (phaseId: string, action: 'start' | 'pause' | 'complete' | 'approve' | 'cancel' | 'delete') => {
    try {
      if (action === 'delete') {
        await deletePhase(phaseId);
        toast({
          title: "Success",
          description: "Phase deleted successfully",
        });
        onPhaseUpdate?.();
        return;
      }

      // Find the current phase to check its status
      const currentPhase = phases?.find(p => p._id === phaseId) as IPhase | undefined;
      if (!currentPhase) {
        toast({
          title: "Error",
          description: "Phase not found",
          variant: "destructive",
        });
        return;
      }

      let updateData: any = {};
      let actionAllowed = true;
      let actionMessage = "";

      switch (action) {
        case 'start':
          if (currentPhase.status === 'planning' || currentPhase.status === 'on-hold') {
            updateData = {
              status: 'in-progress',
              actualStartDate: new Date(),
            };
            actionMessage = "Phase started successfully";
          } else {
            actionAllowed = false;
            actionMessage = "Can only start phases that are in planning or on-hold status";
          }
          break;

        case 'pause':
          if (currentPhase.status === 'in-progress') {
            updateData = {
              status: 'on-hold',
            };
            actionMessage = "Phase paused successfully";
          } else {
            actionAllowed = false;
            actionMessage = "Can only pause phases that are in progress";
          }
          break;

        case 'complete':
          if (currentPhase.status !== 'completed') {
            updateData = {
              status: 'completed',
              progress: 100,
              actualEndDate: new Date(),
            };
            actionMessage = "Phase completed successfully";
          } else {
            actionAllowed = false;
            actionMessage = "Phase is already completed";
          }
          break;

        case 'approve':
          if (currentPhase.status === 'cancelled' || currentPhase.status === 'completed') {
            if (!currentUser?.id) {
              actionAllowed = false;
              actionMessage = "User not authenticated";
            } else {
              updateData = {
                approvedBy: currentUser.id,
                approvedAt: new Date(),
              };
              actionMessage = "Phase approved successfully";
            }
          } else {
            actionAllowed = false;
            actionMessage = "Can only approve cancelled or completed phases";
          }
          break;

        case 'cancel':
          if (currentPhase.status !== 'cancelled') {
            updateData = {
              status: 'cancelled',
            };
            actionMessage = "Phase cancelled successfully";
          } else {
            actionAllowed = false;
            actionMessage = "Phase is already cancelled";
          }
          break;
      }

      if (!actionAllowed) {
        toast({
          title: "Action not allowed",
          description: actionMessage,
          variant: "destructive",
        });
        return;
      }

      await updatePhase(phaseId, updateData);

      toast({
        title: "Success",
        description: actionMessage,
      });

      onPhaseUpdate?.();
    } catch (error: any) {
      console.error(`Error ${action}ing phase:`, error);

      toast({
        title: "Error",
        description: `Failed to ${action} phase. Please try again.`,
        variant: "destructive",
      });
    }
  };

  // Render timeline view
  const renderTimeline = () => (
    <div className="space-y-6">
      {(phases || []).map((phase: IPhase, index: number) => (
        <div key={phase._id} className="relative">
          {/* Timeline line */}
          {index < (phases || []).length - 1 && (
            <div className="absolute left-6 top-16 w-0.5 h-full bg-border" />
          )}

          {/* Phase card */}
          <div className="flex items-start gap-4">
            {/* Timeline indicator */}
            <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center flex-shrink-0 z-10 ${phase.status === 'completed' ? 'bg-emerald-500 border-emerald-200 text-white' :
              phase.status === 'in-progress' ? 'bg-primary border-primary/20 text-white' :
                phase.status === 'on-hold' ? 'bg-amber-500 border-amber-200 text-white' :
                  'bg-muted border-muted-foreground/20 text-muted-foreground'
              }`}>
              {phase.status === 'completed' ? (
                <CheckCircle className="h-6 w-6" />
              ) : phase.status === 'in-progress' ? (
                <PlayCircle className="h-6 w-6" />
              ) : phase.status === 'on-hold' ? (
                <PauseCircle className="h-6 w-6" />
              ) : (
                <Clock className="h-6 w-6" />
              )}
            </div>

            {/* Phase content */}
            <Card className="flex-1 shadow-sm hover:shadow-md transition-shadow group">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-lg">{phase.title}</h4>
                      <Badge className={getPhaseStatusColor(phase.status)}>
                        {phase.status.replace('-', ' ')}
                      </Badge>
                      <Badge variant="outline" className={
                        phase.approvedBy ? 'border-emerald-500 text-emerald-600' :
                          'border-muted-foreground text-muted-foreground'
                      }>
                        {phase.approvedBy ? 'Approved' : 'Pending Approval'}
                      </Badge>
                    </div>

                    {phase.description && (
                      <HtmlTextRenderer
                        content={phase.description}
                        maxLength={120}
                        className="line-clamp-4"
                        fallbackText="No description"
                        showFallback={true}
                        renderAsHtml={true}
                        truncateHtml={true}
                      />
                    )}
                  </div>

                  {/* Phase actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditPhase(phase)}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit Phase
                      </DropdownMenuItem>

                      {/* Hide all actions if phase is cancelled or approved */}
                      {phase.status !== 'cancelled' && !phase.approvedBy && (
                        <>
                          {(phase.status === 'planning' || phase.status === 'on-hold') && (
                            <>
                              <DropdownMenuItem onClick={() => handlePhaseAction(phase._id, 'start')}>
                                <PlayCircle className="h-4 w-4 mr-2" />
                                Start Phase
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePhaseAction(phase._id, 'cancel')}>
                                <Ban className="h-4 w-4 mr-2" />
                                Cancel Phase
                              </DropdownMenuItem>
                            </>
                          )}

                          {phase.status === 'in-progress' && (
                            <>
                              <DropdownMenuItem onClick={() => handlePhaseAction(phase._id, 'pause')}>
                                <PauseCircle className="h-4 w-4 mr-2" />
                                Pause Phase
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePhaseAction(phase._id, 'complete')}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Complete Phase
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePhaseAction(phase._id, 'cancel')}>
                                <Ban className="h-4 w-4 mr-2" />
                                Cancel Phase
                              </DropdownMenuItem>
                            </>
                          )}
                          {/* @ts-ignore */}
                          {(phase.status === 'completed' || phase.status === 'cancelled') && !phase.approvedBy && (
                            <>
                              <DropdownMenuItem onClick={() => handlePhaseAction(phase._id, 'approve')}>
                                <Target className="h-4 w-4 mr-2" />
                                Approve Phase
                              </DropdownMenuItem>
                              {phase.status === 'completed' && (
                                <DropdownMenuItem onClick={() => handlePhaseAction(phase._id, 'cancel')}>
                                  <Ban className="h-4 w-4 mr-2" />
                                  Cancel Phase
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </>
                      )}

                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handlePhaseAction(phase._id, 'delete')}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Phase
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Progress</span>
                    <span className="text-sm text-muted-foreground">{phase.progress}%</span>
                  </div>
                  <Progress value={phase.progress} className="h-2" />
                </div>

                {/* Phase details grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Duration</div>
                    <div className="text-sm font-medium">
                      {differenceInDays(new Date(phase.endDate), new Date(phase.startDate))} days
                      {phase.actualEndDate && phase.actualStartDate && (
                        <span className="text-muted-foreground text-xs ml-2">
                          (actual: {differenceInDays(new Date(phase.actualEndDate), new Date(phase.actualStartDate))})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Start Date</div>
                    <div className="text-sm">
                      {new Date(phase.startDate).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">End Date</div>
                    <div className="text-sm">
                      {new Date(phase.endDate).toLocaleDateString()}
                    </div>
                  </div>

                  {phase.budgetAllocation && (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Budget</div>
                      <div className="text-sm font-medium">
                        ${phase.budgetAllocation.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Team and deliverables */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Team members */}
                  {false && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Team Members
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {[].map((member: any) => (
                          <div key={member._id} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
                            <User className="h-3 w-3" />
                            {member.name}
                          </div>
                        ))}
                        {false && (
                          <div className="text-xs bg-muted px-2 py-1 rounded">
                            +0 more
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Deliverables */}
                  {phase.deliverables && phase.deliverables.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Deliverables ({phase.deliverables.length})</div>
                      <div className="flex flex-wrap gap-1">
                        {phase.deliverables.slice(0, 3).map((deliverable: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {deliverable}
                          </Badge>
                        ))}
                        {phase.deliverables.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{phase.deliverables.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ))}
    </div>
  );
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <span>Loading Project Phases...</span>
      </div>
    );
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Project Phases Timeline</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="timeline">Timeline</SelectItem>
                <SelectItem value="list">List View</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowAddModal(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Phase
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-xl font-bold text-primary">{phaseStats.total}</div>
            <div className="text-xs text-muted-foreground">Total Phases</div>
          </div>
          <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{phaseStats.completed}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
          <div className="text-center p-3 bg-primary/10 rounded-lg">
            <div className="text-xl font-bold text-primary">{phaseStats.active}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-xl font-bold text-muted-foreground">{phaseStats.planned}</div>
            <div className="text-xs text-muted-foreground">Planned</div>
          </div>
          <div className="text-center p-3 bg-accent rounded-lg">
            <div className="text-xl font-bold text-accent-foreground">${(phaseStats.totalBudget / 1000).toFixed(0)}K</div>
            <div className="text-xs text-muted-foreground">Total Budget</div>
          </div>
        </div>

        {/* Overall project progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Overall Project Progress</span>
            <span className="text-sm text-muted-foreground">{phaseStats.averageProgress}%</span>
          </div>
          <Progress value={phaseStats.averageProgress} className="h-3" />
        </div>

        <Separator />

        {/* Phases Timeline */}
        {(phases || []).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No phases created yet</p>
            <p className="text-sm">Start by creating your first project phase!</p>
          </div>
        ) : (
          renderTimeline()
        )}

        {/* Add Phase Modal */}
        <CustomModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Create New Phase"
          modalSize="lg"
        >
          <form onSubmit={addForm.handleSubmit(handleAddPhase)} className="space-y-4">
            {/* Hidden projectId field */}
            <input type="hidden" {...addForm.register("projectId")} />

            <div>
              <Label htmlFor="phaseTitle">Phase Title</Label>
              <Input
                id="phaseTitle"
                {...addForm.register("title")}
                placeholder="Enter phase title"
              />
              {addForm.formState.errors.title && (
                <p className="text-sm text-destructive mt-1">
                  {addForm.formState.errors.title.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="phaseDescription">Description</Label>
              <RichTextEditor
                value={addForm.watch("description") || ''}
                onChange={(value: any) => addForm.setValue("description", value)}
                placeholder="Describe the phase objectives and deliverables..."
                disabled={actionLoading}
                height="150px"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phaseStartDate">Start Date</Label>
                <Input
                  id="phaseStartDate"
                  type="date"
                  {...addForm.register("startDate")}
                />
                {addForm.formState.errors.startDate && (
                  <p className="text-sm text-destructive mt-1">
                    {addForm.formState.errors.startDate.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="phaseEndDate">End Date</Label>
                <Input
                  id="phaseEndDate"
                  type="date"
                  {...addForm.register("endDate")}
                />
                {addForm.formState.errors.endDate && (
                  <p className="text-sm text-destructive mt-1">
                    {addForm.formState.errors.endDate.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phaseBudget">Budget Allocation</Label>
                <Input
                  id="phaseBudget"
                  type="number"
                  {...addForm.register("budgetAllocation")}
                  placeholder="Enter budget amount"
                />
              </div>

              <div>
                <Label htmlFor="phaseOrder">Phase Order</Label>
                <Input
                  id="phaseOrder"
                  type="number"
                  {...addForm.register("order")}
                  placeholder="Phase order/sequence"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading ? "Creating..." : "Create Phase"}
              </Button>
            </div>
          </form>
        </CustomModal>

        {/* Edit Phase Modal */}
        <CustomModal
          isOpen={!!editingPhase}
          onClose={() => setEditingPhase(null)}
          title="Edit Phase"
          modalSize="lg"
        >
          <form onSubmit={editForm.handleSubmit(handleUpdatePhase)} className="space-y-4">
            <div>
              <Label htmlFor="editPhaseTitle">Phase Title</Label>
              <Input
                id="editPhaseTitle"
                {...editForm.register("title")}
                placeholder="Enter phase title"
              />
            </div>

            <div>
              <Label htmlFor="editPhaseDescription">Description</Label>
              <RichTextEditor
                value={editForm.watch("description") || ''}
                onChange={(value: any) => editForm.setValue("description", value)}
                placeholder="Describe the phase objectives and deliverables..."
                disabled={actionLoading}
                height="150px"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editPhaseStartDate">Start Date</Label>
                <Input
                  id="editPhaseStartDate"
                  type="date"
                  {...editForm.register("startDate")}
                />
              </div>

              <div>
                <Label htmlFor="editPhaseEndDate">End Date</Label>
                <Input
                  id="editPhaseEndDate"
                  type="date"
                  {...editForm.register("endDate")}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editPhaseBudget">Budget Allocation</Label>
                <Input
                  id="editPhaseBudget"
                  type="number"
                  {...editForm.register("budgetAllocation")}
                  placeholder="Enter budget amount"
                />
              </div>

              <div>
                <Label htmlFor="editPhaseOrder">Phase Order</Label>
                <Input
                  id="editPhaseOrder"
                  type="number"
                  {...editForm.register("order")}
                  placeholder="Phase order/sequence"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingPhase(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading ? "Updating..." : "Update Phase"}
              </Button>
            </div>
          </form>
        </CustomModal>
      </CardContent>
    </Card>
  );
}

