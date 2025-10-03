"use client"

import { useSession } from "next-auth/react"
import { Users, Building2, Target, TrendingUp } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardCharts } from "@/components/dashboard/charts"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function DashboardPage() {
  const { data: session } = useSession()

  const stats = [
    {
      title: "Total Users",
      value: "1,234",
      change: "+12%",
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "Active Deals",
      value: "856",
      change: "+8%",
      icon: Target,
      color: "text-green-600",
    },
    {
      title: "Companies",
      value: "432",
      change: "+15%",
      icon: Building2,
      color: "text-purple-600",
    },
    {
      title: "Revenue",
      value: "$124,500",
      change: "+23%",
      icon: TrendingUp,
      color: "text-orange-600",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {session?.user?.name}!</h1>
          <p className="text-muted-foreground">Here&apos;s what&apos;s happening with your CRM today.</p>
        </div>
        <div className="flex items-center space-x-4">
          <Avatar className="h-12 w-12">
            {session?.user?.image ? (
              <AvatarImage src={session.user.image} />
            ) : (
              <AvatarFallback className="bg-primary text-white text-xl font-semibold">
                {session?.user?.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase() || "U"}
              </AvatarFallback>
            )}
          </Avatar>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">{stat.change}</span> from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Charts Section */}
      <DashboardCharts />

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks to get you started</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium">Manage Users</p>
                <p className="text-sm text-muted-foreground">Add or edit system users</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors">
              <Target className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">View Deals</p>
                <p className="text-sm text-muted-foreground">Track your sales pipeline</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors">
              <Building2 className="h-5 w-5 text-purple-600" />
              <div>
                <p className="font-medium">Companies</p>
                <p className="text-sm text-muted-foreground">Manage company records</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates in your CRM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-blue-600 mt-2"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">New user registered</p>
                <p className="text-xs text-muted-foreground">John Doe joined the system</p>
                <p className="text-xs text-muted-foreground">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-green-600 mt-2"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Deal closed</p>
                <p className="text-xs text-muted-foreground">$15,000 deal with Acme Corp</p>
                <p className="text-xs text-muted-foreground">4 hours ago</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-orange-600 mt-2"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Meeting scheduled</p>
                <p className="text-xs text-muted-foreground">Client call with Tech Solutions</p>
                <p className="text-xs text-muted-foreground">6 hours ago</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current system information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Database</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-green-600"></div>
                <span className="text-sm text-green-600">Connected</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Authentication</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-green-600"></div>
                <span className="text-sm text-green-600">Active</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">API Status</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-green-600"></div>
                <span className="text-sm text-green-600">Operational</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Your Role</span>
              <span className="text-sm font-medium capitalize">{(session?.user as any)?.role || "User"}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}




