"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarPlus,
  CheckCircle2,
  ClipboardPlus,
  Edit,
  ExternalLink,
  Lock,
  Mail,
  Phone,
  Sparkles,
  Target,
  User,
  Waypoints,
} from "lucide-react";
import Link from "next/link";

import { LogActivityModal } from "@/components/activities/LogActivityModal";
import { EmptyState } from "@/components/shared/empty-state";
import { PermissionGate } from "@/components/shared/permission-gate";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { ActivityTimeline } from "@/components/timeline/ActivityTimeline";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchTimeline } from "@/features/activities/api";
import type { TimelineItem } from "@/features/activities/types";
import { leadDetailQueryOptions } from "@/features/leads/api/queries";
import { ConvertLeadDialog } from "@/features/leads/components/convert-lead-dialog";
import { EditLeadDialog } from "@/features/leads/components/edit-lead-dialog";
import { LeadStatusBadge } from "@/features/leads/components/LeadStatusBadge";
import type { CrmLead } from "@/features/leads/types";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { routes } from "@/config/routes";

interface LeadDetailViewProps {
  id: string;
}

export function LeadDetailView({ id }: LeadDetailViewProps) {
  const { data: lead, isLoading, isError } = useQuery(leadDetailQueryOptions(id));

  const [editing, setEditing] = useState<CrmLead | null>(null);
  const [converting, setConverting] = useState<CrmLead | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [isLogActivityOpen, setIsLogActivityOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);

  async function loadTimeline() {
    if (!id) return;
    setTimelineLoading(true);
    try {
      const items = await fetchTimeline("lead", id);
      setTimeline(items);
    } catch (err) {
      console.error(err);
    } finally {
      setTimelineLoading(false);
    }
  }

  useEffect(() => {
    loadTimeline();
  }, [id]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !lead) {
    return (
      <EmptyState
        title="Lead not found"
        description="The requested lead does not exist or you do not have permission to view it."
        action={
          <Button asChild variant="outline">
            <Link href={routes.leads}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Leads
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button & Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon">
            <Link href={routes.leads}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {lead.first_name} {lead.last_name}
              </h1>
              <LeadStatusBadge status={lead.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
              <span>Created {formatDate(lead.created_at)}</span>
              {lead.source && <span>· Source: <span className="capitalize font-medium">{lead.source}</span></span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!lead.is_converted ? (
            <PermissionGate permission={PERMISSIONS.leadsWrite}>
              <Button
                variant="outline"
                onClick={() => setEditing(lead)}
              >
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Button>
              <Button
                onClick={() => setConverting(lead)}
              >
                <Sparkles className="mr-2 h-4 w-4" /> Convert Lead
              </Button>
            </PermissionGate>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-md border border-border">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Converted Record (Locked)</span>
            </div>
          )}
        </div>
      </div>

      {/* Converted Record Banner */}
      {lead.is_converted && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle className="text-emerald-800 dark:text-emerald-300 font-semibold">Lead Converted Successfully</AlertTitle>
          <AlertDescription className="text-xs text-emerald-900/90 dark:text-emerald-200/90 mt-1 flex flex-wrap items-center gap-4">
            <span>Converted on {lead.converted_at ? formatDate(lead.converted_at) : "N/A"}.</span>
            {lead.converted_contact_id && (
              <Link
                href={routes.contact(lead.converted_contact_id)}
                className="inline-flex items-center text-emerald-700 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-100 underline font-medium"
              >
                View Contact Record ({lead.converted_contact_name || "Contact"}) <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            )}
            {lead.converted_account_id && (
              <Link
                href={routes.account(lead.converted_account_id)}
                className="inline-flex items-center text-emerald-700 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-100 underline font-medium"
              >
                View Account Record ({lead.converted_account_name || "Account"}) <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Grid Layout: Lead Info Card + Activity Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Lead Overview */}
        <Card className="md:col-span-1 border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Lead Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <span className="text-xs text-muted-foreground font-medium block">Company / Organisation</span>
              <span className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {lead.company_name || "—"}
              </span>
            </div>

            <div>
              <span className="text-xs text-muted-foreground font-medium block">Title</span>
              <span className="text-foreground">{lead.title || "—"}</span>
            </div>

            <div>
              <span className="text-xs text-muted-foreground font-medium block">Email</span>
              <span className="text-foreground flex items-center gap-1.5 mt-0.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {lead.email ? (
                  <a href={`mailto:${lead.email}`} className="hover:underline text-primary">
                    {lead.email}
                  </a>
                ) : (
                  "—"
                )}
              </span>
            </div>

            <div>
              <span className="text-xs text-muted-foreground font-medium block">Phone</span>
              <span className="text-foreground flex items-center gap-1.5 mt-0.5">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {lead.phone || "—"}
              </span>
            </div>

            <div>
              <span className="text-xs text-muted-foreground font-medium block">Lead Source</span>
              <span className="text-foreground capitalize">{lead.source || "—"}</span>
            </div>

            {lead.notes && (
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Notes & Context</span>
                <p className="mt-1 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded border border-border/50">
                  {lead.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Timeline & Activity History */}
        <div className="md:col-span-2 space-y-4">
          <Tabs defaultValue="timeline" className="w-full">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="timeline" className="flex items-center gap-1.5">
                  <Waypoints className="h-3.5 w-3.5" /> Timeline
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <PermissionGate permission={PERMISSIONS.activitiesWrite}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsLogActivityOpen(true)}
                  >
                    <CalendarPlus className="mr-1.5 h-3.5 w-3.5" /> Log Activity
                  </Button>
                </PermissionGate>
                <PermissionGate permission={PERMISSIONS.tasksWrite}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsCreateTaskOpen(true)}
                  >
                    <ClipboardPlus className="mr-1.5 h-3.5 w-3.5" /> Create Task
                  </Button>
                </PermissionGate>
              </div>
            </div>

            <TabsContent value="timeline" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  {timelineLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : (
                    <ActivityTimeline items={timeline} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Modals */}
      <EditLeadDialog
        lead={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      <ConvertLeadDialog
        lead={converting}
        open={Boolean(converting)}
        onOpenChange={(open) => !open && setConverting(null)}
      />

      <LogActivityModal
        isOpen={isLogActivityOpen}
        onClose={() => setIsLogActivityOpen(false)}
        onSuccess={loadTimeline}
        entityType="lead"
        entityId={id}
      />

      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        onSuccess={loadTimeline}
        entityType="lead"
        entityId={id}
      />
    </div>
  );
}
