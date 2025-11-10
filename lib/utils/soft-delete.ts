import mongoose from 'mongoose'
import { clearCache } from '../mongodb'

// Type definitions for dependency checking
interface DependencyCheck {
    model: string
    field: string
    errorMessage: string
}

// Dependency map for soft delete checks
const DEPENDENCY_CHECKS: Record<string, DependencyCheck[]> = {
    department: [
        {
            model: 'User',
            field: 'department',
            errorMessage: 'Cannot delete department: active users are assigned to this department'
        },
        {
            model: 'Role',
            field: 'department',
            errorMessage: 'Cannot delete department: active roles are assigned to this department'
        }
    ],
    role: [
        {
            model: 'User',
            field: 'role',
            errorMessage: 'Cannot delete role: active users are assigned to this role'
        }
    ],
    user: [], // Regular users have no dependencies by default
    client: [], // Clients can be deleted (they are created from leads, so no dependencies)
    lead: [
        {
            model: 'User',
            field: 'leadId',
            errorMessage: 'Cannot delete lead: an active client is created from this lead. Delete the client first.'
        }
    ] // Leads cannot be deleted if a client exists for them
}/**
 * Generic function to check if an entity can be soft deleted
 * @param modelName - The name of the model (lowercase)
 * @param entityId - The ID of the entity to check
 * @returns Promise<{ canDelete: boolean, reason?: string }>
 */
export async function canSoftDelete(
    modelName: string,
    entityId: string
): Promise<{ canDelete: boolean; reason?: string }> {
    try {
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(entityId)) {
            return { canDelete: false, reason: 'Invalid entity ID' }
        }

        // Get dependency checks for this model
        let checks = DEPENDENCY_CHECKS[modelName.toLowerCase()] || []

        // Special handling for users - check if they are clients
        if (modelName.toLowerCase() === 'user') {
            const UserModel = mongoose.models.User
            if (UserModel) {
                const user = await UserModel.findById(entityId).select('isClient')
                if (user?.isClient) {
                    // If this is a client user, use client dependency checks (which is empty - clients can be deleted)
                    checks = DEPENDENCY_CHECKS['client'] || []
                }
            }
        }

        // If no dependency checks, entity can be deleted
        if (checks.length === 0) {
            return { canDelete: true }
        }

        // Check each dependency
        for (const check of checks) {
            const DependentModel = mongoose.models[check.model]
            if (!DependentModel) {
                console.warn(`Model ${check.model} not found for dependency check`)
                continue
            }

            // Build dependency filter
            let dependentFilter: any = {
                [check.field]: new mongoose.Types.ObjectId(entityId),
                status: { $ne: 'deleted' } // Exclude already deleted records
            }

            // Special handling for User dependencies from leads - check for active clients only
            if (check.model === 'User' && modelName.toLowerCase() === 'lead') {
                dependentFilter.isClient = true // Only check client users
                dependentFilter.status = { $ne: 'deleted' } // Exclude deleted clients
            }

            const dependentCount = await DependentModel.countDocuments(dependentFilter)

            if (dependentCount > 0) {
                return {
                    canDelete: false,
                    reason: `${check.errorMessage} (${dependentCount} active record${dependentCount > 1 ? 's' : ''} found)`
                }
            }
        }

        return { canDelete: true }
    } catch (error) {
        console.error('Error checking soft delete dependencies:', error)
        return {
            canDelete: false,
            reason: 'Error checking dependencies. Please try again.'
        }
    }
}

/**
 * Generic function to perform soft delete on an entity
 * @param modelName - The name of the model
 * @param entityId - The ID of the entity to soft delete
 * @param userEmail - Email of the user performing the action (for logging)
 * @returns Promise<{ success: boolean, message: string, data?: any }>
 */
