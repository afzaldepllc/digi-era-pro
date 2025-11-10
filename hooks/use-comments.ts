import { useCallback, useMemo } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import {
  useGenericQuery,
  useGenericCreate,
  useGenericUpdate,
  useGenericDelete,
  type UseGenericQueryOptions,
} from './use-generic-query'
import { useQueryClient } from "@tanstack/react-query"
import { apiRequest, handleAPIError } from '@/lib/utils/api-client'
import type {
  CreateCommentFormData,
  UpdateCommentFormData,
  CommentQueryParams,
} from '@/lib/validations/comment'

// Comment state type
interface CommentState {
  comments: any[]
  selectedComment: any | null
  loading: boolean
  actionLoading: boolean
  error: any
  filters: {
    taskId?: string
    projectId?: string
    authorId?: string
  }
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export function useComments() {
  const dispatch = useAppDispatch()

  // Since we don't have a comment slice yet, we'll manage state locally
  // In a full implementation, you would create a commentSlice similar to taskSlice
  const initialState: CommentState = {
    comments: [],
    selectedComment: null,
    loading: false,
    actionLoading: false,
    error: null,
    filters: {},
    pagination: { page: 1, limit: 20, total: 0, pages: 0 },
  }

  // For now, we'll use a simplified approach with TanStack Query only
  // Define options for generic hooks
  const commentOptions: UseGenericQueryOptions<any> = {
    entityName: 'comments',
    baseUrl: '/api/comments',
    reduxDispatchers: {
      setEntities: () => {}, // Placeholder - would use Redux in full implementation
      setEntity: () => {},
      setPagination: () => {},
      setLoading: () => {},
      setActionLoading: () => {},
      setError: () => {},
      clearError: () => {},
    },
  }

  const queryClient = useQueryClient()

  // Fetch comments for a specific task
  const useTaskComments = (taskId: string, projectId?: string) => {
    const queryParams = useMemo(() => ({
      taskId,
      projectId: projectId || '',
      page: 1,
      limit: 50, // Load more comments for tasks
    }), [taskId, projectId])

    return useGenericQuery(
      {
        ...commentOptions,
        entityName: `task-comments-${taskId}`,
      },
      queryParams,
      !!taskId
    )
  }

  // CRUD operations
  const createMutation = useGenericCreate(commentOptions)
  const updateMutation = useGenericUpdate(commentOptions)
  const deleteMutation = useGenericDelete(commentOptions)

  // Create comment
  const createComment = useCallback(async (commentData: CreateCommentFormData) => {
    try {
      const result = await createMutation.mutateAsync(commentData)
      
      // Invalidate task comments cache
      await queryClient.invalidateQueries({ 
        queryKey: ['comments', 'task-comments', commentData.taskId] 
      })
      
      return result
    } catch (error) {
      handleAPIError(error, 'Failed to create comment')
      throw error
    }
  }, [createMutation, queryClient])

  // Update comment
  const updateComment = useCallback(async (id: string, data: UpdateCommentFormData) => {
    try {
      const result = await updateMutation.mutateAsync({ id, data })
      
      // Invalidate related caches
      await queryClient.invalidateQueries({ 
        queryKey: ['comments'] 
      })
      
      return result
    } catch (error) {
      handleAPIError(error, 'Failed to update comment')
      throw error
    }
  }, [updateMutation, queryClient])

  // Delete comment
  const deleteComment = useCallback(async (commentId: string) => {
    try {
      const result = await deleteMutation.mutateAsync(commentId)
      
      // Invalidate related caches
      await queryClient.invalidateQueries({ 
        queryKey: ['comments'] 
      })
      
      return result
    } catch (error) {
      handleAPIError(error, 'Failed to delete comment')
      throw error
    }
  }, [deleteMutation, queryClient])

  // Reply to comment
  const replyToComment = useCallback(async (commentData: CreateCommentFormData & { parentCommentId: string }) => {
    try {
      const result = await createMutation.mutateAsync(commentData)
      
      // Invalidate task comments cache
      await queryClient.invalidateQueries({ 
        queryKey: ['comments', 'task-comments', commentData.taskId] 
      })
      
      return result
    } catch (error) {
      handleAPIError(error, 'Failed to reply to comment')
      throw error
    }
  }, [createMutation, queryClient])

  // Refresh comments for a task
  const refreshTaskComments = useCallback(async (taskId: string) => {
    await queryClient.invalidateQueries({ 
      queryKey: ['comments', 'task-comments', taskId] 
    })
  }, [queryClient])

  return {
    // Hooks
    useTaskComments,
    
    // Actions
    createComment,
    updateComment,
    deleteComment,
    replyToComment,
    refreshTaskComments,
    
    // Mutation states
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    
    // Errors
    createError: createMutation.error,
    updateError: updateMutation.error,
    deleteError: deleteMutation.error,
  }
}