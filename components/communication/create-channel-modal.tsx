"use client"

import { useState, useEffect } from 'react'
import CustomModal from '@/components/ui/custom-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Users, Building, FolderKanban, UserCheck, Hash, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

type ChannelType = 'group' | 'department' | 'department-category' | 'multi-category' | 'project' | 'client-support'
type DepartmentCategory = 'sales' | 'support' | 'it' | 'management'

interface CreateChannelModalProps {
  isOpen: boolean
  onClose: () => void
  onChannelCreated?: (channel: any) => void
}

export function CreateChannelModal({
  isOpen,
  onClose,
  onChannelCreated,
}: CreateChannelModalProps) {
  const [channelType, setChannelType] = useState<ChannelType>('group')
  const [channelName, setChannelName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<DepartmentCategory>('sales')
  const [selectedCategories, setSelectedCategories] = useState<DepartmentCategory[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Data for dropdowns
  const [departments, setDepartments] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(false)

  const categories: DepartmentCategory[] = ['sales', 'support', 'it', 'management']

  const clientUsers = users.filter(u => u.isClient === true)
  const regularUsers = users.filter(u => u.isClient !== true)

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchData()
    }
  }, [isOpen])

  const fetchData = async () => {
    try {
      setLoadingData(true)
      
      // Fetch departments
      const deptResponse = await fetch('/api/departments')
      if (deptResponse.ok) {
        const deptData = await deptResponse.json()
        setDepartments(deptData.departments || [])
      }

      // Fetch projects
      const projResponse = await fetch('/api/projects')
      if (projResponse.ok) {
        const projData = await projResponse.json()
        setProjects(projData.projects || [])
      }

      // Fetch users
      const usersResponse = await fetch('/api/users')
      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        setUsers(usersData.users || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const handleCategoryToggle = (category: DepartmentCategory) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const handleMemberToggle = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleCreateChannel = async () => {
    try {
      setLoading(true)

      // Validation
      if (!channelType) {
        toast({ title: 'Error', description: 'Please select a channel type', variant: 'destructive' })
        return
      }

      const payload: any = {
        type: channelType,
        name: channelName || undefined,
        is_private: isPrivate
      }

      // Add type-specific fields
      switch (channelType) {
        case 'group':
          if (selectedMembers.length === 0) {
            toast({ title: 'Error', description: 'Please select at least one member', variant: 'destructive' })
            return
          }
          payload.participants = selectedMembers
          break

        case 'department':
          if (!selectedDepartment) {
            toast({ title: 'Error', description: 'Please select a department', variant: 'destructive' })
            return
          }
          payload.mongo_department_id = selectedDepartment
          break

        case 'department-category':
          payload.category = selectedCategory
          break

        case 'multi-category':
          if (selectedCategories.length === 0) {
            toast({ title: 'Error', description: 'Please select at least one category', variant: 'destructive' })
            return
          }
          payload.categories = selectedCategories
          break

        case 'project':
          if (!selectedProject) {
            toast({ title: 'Error', description: 'Please select a project', variant: 'destructive' })
            return
          }
          payload.mongo_project_id = selectedProject
          break

        case 'client-support':
          if (!selectedClient) {
            toast({ title: 'Error', description: 'Please select a client', variant: 'destructive' })
            return
          }
          payload.client_id = selectedClient
          break
      }

      // Call API
      const response = await fetch('/api/communication/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create channel')
      }

      const data = await response.json()

      toast({
        title: 'Success',
        description: 'Channel created successfully'
      })

      onChannelCreated?.(data.channel)
      onClose()

      // Reset form
      setChannelName('')
      setIsPrivate(false)
      setSelectedDepartment('')
      setSelectedCategory('sales')
      setSelectedCategories([])
      setSelectedProject('')
      setSelectedClient('')
      setSelectedMembers([])

    } catch (error: any) {
      console.error('Error creating channel:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to create channel',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Channel"
      modalSize="xl"
      actions={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreateChannel} disabled={loading || loadingData}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Channel
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
            {/* Channel Type Selection */}
            <div className="space-y-3">
              <Label>Channel Type</Label>
              <div className="space-y-2">
                <div 
                  className={cn(
                    "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                    channelType === 'group' ? "bg-primary/10 border-primary" : "hover:bg-accent"
                  )}
                  onClick={() => setChannelType('group')}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    channelType === 'group' ? "border-primary" : "border-muted-foreground"
                  )}>
                    {channelType === 'group' && <div className="w-3 h-3 rounded-full bg-primary" />}
                  </div>
                  <Users className="h-4 w-4 shrink-0" />
                  <span className="font-normal text-sm">Group Channel - Select specific members</span>
                </div>
                
                <div 
                  className={cn(
                    "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                    channelType === 'department' ? "bg-primary/10 border-primary" : "hover:bg-accent"
                  )}
                  onClick={() => setChannelType('department')}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    channelType === 'department' ? "border-primary" : "border-muted-foreground"
                  )}>
                    {channelType === 'department' && <div className="w-3 h-3 rounded-full bg-primary" />}
                  </div>
                  <Building className="h-4 w-4 shrink-0" />
                  <span className="font-normal text-sm">Department Channel - All users in a department</span>
                </div>
                
                <div 
                  className={cn(
                    "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                    channelType === 'department-category' ? "bg-primary/10 border-primary" : "hover:bg-accent"
                  )}
                  onClick={() => setChannelType('department-category')}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    channelType === 'department-category' ? "border-primary" : "border-muted-foreground"
                  )}>
                    {channelType === 'department-category' && <div className="w-3 h-3 rounded-full bg-primary" />}
                  </div>
                  <Hash className="h-4 w-4 shrink-0" />
                  <span className="font-normal text-sm">Category Channel - All users with same category</span>
                </div>
                
                <div 
                  className={cn(
                    "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                    channelType === 'multi-category' ? "bg-primary/10 border-primary" : "hover:bg-accent"
                  )}
                  onClick={() => setChannelType('multi-category')}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    channelType === 'multi-category' ? "border-primary" : "border-muted-foreground"
                  )}>
                    {channelType === 'multi-category' && <div className="w-3 h-3 rounded-full bg-primary" />}
                  </div>
                  <Hash className="h-4 w-4 shrink-0" />
                  <span className="font-normal text-sm">Multi-Category Channel - Users from multiple categories</span>
                </div>
                
                <div 
                  className={cn(
                    "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                    channelType === 'project' ? "bg-primary/10 border-primary" : "hover:bg-accent"
                  )}
                  onClick={() => setChannelType('project')}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    channelType === 'project' ? "border-primary" : "border-muted-foreground"
                  )}>
                    {channelType === 'project' && <div className="w-3 h-3 rounded-full bg-primary" />}
                  </div>
                  <FolderKanban className="h-4 w-4 shrink-0" />
                  <span className="font-normal text-sm">Project Channel - All project collaborators</span>
                </div>
                
                <div 
                  className={cn(
                    "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                    channelType === 'client-support' ? "bg-primary/10 border-primary" : "hover:bg-accent"
                  )}
                  onClick={() => setChannelType('client-support')}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    channelType === 'client-support' ? "border-primary" : "border-muted-foreground"
                  )}>
                    {channelType === 'client-support' && <div className="w-3 h-3 rounded-full bg-primary" />}
                  </div>
                  <UserCheck className="h-4 w-4 shrink-0" />
                  <span className="font-normal text-sm">Client Support - Client + support team</span>
                </div>
              </div>
            </div>

            {/* Channel Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Channel Name (Optional)</Label>
              <Input
                id="name"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="Leave empty for auto-generated name"
              />
            </div>

            {/* Privacy Setting */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="private"
                checked={isPrivate}
                onCheckedChange={(checked) => setIsPrivate(checked as boolean)}
              />
              <Label htmlFor="private" className="cursor-pointer font-normal">
                Private Channel (hidden from non-members)
              </Label>
            </div>

            {/* Type-Specific Fields */}
            {channelType === 'group' && (
              <div className="space-y-2">
                <Label>Select Members ({selectedMembers.length} selected)</Label>
                <div className="border rounded-md p-4 max-h-60 overflow-y-auto space-y-2">
                  {loadingData ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : regularUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No users available</p>
                  ) : (
                    regularUsers.map(user => (
                      <div key={user._id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`user-${user._id}`}
                          checked={selectedMembers.includes(user._id)}
                          onCheckedChange={() => handleMemberToggle(user._id)}
                        />
                        <Label htmlFor={`user-${user._id}`} className="cursor-pointer flex-1 font-normal">
                          {user.name} ({user.email})
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {channelType === 'department' && (
              <div className="space-y-2">
                <Label htmlFor="department">Select Department</Label>
                {loadingData ? (
                  <div className="flex items-center justify-center p-4 border rounded-md">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger id="department">
                      <SelectValue placeholder="Choose a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">No departments available</div>
                      ) : (
                        departments.map(dept => (
                          <SelectItem key={dept._id} value={dept._id}>
                            {dept.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {channelType === 'department-category' && (
              <div className="space-y-2">
                <Label htmlFor="category">Select Category</Label>
                <Select value={selectedCategory} onValueChange={(val) => setSelectedCategory(val as DepartmentCategory)}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {channelType === 'multi-category' && (
              <div className="space-y-2">
                <Label>Select Categories ({selectedCategories.length} selected)</Label>
                <div className="border rounded-md p-4 space-y-2">
                  {categories.map(cat => (
                    <div key={cat} className="flex items-center space-x-2">
                      <Checkbox
                        id={`cat-${cat}`}
                        checked={selectedCategories.includes(cat)}
                        onCheckedChange={() => handleCategoryToggle(cat)}
                      />
                      <Label htmlFor={`cat-${cat}`} className="cursor-pointer font-normal">
                        {cat.toUpperCase()}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {channelType === 'project' && (
              <div className="space-y-2">
                <Label htmlFor="project">Select Project</Label>
                {loadingData ? (
                  <div className="flex items-center justify-center p-4 border rounded-md">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger id="project">
                      <SelectValue placeholder="Choose a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">No projects available</div>
                      ) : (
                        projects.map(proj => (
                          <SelectItem key={proj._id} value={proj._id}>
                            {proj.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {channelType === 'client-support' && (
              <div className="space-y-2">
                <Label htmlFor="client">Select Client</Label>
                {loadingData ? (
                  <div className="flex items-center justify-center p-4 border rounded-md">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger id="client">
                      <SelectValue placeholder="Choose a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientUsers.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">No clients available</div>
                      ) : (
                        clientUsers.map(client => (
                          <SelectItem key={client._id} value={client._id}>
                            {client.name} ({client.email})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
      </div>
    </CustomModal>
  )
}