export async function performSoftDelete(
    modelName: string,
    entityId: string,
    userEmail: string
): Promise<{ success: boolean; message: string; data?: any }> {
    try {
        // First check if entity can be deleted
        const deleteCheck = await canSoftDelete(modelName, entityId)
        if (!deleteCheck.canDelete) {
            return {
                success: false,
                message: deleteCheck.reason || 'Cannot delete entity'
            }
        }

        // Get the model - handle Lead model specifically
        let Model
        if (modelName.toLowerCase() === 'lead') {
            Model = mongoose.models.Lead
        } else {
            Model = mongoose.models[modelName.charAt(0).toUpperCase() + modelName.slice(1)]
        }

        if (!Model) {
            return {
                success: false,
                message: `Model ${modelName} not found`
            }
        }

        // Check if entity exists and is not already deleted
        let existingEntity
        if (modelName.toLowerCase() === 'lead') {
            // For leads, check for active status (leads use different status values)
            existingEntity = await Model.findOne({
                _id: entityId,
                status: { $nin: ['deleted', 'inactive'] } // Consider inactive as soft deleted for leads
            })
        } else {
            // For other models, use standard status check
            existingEntity = await Model.findOne({
                _id: entityId,
                status: { $ne: 'deleted' }
            })
        }

        if (!existingEntity) {
            return {
                success: false,
                message: `${modelName.charAt(0).toUpperCase() + modelName.slice(1)} not found or already deleted`
            }
        }

        // Perform soft delete
        let updatedEntity
        if (modelName.toLowerCase() === 'lead') {
            // For leads, set status to 'deleted' (adding it to Lead model enum)
            updatedEntity = await Model.findByIdAndUpdate(
                entityId,
                {
                    $set: {
                        status: 'deleted',
                        updatedAt: new Date()
                    }
                },
                { new: true, runValidators: false }
            )
        } else {
            // For other models, set status to 'deleted'
            updatedEntity = await Model.findByIdAndUpdate(
                entityId,
                {
                    $set: {
                        status: 'deleted',
                        deletedAt: new Date(),
                        deletedBy: userEmail
                    }
                },
                { new: true, runValidators: false }
            )
        }

        if (!updatedEntity) {
            return {
                success: false,
                message: `Failed to delete ${modelName}`
            }
        }

        // Clear relevant caches
        await clearCacheForEntity(modelName, entityId)

        // Log the action
        console.log(`${modelName.charAt(0).toUpperCase() + modelName.slice(1)} soft deleted:`, {
            entityId,
            entityName: updatedEntity.name || updatedEntity.projectName || updatedEntity.displayName || 'Unknown',
            deletedBy: userEmail,
            timestamp: new Date().toISOString()
        })

        return {
            success: true,
            message: `${modelName.charAt(0).toUpperCase() + modelName.slice(1)} deleted successfully`,
            data: updatedEntity
        }
    } catch (error) {
        console.error(`Error performing soft delete for ${modelName}:`, error)
        return {
            success: false,
            message: `Failed to delete ${modelName}. Please try again.`
        }
    }
}

/**
 * Clear caches related to an entity
 * @param modelName - The name of the model
 * @param entityId - The ID of the entity
 */
async function clearCacheForEntity(modelName: string, entityId: string): Promise<void> {
    try {
        const cacheKeys = [
            `${modelName}s:*`, // List caches
            `${modelName}-${entityId}*`, // Individual entity caches
            `${modelName}-*-${entityId}*`, // Related caches
        ]

        for (const pattern of cacheKeys) {
            await clearCache(pattern)
        }
    } catch (error) {
        console.error('Error clearing cache:', error)
    }
}

/**
 * Helper function to get base filter for excluding deleted records
 * @param isSuperAdmin - Whether the user is a super admin
 * @returns MongoDB filter object
 */
export function getBaseFilter(isSuperAdmin: boolean = false): Record<string, any> {
    if (isSuperAdmin) {
        return {} // Super admins see all records including deleted
    }
    return { status: { $ne: 'deleted' } } // Regular users don't see deleted records
}

/**
 * Helper function to add soft delete filter to existing query
 * @param existingFilter - Existing MongoDB filter
 * @param isSuperAdmin - Whether the user is a super admin
 * @returns Combined filter with soft delete logic
 */
export function addSoftDeleteFilter(
    existingFilter: Record<string, any>,
    isSuperAdmin: boolean = false
): Record<string, any> {
    if (isSuperAdmin) {
        return existingFilter // Super admins see all records
    }

    const result = { ...existingFilter }

    if (result.status !== undefined) {
        // If status already exists, combine it with soft delete filter
        const existingStatusFilter = typeof result.status === 'object' ? result.status : { $eq: result.status }
        result.status = { $and: [{ status: existingStatusFilter }, { status: { $ne: 'deleted' } }] }
    } else {
        // If no status filter, just add soft delete filter
        result.status = { status: { $ne: 'deleted' } }
    }

    return result.status
}

/**
 * Add a new dependency check for a model
 * @param modelName - The model name to add dependency for
 * @param checks - Array of dependency checks
 */
export function addDependencyChecks(modelName: string, checks: DependencyCheck[]): void {
    DEPENDENCY_CHECKS[modelName.toLowerCase()] = [
        ...(DEPENDENCY_CHECKS[modelName.toLowerCase()] || []),
        ...checks
    ]
}

// Export dependency checks for reference
export { DEPENDENCY_CHECKS }
