"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  CheckCircle, 
  Clock, 
  Calendar, 
  User, 
  Edit, 
  Trash2, 
  ChevronRight,
  Timer,
  Target,
  MessageCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SubTaskCardProps {
  subTask: {
    _id: string;
    title: string;
    description?: string;
    status: 'pending' | 'in-progress' | 'completed' | 'on-hold';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assigneeId?: string;
    assignee?: {
      _id: string;
      name: string;
      email: string;
      avatar?: string;
    };
    dueDate?: string;
    estimatedHours?: number;
    actualHours?: number;
    createdAt: string;
    updatedAt: string;
  };
  index: number;
  totalSubTasks: number;
  onAssign: (subTask: any) => void;
  onEdit: (subTask: any) => void;
  onDelete: (taskId: string) => void;
  onViewDetails?: (subTask: any) => void;
}

const statusConfig = {
  pending: {
    color: 'bg-muted text-muted-foreground border-border',
    indicator: 'bg-background border-muted-foreground/30',
    icon: null
  },
  'in-progress': {
    color: 'bg-primary/10 text-primary border-primary/20',
    indicator: 'bg-primary border-primary',
    icon: <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
  },
  completed: {
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    indicator: 'bg-emerald-500 border-emerald-500',
    icon: <CheckCircle className="h-2.5 w-2.5 text-white" />
  },
  'on-hold': {
    color: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    indicator: 'bg-amber-500 border-amber-500',
    icon: <Timer className="h-2.5 w-2.5 text-white" />
  }
};

const priorityConfig = {
  low: 'border-primary/30 text-primary',
  medium: 'border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400',
  high: 'border-destructive/50 text-destructive/80',
  urgent: 'border-destructive/30 text-destructive'
};

export function SubTaskCard({ 
  subTask, 
  index, 
  totalSubTasks, 
  onAssign, 
  onEdit, 
  onDelete, 
  onViewDetails 
}: SubTaskCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const statusStyle = statusConfig[subTask.status];
  const priorityStyle = priorityConfig[subTask.priority];
  
  const progress = subTask.estimatedHours && subTask.actualHours 
    ? Math.min((subTask.actualHours / subTask.estimatedHours) * 100, 100)
    : 0;
    
  const isOverdue = subTask.dueDate && new Date(subTask.dueDate) < new Date() && subTask.status !== 'completed';

  return (
    <Card 
      className={cn(
        "transition-all duration-200 group hover:shadow-sm border-l-3",
        subTask.status === 'completed' ? 'border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20' : 
        subTask.status === 'in-progress' ? 'border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/20' :
        subTask.status === 'on-hold' ? 'border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/20' :
        'border-l-slate-300 bg-slate-50/30 dark:bg-slate-900/20',
        isHovered && "shadow-md"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            {/* Status Indicator */}
            <div className="flex-shrink-0 mt-0.5">
              <div className={cn(
                "w-3 h-3 rounded-full border flex items-center justify-center transition-all duration-200",
                statusStyle?.indicator,
                isHovered && "scale-110"
              )}>
                {statusStyle?.icon}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h6 className="text-sm font-medium text-foreground truncate">
                      {subTask.title}
                    </h6>
                    {isOverdue && (
                      <Badge variant="destructive" className="text-xs px-1 py-0.5 h-5">
                        <Timer className="w-2.5 h-2.5 mr-1" />
                        Overdue
                      </Badge>
                    )}
                  </div>
                  
                  {/* Compact Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    <Badge 
                      variant="secondary"
                      className={cn("text-xs h-5 px-2", statusStyle?.color)}
                    >
                      {subTask.status?.replace('-', ' ')}
                    </Badge>
                    
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs h-5 px-2 border", priorityStyle)}
                    >
                      {subTask.priority}
                    </Badge>

                    {subTask.estimatedHours && (
                      <Badge variant="outline" className="text-xs h-5 px-2">
                        <Target className="h-2.5 w-2.5 mr-1" />
                        {subTask.estimatedHours}h
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Description */}
              {subTask.description && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  {subTask.description}
                </p>
              )}
              
              {/* Progress Bar */}
              {subTask.estimatedHours && subTask.actualHours && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Progress</span>
                    <span>{subTask.actualHours}h / {subTask.estimatedHours}h</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div 
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        progress > 100 ? 'bg-destructive' : 
                        progress > 80 ? 'bg-amber-500' : 
                        'bg-emerald-500'
                      )}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Metadata */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {subTask.assigneeId && subTask.assignee && (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={subTask.assignee.avatar} />
                      <AvatarFallback className="text-[10px]">
                        {subTask.assignee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-20">{subTask.assignee.name}</span>
                  </div>
                )}
                
                {subTask.dueDate && (
                  <span className={cn(
                    "flex items-center gap-1",
                    isOverdue && "text-destructive"
                  )}>
                    <Calendar className="h-3 w-3" />
                    {new Date(subTask.dueDate).toLocaleDateString()}
                  </span>
                )}
                
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(subTask.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className={cn(
              "flex items-center gap-1 transition-opacity duration-200",
              isHovered ? "opacity-100" : "opacity-0"
            )}>
              {onViewDetails && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onViewDetails(subTask)}
                  title="View Comments & Time"
                  className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary"
                >
                  <MessageCircle className="h-3 w-3" />
                </Button>
              )}
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onAssign(subTask)}
                title="Assign Sub-task"
                className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary"
              >
                <User className="h-3 w-3" />
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(subTask)}
                title="Edit Sub-task"
                className="h-7 w-7 p-0 hover:bg-accent hover:text-accent-foreground"
              >
                <Edit className="h-3 w-3" />
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(subTask._id)}
                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                title="Delete Sub-task"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
  );
}