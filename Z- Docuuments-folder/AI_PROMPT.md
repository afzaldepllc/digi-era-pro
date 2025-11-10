

#### project categorization department wise 

right now there are many issues and need many improvements and new things



### prompt for ai  now not focus on this one 

use the provided .md files to understand the flow and current project structure of this crm and than meet my requirements mention below 


You are an expert in React, Next.js, Redux Toolkit, and TanStack Query (React Query). I have a CRM project where the Department CRUD has been successfully migrated to a new generic approach using TanStack Query for server state (data fetching, caching, mutations) and minimal Redux for client/UI state (filters, pagination, selected items). The implementation uses generic hooks like useGenericQuery, useGenericCreate, etc., with flexible API response handling (response || response.data), and follows the patterns in the updated COMPLETE-CRUD-IMPLEMENTATION-FINAL-VERSIONE.md and COMPLETE-CRUD-IMPLEMENTATION-FINAL-VERSIONE.md.

Now, I need to apply the exact same generic approach to all other CRUD modules in the app: Users, Roles, Projects, Clients, Leads, Tasks, Communications, Settings, and System Permissions. Each module currently has custom Redux slices, hooks (e.g., useUsers, useRoles), and components, but they should be migrated to use the generic hooks instead, eliminating duplication and simplifying Redux to UI state only.

Key Requirements:

Reference Implementation: Use the Department CRUD as the blueprint—migrate each module identically (update hooks to use generic hooks, simplify Redux slices to UI state only, update components to leverage TanStack Query's automatic fetching).
Generic & Reusable: Leverage existing generic hooks (useGenericQuery, useGenericCreate, etc.) from use-generic-query.ts. Do not create new custom hooks per module; adapt existing ones to call the generics.
Optimized & Concise: Minimize changes—update existing files minimally. Ensure stable callbacks, memoization, and no unnecessary re-renders. Integrate with existing apiRequest, handleAPIError, and caching.
API Response Handling: Use response || response.data for all data extraction in queries/mutations.
Caching & Performance: TanStack Query handles frontend caching; backend executeGenericDbQuery remains.
Type Safety: Full TypeScript support using existing types from validations.
Error Handling: Use existing handleAPIError.
No Breaking Changes: Existing components should work with minimal tweaks.
Step-by-Step Migration: For each module, provide clear steps with code snippets, file paths, and explanations. Start with Users, then proceed systematically through the list (Roles, Projects, Clients, Leads, Tasks, Communications, Settings, System Permissions).
Testing & Edge Cases: Test each migrated module thoroughly (CRUD operations, loading states, error handling, caching). Handle offline states and provide rollback guidance.
Benefits/Trade-offs: Reduced boilerplate, better UX, but slight bundle size increase.
Project Context:

Current setup: Each module has custom Redux slices with async thunks, hooks with manual fetching, and components with useEffect for API calls.
Existing files: Reference use-users.ts, userSlice.ts, page.tsx, etc., and the Department implementation as the pattern.
Entity Examples: Use "users" as the first example, then generalize for others.
Migration Steps (Repeat for Each Module):

Update Custom Hook (e.g., useUsers to use generic hooks).
Simplify Redux Slice (e.g., userSlice to UI state only).
Update Components (e.g., page.tsx to remove manual fetching).
Test the Module.
Repeat for Next Module.
Provide full code for each step, including file paths. Ensure production-ready code following the Department blueprint. Start with Users and list all modules in order.

**Critical Fixes from Users Migration (Apply These to All Future Migrations):**

1. **API Parameter Formatting**: Always transform query params correctly in useGenericQuery (e.g., `apiParams.sortBy = params.sort.field; apiParams.sortOrder = params.sort.direction;`). Check existing API endpoints for expected param formats.

2. **Memoization**: Always use `useMemo` for query keys and params in generic hooks and custom hooks to prevent infinite re-renders. Disable stale time for fresh data if needed.

3. **Loading States**: Combine TanStack Query loading states with Redux states. Update components to use combined loading (e.g., `isLoading || userByIdLoading`).

4. **Response Handling**: For Redux thunks (like fetchRolesByDepartment), handle responses as `result.payload` or `result.data`. For TanStack Query, use `response || response.data`. Validate ObjectIds before API calls.

5. **Form Population**: Provide valid default values for all form fields to prevent React warnings. Use `form.setValue` after async data loads (e.g., after roles fetch) to set department/role selections.

6. **Error Prevention**: Add ObjectId validation before dependent API calls. Ensure useGenericQueryById extracts entity correctly from API response. Use combined loading to prevent premature rendering.

7. **Query Keys**: Memoize query keys properly to avoid infinite loops. Include all relevant params in keys for proper cache invalidation.

If issues arise, reference the Department implementation and the "Recent Updates & Fixes" section in COMPLETE-CRUD-IMPLEMENTATION-FINAL-VERSIONE.md and COMPLETE-CRUD-IMPLEMENTATION-FINAL-VERSIONE.md for solutions. These fixes ensure smooth migration without repeating errors encountered in Users CRUD.



also ensure that if department need in the communication crud this follow this one like in the users crud
  const [availableDepartments, setAvailableDepartments] = useState<Array<{ value: string, label: string }>>([]);

  const { allDepartments } = useDepartments();
  // Fetch available departments for filter
  const fetchAvailableDepartments = useCallback(async () => {
    try {
      // Use allDepartments from the hook instead of fetching
      const currentAllDepartments = allDepartments;
      if (currentAllDepartments && currentAllDepartments.length > 0) {
        const departmentOptions = currentAllDepartments.map((dept: any) => ({
          value: dept._id,
          label: dept.name,
        })) || [];
        setAvailableDepartments(departmentOptions);
      }
    } catch (error) {
      console.error('Failed to fetch departments for filter:', error);
      handleAPIError(error, "Failed to load departments for filtering");
    }
  }, []); // Remove allDepartments from dependencies to prevent infinite re-runs

  // Fetch roles and departments for filters on mount
  useEffect(() => {
    fetchAvailableRoles();
    if (availableDepartments.length === 0) {
      fetchAvailableDepartments();
    }
  }, [fetchAvailableRoles, fetchAvailableDepartments]);

  // Update available departments when allDepartments changes
  useEffect(() => {
    if (allDepartments && allDepartments.length > 0) {
      const departmentOptions = allDepartments.map((dept: any) => ({
        value: dept._id,
        label: dept.name,
      })) || [];
      setAvailableDepartments(departmentOptions);
    }
  }, [allDepartments]);


     key: 'department',
        label: 'Department',
        type: 'select',
searchable: true,
        placeholder: 'All Departments',
        cols: 12, // Full width on mobile
        mdCols: 6, // Half width on medium screens
        lgCols: 3, // Quarter width on large screens
        options: [
          { value: 'all', label: 'All Departments' },
          ...availableDepartments,
        ],
      },
    ],
    defaultValues: {
      search: '',
      role: 'all',
      status: 'all',
      department: 'all',
    },
  }), [availableRoles, availableDepartments]);

department, roles,permission and users,leads,client are "PROJECTS" AND "TASKS" implemented and  working well right now
now just implement new appraoch only on the "COMMUNICATION" AND "CLIENT PORTAL" crud ONLY  AND  ensure that every things should be working well




ensure that the "COMMUNICATION" AND "CLIENT PORTAL" migrated with the new way mentioned in the given .md files and every things shoulod be working well 






