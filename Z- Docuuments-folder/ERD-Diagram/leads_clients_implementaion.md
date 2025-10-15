### Final Comprehensive CRM Development Guide: Leads, Clients, Projects, Tasks, and Subtasks
This document consolidates our discussions into a finalized, end-to-end guide for implementing the Leads, Clients, Projects, Tasks (including subtasks), status propagation, and progress tracking in the DepLLC CRM. It builds on your existing architecture (ERD, CRUD patterns from Department module, ROLES/DEPARTMENTS/USERS integration, real-time chat, and security middleware). The approach is modular, step-by-step, and uses best practices in Next.js (e.g., SSR for data pages, caching with executeGenericDbQuery, Zod for validation, Redux Toolkit for state, reusable components like DataTable and GenericForm).
## Key Focus Areas:
Unified Leads & Clients Module: Handles leads as a status in CLIENTS, with automatic USER creation and "Client" role assignment on status update to 'client' (inline in API PUT for simplicity).
Projects Module: Tied to clients, with categorization and approval.
Tasks & Subtasks Module: Hierarchical (subtasks via parent_task_id), with an ideal algorithm for creation, assignment, status updates (propagation), and progress tracking (percentage-based aggregation).
Algorithm for Tasks/Subtasks:
Creation: Manager creates top-level tasks for a project (e.g., via milestones JSON). Team Lead breaks into subtasks with dependencies. Use a UI wizard for ease.
Status Update & Propagation: When a subtask status changes (e.g., to 'completed'), check all siblings → if all done, update parent task status → if all tasks done, update project status. Trigger via API PUT, with real-time notifications.
Progress Tracking: Calculate as completion_percentage = (completed subtasks / total subtasks) * 100 for tasks; aggregate to project level. Use MongoDB aggregation for efficiency; update on status changes. Clients view read-only in portal.
Best Practices: Inline automation (no separate triggers), atomic operations, RBAC enforcement, soft deletes, indexes for performance, caching (TTL 1-5 min), notifications via chat, audits in AUDIT_LOGS.
Implementation Order: Complete one module fully before the next. Each includes layers: Database, Validation, API, State, Frontend, Security/Integration.

Module 1: Unified Leads & Clients
Leads are 'lead' status in CLIENTS. On update to 'client', inline create USER with "Client" role (predefined by superadmin).
Step 1.1: Preparation
Superadmin creates a "Clients" department (DEPARTMENTS CRUD: name 'Clients', code 'CLI').
Superadmin creates "Client" role (ROLES CRUD: name 'Client', permissions JSON for read-own, hierarchy_level 1).
Step 1.2: Database Layer
File: models/Client.ts.
Schema: ERD fields + user_id FK to USERS, status enum ['lead', 'qualified', 'client', 'inactive'].
Indexes: { status: 1, created_at: -1 }, text on company_name/email.
Pre-save: Validate email uniqueness.
Step 1.3: Validation Layer
File: lib/validations/client.ts.
Schemas: createSchema (lead subset), updateSchema (full; refine for 'client' requirements).
Step 1.4: API Layer
Files: app/api/clients/route.ts (GET/POST), app/api/clients/[id]/route.ts (GET/PUT/DELETE).
GET: Filter by status, pagination, search.
POST: Create 'lead'.
PUT: Updates; if status to 'client' and no user_id:
Inline: Fetch "Client" role/dept, create USER (bcrypt temp password), link user_id, notify via chat.
Atomic via executeGenericDbQuery.
DELETE: Set 'inactive'.
Step 1.5: State Management
File: store/slices/clientSlice.ts.
Thunks: fetchClients, createClient, updateClient (triggers inline assignment).
Step 1.6: Frontend Components
Pages: app/clients/page.tsx (list with status filter), app/clients/add/page.tsx, app/clients/edit/[id]/page.tsx ("Qualify" button for leads).
Portal: app/client-portal/page.tsx (read-own).
Step 1.7: Security & Integration
RBAC: Sales creates leads, Manager qualifies.
Audit: Log qualification.
Test: Lead creation → Qualify → USER auto-created.

