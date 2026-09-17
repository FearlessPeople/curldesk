import { ChevronRight, Folder, Plus } from 'lucide-react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/collapsible'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarRail,
} from '@/components/sidebar'

const folders = [
  { name: 'examples', files: ['chat.curl', 'health.curl'] },
  { name: 'payments', files: ['create-order.curl'] },
]

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" className="!absolute !inset-y-0 !h-full">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem><SidebarMenuButton><Folder /><span>workspace</span></SidebarMenuButton></SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Requests</SidebarGroupLabel>
          <SidebarMenu>
            {folders.map((folder, index) => (
              <Collapsible key={folder.name} defaultOpen={index === 0} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <ChevronRight className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      <span>{folder.name}</span><Plus className="ml-auto" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {folder.files.map((file) => (
                        <SidebarMenuSubItem key={file}>
                          <SidebarMenuSubButton asChild>
                            <button type="button"><span>{file.replace('.curl', '')}</span></button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem><SidebarMenuButton><Folder /><span>ENV</span><span className="ml-auto text-xs text-muted-foreground">Dev</span></SidebarMenuButton></SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
