"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Edit, Settings, Share2, MoreVertical, Clock, DollarSign, Users, Target, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/ui/page-header";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";

// Import our new components
import { MilestonesSection } from "@/components/projects/MilestonesSection";
import { PhasesTimeline } from "@/components/projects/PhasesTimeline";
import { ProjectAnalytics } from "@/components/projects/ProjectAnalytics";
import { ProjectCategorization } from "@/components/projects/ProjectCategorization";
import { ProjectEditTab } from "@/components/projects/ProjectEditTab";

interface ProjectDetails {
  _id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'on-hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: string;
  endDate: string;
  budget: number;
  actualCost: number;
  progress: number;
  clientId: string;
  client: {
    _id: string;
    name: string;
    email: string;
    company?: string;
  };
  projectManagerId: string;
  projectManager: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  teamMemberIds: string[];
  teamMembers: Array<{
    _id: string;
    name: string;
    email: string;
    avatar?: string;
    role?: string;
  }>;
  departmentId: string;
  department: {
    _id: string;
    name: string;
    color?: string;
  };
  tags: string[];
  deliverables: string[];
  objectives: string[];
  risks: string[];
  createdAt: string;
  updatedAt: string;
}

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { canUpdate, canDelete } = usePermissions();

  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('project-details-active-tab') || 'overview';
    }
    return 'overview';
  });

  const projectId = params?.id as string;

  // Fetch project details
  const fetchProject = async () => {
    try {
      setLoading(true);

      // Mock data - in real app this would fetch from API
      // const response = await fetch(`/api/projects/${projectId}`);
      // const projectData = await response.json();

      // Mock project data
      const mockProject: ProjectDetails = {
        _id: projectId,
        name: "CRM System Enhancement",
        description: "Enhance the existing CRM system with advanced task management, milestone tracking, and analytics features to improve project delivery and client satisfaction.",
        status: 'active',
        priority: 'high',
        startDate: '2025-01-01',
        endDate: '2025-06-30',
        budget: 120000,
        actualCost: 78000,
        progress: 65,
        clientId: 'client1',
        client: {
          _id: 'client1',
          name: 'TechCorp Solutions',
          email: 'contact@techcorp.com',
          company: 'TechCorp Inc.'
        },
        projectManagerId: 'pm1',
        projectManager: {
          _id: 'pm1',
          name: 'Sarah Wilson',
          email: 'sarah@example.com',
          avatar: '/avatars/sarah.jpg'
        },
        teamMemberIds: ['user1', 'user2', 'user3', 'user4'],
        teamMembers: [
          { _id: 'user1', name: 'Mike Developer', email: 'mike@example.com', role: 'Frontend Developer' },
          { _id: 'user2', name: 'Alex Johnson', email: 'alex@example.com', role: 'Backend Developer' },
          { _id: 'user3', name: 'Emma Wilson', email: 'emma@example.com', role: 'UI/UX Designer' },
          { _id: 'user4', name: 'David Chen', email: 'david@example.com', role: 'QA Engineer' },
        ],
        departmentId: 'dept1',
        department: {
          _id: 'dept1',
          name: 'Development',
          color: '#3b82f6'
        },
        tags: ['CRM', 'Enhancement', 'Task Management', 'Analytics'],
        deliverables: [
          'Enhanced Task Management System',
          'Milestone Tracking Features',
          'Advanced Analytics Dashboard',
          'User Documentation',
          'Training Materials'
        ],
        objectives: [
          'Improve project tracking accuracy by 40%',
          'Reduce project delivery time by 25%',
          'Enhance client communication and satisfaction',
          'Implement comprehensive analytics and reporting'
        ],
        risks: [
          'Potential scope creep from client requirements',
          'Third-party integration dependencies',
          'Team member availability during peak season'
        ],
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-15T12:30:00Z',
      };

      setProject(mockProject);
    } catch (error) {
      console.error('Error fetching project:', error);
      toast({
        title: "Error",
        description: "Failed to load project details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId, toast]);

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('project-details-active-tab', activeTab);
    }
  }, [activeTab]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20';
      case 'completed': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20';
      case 'on-hold': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/20';
      case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/20';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700 dark:bg-red-900/20';
      case 'high': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20';
      case 'medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/20';
      default: return 'bg-green-100 text-green-700 dark:bg-green-900/20';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p>Loading project details...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Project not found</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={project.name}
        subtitle={project.description}
        actions={
          <div className="flex items-center gap-2">
            {/* <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button> */}
            <Button variant="outline" onClick={() => router.push('/projects')} size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Projects List
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Settings className="h-4 w-4" />
                  Project Settings
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Archive className="h-4 w-4" />
                  Archive Project
                </DropdownMenuItem>
                {canDelete("projects") && (
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                    Delete Project
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

          </div>
        }
      />

      {/* Project Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="text-2xl font-bold">{project.progress}%</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Target className="h-5 w-5 text-primary" />
              </div>
            </div>
            <Progress value={project.progress} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Budget Usage</p>
                <p className="text-2xl font-bold">{Math.round((project.actualCost / project.budget) * 100)}%</p>
              </div>
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              ${project.actualCost.toLocaleString()} / ${project.budget.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Team Size</p>
                <p className="text-2xl font-bold">{project.teamMembers.length}</p>
              </div>
              <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Active members
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Time Remaining</p>
                <p className="text-2xl font-bold">
                  {Math.max(0, Math.ceil((new Date(project.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))}
                </p>
              </div>
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Days left
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Details Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="categorization">Categorize & Task Creation</TabsTrigger>
          <TabsTrigger value="phases">Phases</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Project Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Project Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Project Information
                    <div className="flex gap-2 ml-auto">
                      <Badge className={getStatusColor(project.status)}>
                        {project.status.replace('-', ' ')}
                      </Badge>
                      <Badge className={getPriorityColor(project.priority)}>
                        {project.priority} priority
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Start Date</label>
                      <p className="font-medium">{new Date(project.startDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">End Date</label>
                      <p className="font-medium">{new Date(project.endDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Department</label>
                      <p className="font-medium">{project.department.name}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Client</label>
                      <p className="font-medium">{project.client.name}</p>
                    </div>
                  </div>

                  {project.tags.length > 0 && (
                    <div>
                      <label className="text-sm text-muted-foreground">Tags</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {project.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Objectives */}
              <Card>
                <CardHeader>
                  <CardTitle>Project Objectives</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {project.objectives.map((objective, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                        <span className="text-sm">{objective}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Deliverables */}
              <Card>
                <CardHeader>
                  <CardTitle>Key Deliverables</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {project.deliverables.map((deliverable, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                        <Target className="h-4 w-4 text-primary" />
                        <span className="text-sm">{deliverable}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* Project Manager & Team */}
              <Card>
                <CardHeader>
                  <CardTitle>Project Manager</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={project.projectManager.avatar} />
                      <AvatarFallback>
                        {project.projectManager.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{project.projectManager.name}</p>
                      <p className="text-sm text-muted-foreground">{project.projectManager.email}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Team Members */}
              <Card>
                <CardHeader>
                  <CardTitle>Team Members ({project.teamMembers.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {project.teamMembers.map((member) => (
                    <div key={member._id} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar} />
                        <AvatarFallback className="text-xs">
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Risks */}
              {project.risks.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-amber-500" />
                      Project Risks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {project.risks.map((risk, index) => (
                        <li key={index} className="text-sm p-2 bg-amber-50 dark:bg-amber-900/10 rounded border-l-2 border-amber-400">
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Created</label>
                    <p className="font-medium">{new Date(project.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Last Updated</label>
                    <p className="font-medium">{new Date(project.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Status</label>
                    <Badge className={getStatusColor(project.status)}>
                      {project.status.replace('-', ' ')}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Priority</label>
                    <Badge className={getPriorityColor(project.priority)}>
                      {project.priority} priority
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div>
                  <label className="text-sm text-muted-foreground">Description</label>
                  <p className="text-sm mt-1">{project.description}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Budget & Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Budget Utilization</span>
                    <span className="text-sm font-medium">
                      {Math.round((project.actualCost / project.budget) * 100)}%
                    </span>
                  </div>
                  <Progress value={(project.actualCost / project.budget) * 100} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>${project.actualCost.toLocaleString()} spent</span>
                    <span>${project.budget.toLocaleString()} budget</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Timeline Progress</span>
                    <span className="text-sm font-medium">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{new Date(project.startDate).toLocaleDateString()}</span>
                    <span>{new Date(project.endDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categorization">
          <ProjectCategorization
            projectId={projectId}
            project={project}
            onProjectUpdate={fetchProject}
          />
        </TabsContent>

        <TabsContent value="phases">
          <PhasesTimeline projectId={projectId} />
        </TabsContent>

        <TabsContent value="milestones">
          <MilestonesSection projectId={projectId} />
        </TabsContent>

        <TabsContent value="edit">
          <ProjectEditTab
            project={project}
            onProjectUpdate={fetchProject}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <ProjectAnalytics projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}