Module 2: Projects
Tied to clients (client_id FK). Categorize (e.g., 'web', 'seo').
Step 2.1: Database Layer
File: models/Project.ts.
Schema: ERD fields, status enum ['draft', 'approved', 'in_progress', 'completed'], category enum ['web', 'seo', 'graphics', etc.], completion_percentage (virtual via tasks agg).
Indexes: { client_id: 1, status: 1 }.
Step 2.2: Validation Layer
File: lib/validations/project.ts.
Schemas: createProjectSchema (require client_id, category).
Step 2.3: API Layer
Files: app/api/projects/route.ts (GET/POST), app/api/projects/[id]/route.ts (GET/PUT/DELETE).
GET: Aggregate progress (MongoDB $lookup tasks).
POST: Create from client, assign manager/dept.
PUT: Approve (status 'approved').
Step 2.4: State Management
File: store/slices/projectSlice.ts.
Thunks: fetchProjects, createProject, approveProject.
Step 2.5: Frontend Components
Pages: app/projects/page.tsx (list with progress bars), app/projects/add/page.tsx (category dropdown), app/projects/edit/[id]/page.tsx.
Portal: Read-only progress view.
Step 2.6: Security & Integration
RBAC: Manager approves.
Notify on approval.
Test: Create from client, approve.

Module 3: Tasks & Subtasks
Hierarchical: Subtasks via parent_task_id. Algorithm ensures easy creation/tracking.
Algorithm for Creation, Status, & Progress
Creation Flow (Ideal & Easy):
Project Manager: Create top-level tasks (e.g., form with milestones array: title, description, estimated_hours).
Team Lead: For each task, add subtasks (parent_task_id = task.id, dependencies JSON for sequencing, e.g., [{ task_id: 'dep1', type: 'blocks' }]).
Assignment: Inline in creation/update (assigned_to FK to USERS).
UI: Wizard form – Step 1: Add task, Step 2: Break into subtasks (repeater fields).
Status Update & Propagation (Automated & Tracked):
Member updates subtask status (e.g., PUT to 'in_progress'/'completed').
Inline Check: If subtask 'completed', query siblings (TASKS where parent_task_id = same).
If all siblings 'completed', update parent task to 'completed'.
Then query all top-level tasks for project; if all 'completed', update project status to 'completed'.
Real-time: Notify assignees/manager/client via chat on changes.
Progress Tracking (Easy Calculation):
For Task: completion_percentage = (completed subtasks count / total subtasks) * 100; or (actual_hours / estimated_hours) if time-based.
For Project: Aggregate avg(task.completion_percentage).
Update: Recalculate on status PUT; store in task/project docs.
Client View: Read-only tree with percentages (portal).
Efficiency: Use MongoDB aggregation ($group, $lookup) in API.
Step 3.1: Database Layer
File: models/Task.ts.
Schema: ERD fields, parent_task_id FK (self-ref for subtasks), status enum ['todo', 'in_progress', 'review', 'completed'], completion_percentage (calculated).
Indexes: { project_id: 1, parent_task_id: 1, status: 1 }.
Step 3.2: Validation Layer
File: lib/validations/task.ts.
Schemas: createTaskSchema (allow parent_task_id for subtasks).
Step 3.3: API Layer
Files: app/api/tasks/route.ts (GET/POST), app/api/tasks/[id]/route.ts (GET/PUT/DELETE).
POST: Create task/subtask.
PUT: Update status; inline propagation algorithm (query/update parent/project).
GET: Hierarchical fetch ($lookup for subtasks), include progress agg.
Step 3.4: State Management
File: store/slices/taskSlice.ts.
Thunks: fetchTasks (tree), createTask, updateTaskStatus (triggers propagation).
Step 3.5: Frontend Components
Pages: app/tasks/page.tsx (hierarchical DataTable/tree view), app/tasks/add/page.tsx (wizard for subtasks), app/tasks/edit/[id]/page.tsx.
Portal: Task tree with progress.
Step 3.6: Security & Integration
RBAC: Lead creates/assigns, Member updates.
Notify on updates.
Test: Create task/subtask → Update subtask → Propagation to task/project, progress updates.

Final Integration & Testing
Cross-Module Flow: Lead → Client (qualify) → Project → Tasks/Subtasks → Status updates → Progress in portal.
Optimization: Caching, indexes; monitor MongoDB.
Full Test: End-to-end pipeline, edge cases (e.g., partial completion).
This guide ensures an ideal, scalable CRM using your project's approaches. Implement sequentially for best results.




# The leads and clients module should be handled in this way :
1. lead and client should be handled in a separate module with the single collections 
    1. in which lead should be created by the sale manager/agent with lead initial info and there should be project section with basic info related to the project 
    2. D uring  qualification of lead(this should be done by status change by sales agent from lead status to client) client role(which should be created by admin having some permissions related to ) should be assigned to the client  