# Guidelines for Implementing Leads Module
The Leads module follows the generic CRUD pattern from the Department blueprint, with customizations for statuses (active, inactive, Qualified, Unqualified), dual-section creation form (client basic info + project basic info), and status change logic that triggers client creation. Leads are stored in a separate leads collection. Use executeGenericDbQuery for all DB operations with appropriate caching (short TTL for volatile data like leads). Optimize by reusing Zod constants, middleware for sales-only access, and Redux for state with optimistic updates on status changes.
## Step 1: Database Layer (models/Lead.ts)

Define Mongoose schema for Lead with fields: name, email, other client basics; projectName, other project basics; status (enum: ['active', 'inactive', 'Qualified', 'Unqualified'], default 'active'); createdBy (ref to User, sales agent); clientId (ref to User, populated later); timestamps.
Add unique constraints on email (case-insensitive).
Implement indexes: compound on status + createdAt; text index on name, email, projectName.
Use pre-save hook for custom validation (e.g., ensure sales agent is from sales department via user ref).
Enable soft delete via status (inactive instead of hard delete).
Optimize: No virtuals unless needed for population; use lean() in queries.

## Step 2: Validation Layer (lib/validations/lead.ts)

Define constants for lengths, statuses, pagination (similar to DEPARTMENT_CONSTANTS).
Create baseLeadSchema with sections: clientInfo (name, email required), projectInfo (projectName required).
Operation schemas: createLeadSchema (full required fields), updateLeadSchema (partial, with refinement to require at least one change).
Add query schema for filtering (page, limit, search, status, sortBy: ['name', 'status', 'createdAt']).
Custom refinement: When updating status to 'Qualified', ensure it's from 'active'; block if already 'Qualified'.
Export types: Lead, CreateLeadData, etc.
Optimize: Use transforms for trimming; coerce for pagination.

## Step 3: API Layer (app/api/leads/route.ts and [id]/route.ts)

Use genericApiRoutesMiddleware for authentication (restrict to sales department roles).
GET (list): Parse query params with departmentQuerySchema analog; build filter ($or for search on name/email/projectName); sort; paginate; parallel executeGenericDbQuery for list, count, stats (e.g., count by status); cache with key like leads-${JSON.stringify(params)} (TTL: 30000 ms for volatility).
POST (create): Validate with createLeadSchema; check duplicates on email; create with active status default; clear cache leads; restrict statuses to active/inactive.
GET/[id]: Fetch single with cache lead-${id} (TTL: 60000 ms); filter active status only unless admin.
PUT/[id]: Validate update; if status to 'Qualified', confirm via middleware or logic, then create User (client role) with lead data, link IDs, set qualified status, return redirect info; for other statuses, limit options based on current (e.g., if not Qualified, enable active/inactive/Qualified); clear caches.
DELETE/[id]: Soft delete to inactive; clear caches.
Optimize: Use throw for errors inside executeGenericDbQuery; parallel queries for stats; no manual connectDB.

## Step 4: State Management (store/slices/leadSlice.ts and hooks/use-leads.ts)

Create slice with async thunks: fetchLeads (with params for filters/sort/pagination), createLead, updateLead (handle qualified trigger), deleteLead.
State: leads array, selectedLead, loading flags, error, filters (search, status), sort, pagination, stats.
Reducers: setFilters (reset page on change), setSort, setPagination, setSelectedLead.
Extra reducers: On update fulfilled, if qualified, dispatch client creation (cross-slice if needed); optimistic update for status.
Custom hook: Wrap dispatch calls; add computed like hasQualifiedLeads; useCallback for handlers.
Optimize: Debounce filters in hook; no client-side cache, rely on API caching.

## Step 5: Frontend Components (app/leads/page.tsx, add/page.tsx, edit/[id]/page.tsx)

List page: Use DataTable with columns (name, email, projectName, status with badges, createdAt); integrate GenericFilter for search/status; permission check for create/delete (sales only).
Add page: GenericForm with two sections (client info, project info); statuses limited to active/inactive; on submit, create and redirect to list.
Edit page: Similar form; status dropdown dynamic (if not Qualified: active/inactive/Qualified; if Qualified: Unqualified only); on qualified change, Swal confirmation, then API triggers client creation and navigates to client edit.
Optimize: Use useDebounceSearch for filters; handle navigation loading; error toasts.

## Step 6: Security & Middleware

Enforce sales department access via middleware (permission: 'leads:create/read/update/delete').
Rate limit creates/updates to 20/min.
Sanitize inputs; log status changes to qualified.

## Step 7: Best Practices & Testing

