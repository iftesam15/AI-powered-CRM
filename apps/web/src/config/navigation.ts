import {
  Building2,
  ClipboardList,
  Contact,
  FileBarChart,
  KanbanSquare,
  LayoutDashboard,
  ScrollText,
  Settings2,
  ShieldCheck,
  Target,
  TrendingUp,
  Upload,
  UsersRound,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import { routes } from "@/config/routes";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

/**
 * `sprint` records which sprint of CRM_SPRINT_PLAN.md delivers the item.
 * Anything above the current sprint renders as a disabled shell entry so the
 * information architecture is visible without pretending the feature is done.
 */
export const CURRENT_SPRINT = 6;

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  sprint: number;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: routes.dashboard,
        icon: LayoutDashboard,
        sprint: 1,
      },
    ],
  },
  {
    label: "Records",
    items: [
      {
        title: "Accounts",
        href: routes.accounts,
        icon: Building2,
        permission: PERMISSIONS.accountsRead,
        sprint: 3,
      },
      {
        title: "Contacts",
        href: routes.contacts,
        icon: Contact,
        permission: PERMISSIONS.contactsRead,
        sprint: 4,
      },
      {
        title: "Leads",
        href: routes.leads,
        icon: Target,
        permission: PERMISSIONS.leadsRead,
        sprint: 6,
      },
      {
        title: "Opportunities",
        href: routes.opportunities,
        icon: TrendingUp,
        permission: PERMISSIONS.opportunitiesRead,
        sprint: 7,
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        title: "Pipeline",
        href: routes.pipeline,
        icon: KanbanSquare,
        permission: PERMISSIONS.pipelineRead,
        sprint: 7,
      },
      {
        title: "Activities",
        href: routes.activities,
        icon: Waypoints,
        permission: PERMISSIONS.activitiesRead,
        sprint: 5,
      },
      {
        title: "Tasks",
        href: routes.tasks,
        icon: ClipboardList,
        permission: PERMISSIONS.tasksRead,
        sprint: 5,
      },
    ],
  },
  {
    label: "Insight",
    items: [
      {
        title: "Reports",
        href: routes.reports,
        icon: FileBarChart,
        permission: PERMISSIONS.reportsRead,
        sprint: 9,
      },
      {
        title: "Imports",
        href: routes.imports,
        icon: Upload,
        permission: PERMISSIONS.importsWrite,
        sprint: 8,
      },
    ],
  },
];

export const settingsNavigation: NavItem[] = [
  {
    title: "Users",
    href: routes.settingsUsers,
    icon: UsersRound,
    permission: PERMISSIONS.usersRead,
    sprint: 2,
  },
  {
    title: "Organisation",
    href: routes.settingsTenant,
    icon: Settings2,
    permission: PERMISSIONS.tenantRead,
    sprint: 2,
  },
  {
    title: "Pipeline stages",
    href: routes.settingsPipeline,
    icon: ScrollText,
    permission: PERMISSIONS.pipelineConfigure,
    sprint: 7,
  },
  {
    title: "Audit log",
    href: routes.settingsAudit,
    icon: ShieldCheck,
    permission: PERMISSIONS.auditRead,
    sprint: 2,
  },
];
