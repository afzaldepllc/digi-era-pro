"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useProjectAnalytics } from "@/hooks/use-analytics";
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Clock,
  Target,
  Users,
  AlertTriangle,
  CheckCircle,
  Calendar,
  BarChart3,
  PieChart,
  LineChart,
  Download,
  Filter,
  RefreshCw
} from "lucide-react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ResponsiveContainer, 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';

interface ProjectAnalyticsProps {
  projectId: string;
}

interface AnalyticsData {
  overview: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    totalTeamMembers: number;
    budget: {
      allocated: number;
      spent: number;
      remaining: number;
    };
    timeline: {
      totalDays: number;
      daysPassed: number;
      daysRemaining: number;
      isOnTrack: boolean;
    };
  };
  performance: {
    completionRate: number;
    averageTaskDuration: number;
    productivityScore: number;
    qualityScore: number;
  };
  trends: {
    tasksCompleted: Array<{ date: string; completed: number; created: number }>;
    budgetUtilization: Array<{ month: string; budgeted: number; actual: number }>;
    teamEfficiency: Array<{ member: string; efficiency: number; tasks: number }>;
  };
  milestones: {
    total: number;
    completed: number;
    onTime: number;
    delayed: number;
  };
  phases: {
    current: string;
    phases: Array<{
      name: string;
      progress: number;
      status: 'completed' | 'active' | 'planned' | 'delayed';
      budget: number;
      daysSpent: number;
    }>;
  };
  risks: Array<{
    type: 'budget' | 'timeline' | 'quality' | 'resource';
    level: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    impact: string;
    mitigation: string;
  }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function ProjectAnalytics({ projectId }: ProjectAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [refreshing, setRefreshing] = useState(false);

  // Use analytics hook for real data
  const { analytics, loading, error, refetch } = useProjectAnalytics(projectId, timeRange);

  useEffect(() => {
    // Effect will trigger refetch when dependencies change
  }, [projectId, timeRange]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <span>Loading analytics...</span>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
        {/* @ts-ignore */}
        <p>{error ? `Error loading analytics: ${error?.message}` : "No analytics data available"}</p>
      </div>
    );
  }

  const data = analytics;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-emerald-700 border-emerald-200';
      case 'medium': return 'text-amber-700 border-amber-200';
      case 'high': return 'text-orange-700 border-orange-200';
      case 'critical': return 'text-red-700 border-red-200';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Project Analytics</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Task Completion</p>
                <p className="text-2xl font-bold">{data.overview.completionRate}%</p>
                <p className="text-xs text-emerald-600 flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +5% from last month
                </p>
              </div>
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Budget Utilization</p>
                <p className="text-2xl font-bold">{Math.round((data.phases.totalActualCost / data.phases.totalBudget) * 100)}%</p>
                <p className="text-xs text-amber-600 flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  On track
                </p>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Timeline Progress</p>
                <p className="text-2xl font-bold">{data.phases.completionRate}%</p>
                <p className="text-xs text-emerald-600 flex items-center mt-1">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {data.phases.completionRate > 50 ? 'On track' : 'Behind schedule'}
                </p>
              </div>
              <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Team Productivity</p>
                <p className="text-2xl font-bold">{Math.round(data.performance.productivity * 10)}</p>
                <p className="text-xs text-emerald-600 flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Excellent performance
                </p>
              </div>
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Task Progress Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Task Completion Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.trends.tasks}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="completed" stackId="1" stroke="#10b981" fill="#10b981" />
                    <Area type="monotone" dataKey="created" stackId="1" stroke="#3b82f6" fill="#3b82f6" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Phase Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Phase Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: 'Planning', progress: 100, status: 'completed' as const, budget: 10000, daysSpent: 15 },
                  { name: 'Development', progress: 75, status: 'active' as const, budget: 50000, daysSpent: 30 },
                  { name: 'Testing', progress: 25, status: 'planned' as const, budget: 15000, daysSpent: 0 },
                  { name: 'Deployment', progress: 0, status: 'planned' as const, budget: 5000, daysSpent: 0 }
                ].map((phase: any, index: number) => (
                  <div key={phase.name} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{phase.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge className={
                          phase.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          phase.status === 'active' ? 'bg-primary/10 text-primary' :
                          phase.status === 'delayed' ? 'bg-red-100 text-red-700' :
                          'bg-muted text-muted-foreground'
                        }>
                          {phase.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{phase.progress}%</span>
                      </div>
                    </div>
                    <Progress value={phase.progress} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Milestone Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Milestone Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-xl font-bold text-primary">{data.milestones.totalMilestones}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <div className="text-xl font-bold text-emerald-600">{data.milestones.completedMilestones}</div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-xl font-bold text-green-600">{data.milestones.onTimeMilestones}</div>
                  <div className="text-sm text-muted-foreground">On Time</div>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-xl font-bold text-red-600">{data.milestones.overdueMilestones}</div>
                  <div className="text-sm text-muted-foreground">Delayed</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Completion Rate</span>
                    <span className="text-sm font-medium">{data.overview.completionRate}%</span>
                  </div>
                  <Progress value={data.overview.completionRate} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Productivity Score</span>
                    <span className="text-sm font-medium">{Math.round(data.performance.productivity * 10)}/100</span>
                  </div>
                  <Progress value={Math.round(data.performance.productivity * 10)} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Quality Score</span>
                    <span className="text-sm font-medium">85/100</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-primary">{data.performance.averageTaskDuration}</div>
                    <div className="text-xs text-muted-foreground">Avg Task Duration (days)</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-emerald-600">{data.tasks.completedTasks}</div>
                    <div className="text-xs text-muted-foreground">Tasks Completed</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Efficiency */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Team Efficiency</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart data={[
                    { member: 'John Doe', efficiency: 85 },
                    { member: 'Jane Smith', efficiency: 92 },
                    { member: 'Bob Wilson', efficiency: 78 },
                    { member: 'Alice Brown', efficiency: 88 }
                  ]} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="member" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="efficiency" fill="#3b82f6" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="budget" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Budget Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Budget Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Budget Utilization</span>
                    <span className="text-sm font-medium">
                      {Math.round((data.phases.totalActualCost / data.phases.totalBudget) * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={(data.phases.totalActualCost / data.phases.totalBudget) * 100} 
                    className="h-2" 
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <div className="text-lg font-bold text-primary">
                      ${(data.phases.totalBudget / 1000).toFixed(0)}K
                    </div>
                    <div className="text-xs text-muted-foreground">Allocated</div>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <div className="text-lg font-bold text-amber-600">
                      ${(data.phases.totalActualCost / 1000).toFixed(0)}K
                    </div>
                    <div className="text-xs text-muted-foreground">Spent</div>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <div className="text-lg font-bold text-emerald-600">
                      ${((data.phases.totalBudget - data.phases.totalActualCost) / 1000).toFixed(0)}K
                    </div>
                    <div className="text-xs text-muted-foreground">Remaining</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Budget Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Budget vs Actual Spending</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart data={[
                    { month: 'Jan', budgeted: 10000, actual: 9500 },
                    { month: 'Feb', budgeted: 12000, actual: 11800 },
                    { month: 'Mar', budgeted: 8000, actual: 8200 },
                    { month: 'Apr', budgeted: 15000, actual: 14500 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="budgeted" fill="#3b82f6" name="Budgeted" />
                    <Bar dataKey="actual" fill="#10b981" name="Actual" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          {/* Team Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Performance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-primary/10 rounded-lg">
                  <div className="text-xl font-bold text-primary">{data.performance?.activeTeamMembers || 8}</div>
                  <div className="text-sm text-muted-foreground">Team Members</div>
                </div>
                <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <div className="text-xl font-bold text-emerald-600">{data.performance?.productivity || 85}</div>
                  <div className="text-sm text-muted-foreground">Avg Productivity</div>
                </div>
                <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <div className="text-xl font-bold text-amber-600">{data.tasks?.completedTasks || 156}</div>
                  <div className="text-sm text-muted-foreground">Tasks Completed</div>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-xl font-bold text-purple-600">{Math.round((data.performance?.productivity || 85) * 0.95)}</div>
                  <div className="text-sm text-muted-foreground">Quality Score</div>
                </div>
              </div>

              {/* Individual Performance */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Individual Performance</h4>
                {[
                  { member: 'John Doe', efficiency: 85, tasks: 12 },
                  { member: 'Jane Smith', efficiency: 92, tasks: 15 },
                  { member: 'Bob Wilson', efficiency: 78, tasks: 9 },
                  { member: 'Alice Brown', efficiency: 88, tasks: 11 }
                ].map((member: { member: string; efficiency: number; tasks: number }, index: number) => (
                  <div key={member.member} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-sm font-medium">{member.member.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="font-medium text-sm">{member.member}</div>
                        <div className="text-xs text-muted-foreground">{member.tasks} tasks completed</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{member.efficiency}%</div>
                      <div className="text-xs text-muted-foreground">Efficiency</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          {/* Risk Assessment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Risk Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.risks.map((risk, index) => (
                <div key={index} className={`p-4 rounded-lg border bg-transparent ${getRiskColor(risk.level)}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium capitalize">{risk.type} Risk</span>
                    </div>
                    <Badge variant="outline" className={`capitalize ${getRiskColor(risk.level)} border-current`}>
                      {risk.level}
                    </Badge>
                  </div>
                  
                  <p className="text-sm mb-2">{risk.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-medium">Impact: </span>
                      <span>{risk.impact}</span>
                    </div>
                    <div>
                      <span className="font-medium">Mitigation: </span>
                      <span>{risk.mitigation}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}