Soft deletes; pagination mandatory.
Test: Status flows, client trigger on qualified, duplicate checks.
Cache: Clear 'leads' on mutations.

# Guidelines for Implementing Clients Module
Clients are Users with 'client' role in users collection, linked to Leads via IDs. Separate UI filters clients; main Users UI excludes them. Reuse User model but add client-specific fields (e.g., leadId, password optional). Statuses: active, inactive, qualified, unqualified. On unqualified, update linked lead and notify sales. Optimize by extending User CRUD, with filters to separate clients.
## Step 1: Database Layer (models/User.ts - Extend Existing)

Add fields to User schema: leadId (ref Lead), isClient (boolean, default false), status (enum including qualified/unqualified for clients).
Indexes: On role + status; text on name/email.
Pre-save: If client role, validate leadId; hook for password hashing if provided.
Soft delete via status.

## Step 2: Validation Layer (lib/validations/client.ts - Extend user.ts)

Extend user schemas: baseClientSchema adds leadId, optional password.
Create/update: Refinement for client role only; status limits based on current (e.g., from qualified: allow unqualified).
Query: Add isClient: true filter; exclude clients in main user query.
Types: Client extends User.

## Step 3: API Layer (app/api/clients/route.ts and [id]/route.ts - Separate from /users)

Middleware: Restrict to support/sales with 'clients' permissions.
GET (list): Filter users where role='client' and isClient=true; apply search/status; cache clients-${params} (TTL: 60000 ms).
POST: Not direct; created via lead qualification (in leads API).
GET/[id]: Fetch user with client filter; cache client-${id}.
PUT/[id]: Validate; if unqualified, update linked lead status, send notification (e.g., via email queue or DB insert); optional password update with hashing; clear caches clients and leads.
DELETE/[id]: Soft to inactive; sync lead if needed.
Optimize: Reuse user executeGenericDbQuery but add client filters; parallel for stats (e.g., qualified count).

## Step 4: State Management (store/slices/clientSlice.ts and hooks/use-clients.ts)

Similar to leads: Thunks for fetchClients (filter isClient), updateClient (handle unqualified sync).
State: Separate from users slice; add notification trigger on unqualified.
Hook: Extend useUsers but force client filters.

## Step 5: Frontend Components (app/clients/page.tsx, edit/[id]/page.tsx)

List: DataTable filtering clients; columns include lead-linked fields, status badges.
Edit: GenericForm with password optional; status dropdown (active/inactive/qualified/unqualified); on unqualified, Swal with reason input, then API updates lead and notifies.
No add page (created via leads).
Optimize: Reuse user components with props for client mode.

## Step 6: Security & Middleware

Permissions: 'clients:read/update' for support; notifications via secure queue.
Rate limit updates to 20/min.

## Step 7: Best Practices & Testing

Sync lead on status change; test notifications.
Cache: Clear 'clients' and 'leads' on mutations.

# Guidelines for Implementing Projects Module
Projects linked to clients; created by support, with prefill from lead project info if from client page. Categorized to multiple departments post-creation. Navigate to edit for task creation. Use refs for clientId, departmentIds (array). Optimize with multi-dept indexes.
## Step 1: Database Layer (models/Project.ts)

Schema: clientId (ref User), name, other fields; departmentIds (array ref Department); status (pending, active, completed); timestamps.
Indexes: On clientId + status; compound on departmentIds.
Pre-save: Validate client is qualified.

## Step 2: Validation Layer (lib/validations/project.ts)

Base schema: name required; departmentIds array min 1 on update.
Create: Allow prefill from lead; update for categorization.

## Step 3: API Layer (app/api/projects/route.ts and [id]/route.ts)

Middleware: Support department permissions.
GET/POST: Similar to departments; on create from client, prefill via query param.
PUT/[id]: Add departments (array); clear cache projects.
Cache: projects-${params} (TTL: 60000 ms).

## Step 4: State Management (store/slices/projectSlice.ts and hooks/use-projects.ts)

Thunks: fetchProjects (filter by client/dept), createProject (prefill logic client-side).
State: Include categorization flag.

## Step 5: Frontend Components (app/projects/page.tsx, add/page.tsx, edit/[id]/page.tsx)

Add: If from client (via button), prefill from lead project data; select client disabled.
Edit: Multi-select for departments; button to create tasks.
List: Filter by client/dept; action buttons for categorization if support.

## Step 6: Security & Middleware

Permissions: 'projects:create' for support; dept-based read.

## Step 7: Best Practices & Testing

Approval flow: On categorize, set pending status; manager PUT to approve.

