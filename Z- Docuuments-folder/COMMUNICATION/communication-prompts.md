# pahse #01

and now again  use the 
Z- Docuuments-folder\COMMUNICATION\COMMUNICATION_MODULE_IMPLEMENTATION_COMPLETE-VERSION_5.md,Z- Docuuments-folder\COMMUNICATION\COMMUNICATION_MODULE_IMPROVEMENTS_ROADMAP.md and 
Z- Docuuments-folder\COMPLETE-CRUD-IMPLEMENTATION-FINAL-VERSIONE.md to understand the current flow of this project and communication module 

now the channel are created on different categories like (dm,project based ...) , so  the different channel created on these types  

type ChannelType = 'group' | 'department' | 'department-category' | 'multi-category' | 'project' | 'client-support'

and when channel create than all the involved users are added as channel_members in that channel like when department created than all users added in that channel as a channel_members and same in the project case on which project task's assingee and project creator added but now the problem is that when channel created than only those users can added which was exist on that time but if some users created after the department channel creation and he should be there in that channel for communication and same as in the project based channel and other types other than the direct and client-support(one to one with support agent and client ) so i want to handle this one in this way 
1) when we are going to create this type of group channel(not direct channel) than there should be check input and if checked than  new created/assinee added automatically when they are created/assingee 
2) on the created group channel admin(handle the roles in the channel properly , by default creator is admin of that channel and he can also assign the admin role to other channel_members also ) can  add the new user from the users(no matter that one is assignee,belongs to that department or not and on that selecting time exclude the already used channel_members )

3) and there should be setting for the channel for admin only in which only admin users can send messages and add new memebers and other members can see those messages just like the whastapp 


4) and implementation should be generic and optimized as in future i will add the create project channel button in the project overview (/projects/[id] routes) and same for department and other , so that we can create the channel from the (/communication route or some different route easily )
there should be proper channel setting in which user can update the profile pick using s3 and along with the  importants things 

5) and in the project task module there should be proper button to create the proect based channel and if exist than button to navigate to that project channel's message lists and in the project overview there should be all attachments shown which are assosiate in that project channel 

6) there should be proper implementation of the voice message within this communication module  according to best practices 

so create the new planning file for implementation of this one while make sure every things should be optimized and according to best practices of the next js and supabase and according to current flow and easily imeplemented and plan should be according to divide and conqure method


# phase 02 

1) there should be proper channel setting for archive and pin from the channel setting 

2) there should be proper filters and search for chats when click on flask button 

2) there should be proper message realtime notification(realtime notifincation should be show in the main header of main page D:\digi-era-pro\components\layout\header.tsx ) and notification setting also implemented well according to best practices 

3) there should be proper increase and increse width within min and max width for components\communication\communication-sidebar.tsx on expanding/deexpanding horizontally in the large screen only not in the mobile screen (there should be 100% width for communication sidebar in mobile screen and on chat click messages list show and vice versa )according to best practices 



# phase 03

and now use the 
Z- Docuuments-folder\COMMUNICATION\COMMUNICATION_MODULE_IMPLEMENTATION_COMPLETE-VERSION_5.md and 
Z- Docuuments-folder\COMPLETE-CRUD-IMPLEMENTATION-FINAL-VERSIONE.md to understand the current flow of this project and communication module  and use these to understand these and their related files  project task flow 

import { ProjectAnalytics } from "@/components/projects/ProjectAnalytics";
import { ProjectCategorization } from "@/components/projects/ProjectCategorization";
import { ProjectEditTab } from "@/components/projects/ProjectEditTab";
import { useNavigation } from "@/components/providers/navigation-provider";
import { Project } from "@/types";
import HtmlTextRenderer from "@/components/shared/html-text-renderer";
import { PRIORITY_COLORS, STATUS_COLORS } from "@/lib/colorConstants";
1) i want the another realtime and generic flow for realtime actions perform in which when the project created than go the notification for the department head (IT manager )(or user with given user id ) and this can be used to send the notification on project approval, on project task assigment to assignee with the supabase using the complete flow of current project implementation and supabse implementation using the supabase 

2) this generic realtime can used to create the task with realtime experience and in the backend the api call for task creation/updation/assignement using the same api calls with mongodb with same current implementation but experience should be realtime and this can be used in the task drag and drop on the tasks board view 


so create the new planning file for implementation of this one while make sure every things should be optimized and according to best practices of the next js and supabase and according to current flow and easily imeplemented and plan should be according to divide and conqure method

# phase 04 




and now use the 
Z- Docuuments-folder\COMMUNICATION\COMMUNICATION_MODULE_IMPLEMENTATION_COMPLETE-VERSION_5.md and 
Z- Docuuments-folder\COMPLETE-CRUD-IMPLEMENTATION-FINAL-VERSIONE.md to understand the current flow of this project and communication module  and use these to understand these and their related files  project task flow 

import { ProjectAnalytics } from "@/components/projects/ProjectAnalytics";
import { ProjectCategorization } from "@/components/projects/ProjectCategorization";
import { ProjectEditTab } from "@/components/projects/ProjectEditTab";
import { useNavigation } from "@/components/providers/navigation-provider";
import { Project } from "@/types";
import HtmlTextRenderer from "@/components/shared/html-text-renderer";
import { PRIORITY_COLORS, STATUS_COLORS } from "@/lib/colorConstants";
1) i want the another realtime and generic flow for realtime actions perform in which when the project created than go the notification for the department head (IT manager )(or user with given user id ) and this can be used to send the notification on project approval, on project task assigment to assignee with the supabase using the complete flow of current project implementation and supabse implementation using the supabase 

2) this generic realtime can used to create the task with realtime experience and in the backend the api call for task creation/updation/assignement using the same api calls with mongodb with same current implementation but experience should be realtime and this can be used in the task drag and drop on the tasks board view 


so create the new planning file for implementation of this one while make sure every things should be optimized and according to best practices of the next js and supabase and according to current flow and easily imeplemented and plan should be according to divide and conqure method