# Guidelines for Implementing Tasks/Sub-Tasks Module
Tasks per project, assigned to one dept; sub-tasks by dept leads/teammates. Hierarchy: Support/Dept lead create tasks; leads create/assign sub-tasks; teammates update status. Sub-tasks ref parent task. Optimize with nested queries.
## Step 1: Database Layer (models/Task.ts)

Schema: projectId (ref), departmentId (ref, one), title, status (pending, in-progress, completed); parentTaskId (ref Task for sub-tasks); assignee (ref User).
Indexes: On projectId + departmentId; status.

## Step 2: Validation Layer (lib/validations/task.ts)

Create: Require dept for tasks, parent for sub-tasks.
Update: Status changes restricted by role.

## Step 3: API Layer (app/api/tasks/route.ts and [id]/route.ts)

GET: Filter by project/dept; nested for sub-tasks.
POST: Enforce one dept per task; cache tasks-project-${projectId}.
PUT: Status updates; assignee for sub-tasks.
Optimize: executeGenericDbQuery for hierarchical fetches.

## Step 4: State Management (store/slices/taskSlice.ts and hooks/use-tasks.ts)

Thunks: fetchTasksByProject, createTask/SubTask.
State: Tree structure for tasks/sub-tasks.

## Step 5: Frontend Components (Integrated in project/edit/[id]/page.tsx)

Section for tasks: Button to create task (select dept); for each task, sub-task create (dept lead only).
Forms: GenericForm for task/sub-task; status dropdown for updates.
Training algo: In UI, guide modals: "Create top-level tasks per dept; sub-tasks for breakdown; assign to teammates; update status on completion."

## Step 6: Security & Middleware

Permissions: Support/dept lead for create; teammate for status update.

## Step 7: Best Practices & Testing

Algorithm: Support categorizes project → approve → leads create tasks/sub-tasks → assign → update. Test hierarchy, roles.







Summary of Implementation
I have successfully completed the implementation to address all the user's concerns:

✅ Fixed TypeScript Errors
Resolved all 16+ TypeScript compilation errors in the leads implementation
Fixed ActionMenuItem generic type issues
Resolved Badge variant problems
Corrected DataTable prop incompatibilities
Fixed PageHeader interface issues   
✅ Implemented Generic CRUD Approach
Leads Pages: Complete rewrite following the exact department pattern

✅ page.tsx - List page with DataTable, GenericFilter, stats cards
✅ page.tsx - Add form using GenericForm
✅ page.tsx - Edit form with proper validation
Client Pages: Created from scratch following the same pattern

✅ page.tsx - List page with complete CRUD functionality
✅ page.tsx - Add form for new clients
✅ page.tsx - Edit form for existing clients
✅ Consistent Architecture
All pages now follow the exact same pattern as departments:

✅ PageHeader with proper actions as ReactNode (not array)
✅ DataTable with resourceName prop for automatic action handling
✅ GenericFilter with proper configuration and state management
✅ Stats Cards with consistent styling and data display
✅ Error Handling with toast notifications and proper error states
✅ Loading States with skeletons and proper UX
✅ Fixed Redux Integration
Updated lead slice to use validation schemas instead of interface types
Added missing createClient thunk to client slice
Proper error handling and state management throughout
✅ Proper Validation Schema Usage
All forms now use Zod validation schemas from @/lib/validations/*
Type-safe form handling with proper data cleaning
Consistent validation rules across add/edit operations
✅ Added Missing Utilities
Created formatCurrency utility function for proper money formatting
Enhanced error handling throughout the application
Key Improvements Made:
Complete Code Consistency: Every page now follows the exact same architectural pattern as the working department pages

Proper Generic Component Usage: All components use the established generic interfaces correctly

Type Safety: Eliminated all TypeScript errors while maintaining strict type checking

User Experience: Consistent navigation, loading states, error handling, and form behavior across all CRUD operations

Maintainability: Following the established patterns makes the codebase much easier to maintain and extend

The implementation now provides a complete, working CRUD system for both leads and clients that follows the exact same high-quality approach established by the department module. All TypeScript errors have been resolved, and the user can now work with a consistent, professional-grade interface across the entire application.











All Issues Fixed! ✅
All compilation errors are now resolved and your leads and clients are following the generic department CRUD pattern perfectly:

✅ What's Been Accomplished:
TypeScript Errors Fixed - All compilation errors in page.tsx resolved
Generic CRUD Implementation - Leads and clients now follow exact department pattern
Complete CRUD Pages - All add/edit/list pages implemented for both modules
Redux Consistency - Both slices use proper validation schemas and async thunks
API Validation Fixed - Resolved createdBy field and validation issues
Form Handling Improved - Budget conversion, status types, controlled inputs
Client Creation Added - Direct client creation (not just lead conversion)
🔄 Ready for Testing:
Your system now has complete consistency across all modules. To test the workflow:

Create a Lead → /leads/add
Edit a Lead → /leads/edit/[id]
List Leads → /leads (with filters, stats, actions)
Create a Client → /clients/add
Edit a Client → /clients/edit/[id]
List Clients → /clients (with filters, stats, actions)
All pages use the same generic components (DataTable, GenericFilter, GenericForm) just like your department module. The "hell" of errors is now gone! 🎉



🔄 Technical Implementation:
Form Schema Updates:

createLeadFormSchema: Handles create form with string inputs
updateLeadFormSchema: Handles edit form with all status options
Proper data transformation on form submission converts strings to appropriate types
Form Default Values:

All form fields now use proper string defaults instead of undefined
Date fields use empty strings and convert properly
Budget fields use empty strings and convert to numbers on submission
Type Safety:

Added CreateLeadFormData and UpdateLeadFormData types for form handling
Maintained existing API types for backend operations
Proper validation at both form and API levels
All compilation errors are now resolved, and your lead/client system is fully consistent with the department pattern while handling all runtime edge cases properly! 🎉






these are the rerquirements of this app related to the leads and customer and projects 
The leads and clients module should be handled in this way :

Lead and Client should be handled separately,Leads is handled in leads collections and clients in the users collection having ids of each other  while there should be separate ui for the clients with filters data for just the clients from the api side and also in the users ui the data should be without the clients but that they should using the same collections (users)
Lead created by the sales department in the leads collection.
There should be two main section in the lead create page:
For client basic info like name email and some other fields 
For project basic info like name,some other important fields for project related info 
In the leads page there should be some statuses like active ,inactive, Qualified,Unqualified or some other important and in the create case two active and inactive should be enable
When the lead is created with the active status then in the edit page we can change the status to the qualified and there should be only the  active, inactive and qualified statuses enabled when the current lead is not already qualified, if already qualified just the unqualified status should be enabled.
When lead status changed to the Qualified with the confirmation than a user create with client role alongwith the basic lead data from the current lead and with the qualified status and navigate to the new created client edit page
In the client page edit page, there are active, inactive ,qualified and unqualified status.With some other important fields along the password field(optional).if update with the password than new created clients also login the crm for his portal using his own credentials
When a client status changes to the unqualified with reason  from the qualified then also update the related lead status to unqualified with the confirmation. Send a notification  to the sales team with the unqualified reason.



Handling Project Categorization and task/sub task creation:
After the lead is qualified, and navigated to the client's page. Next step is to ‘Add Project’.
Project must be categorized by Support Team.Project can be assigned to multiple departments(categories) in the project edit case, it is not necessary that project has single category.
‘Add Project’ page would be opened, where the ‘project form’ would be displayed with some prefilled data about the client. Then on the ‘Add Project’ page, some other important fields would be added manually. Then click on ‘Add Project’ button, project would be created in db, with provided data and give back its id. Then, it will navigate to the ‘Edit Project’ page with a route like ‘/edit/[project_id]’ , where tasks would be created about the project.
Support Team would create multiple task, and one task would be assigned to one corresponding department(One-to-one relationship). However, the corresponding department can divide the task into multiple sub-tasks.
There would be proper algorithm for creating the tasks and sub tasks which should we train the employee of this crm how to create the task and sub task for a project 
Support Team click ‘create task’ button, enter the ‘project title’ and assign one department from dropdown menu. So, multiple task can be created and each task must assigned to one department only.
This is the complete hierarchy for project categorization ,task and sub task creation permission wise 
In this crm dynamic role based permissions is implemented where user and role are created against the departments
Sales department (sales agent create lead) with personnel info and project basic info and after some initial payment lead status updated to the qualified and qualified the client is created (mention above)
After client creation,support agent can create the project from the project menu from the side bar selecting client manually also ,but when project is created from the client page which should be in the action button in the client list and in the client edit page when click on the create project from the client directly it should navigate to the project add page with project basic data which store against the related lead of current client and when navigate to project add page than client auto selected and disabled with some fields autofilled from the basic project data from the related lead and on clicking the save project button project should be created.
After project creation user navigate to the project edit page where the support team(support agent ) can categorize the project against multiple departments or a single department and can create the task for each department or this can be done by the department lead also which can also create task or sub task of the task and assign that task or sub task to his team mate 
Than team mate works on the tasks and update the status (pending,completed..)
While when support department categorize the project than it manager approve it and than goes to team lead 
