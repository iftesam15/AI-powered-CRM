"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarPlus,
  ClipboardPlus,
  Contact,
  ExternalLink,
  Globe,
  Pencil,
  TrendingUp,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { LogActivityModal } from "@/components/activities/LogActivityModal";
import { EmptyState } from "@/components/shared/empty-state";
import { PermissionGate } from "@/components/shared/permission-gate";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { ActivityTimeline } from "@/components/timeline/ActivityTimeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accountDetailQueryOptions } from "@/features/accounts/api/queries";
import { EditAccountDialog } from "@/features/accounts/components/edit-account-dialog";
import type { CrmAccount } from "@/features/accounts/types";
import { fetchTimeline } from "@/features/activities/api";
import type { TimelineItem } from "@/features/activities/types";
import { accountContactsQueryOptions } from "@/features/contacts/api/queries";
import { CreateContactDialog } from "@/features/contacts/components/create-contact-dialog";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

interface AccountDetailViewProps {
  id: string;
}

export function AccountDetailView({ id }: AccountDetailViewProps) {
  const { data: account, isLoading, isError } = useQuery(
    accountDetailQueryOptions(id)
  );

  const { data: contacts } = useQuery(
    accountContactsQueryOptions(id)
  );

  const [editing, setEditing] = useState<CrmAccount | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [isLogActivityOpen, setIsLogActivityOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);

  async function loadTimeline() {
    if (!id) return;
    setTimelineLoading(true);
    try {
      const items = await fetchTimeline("account", id);
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
      <div className="space-y-6 pt-2">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !account) {
    return (
      <div className="pt-6 text-center">
        <EmptyState
          icon={Building2}
          title="Account not found"
          description="The account you requested does not exist or you do not have permission to view it."
          action={
            <Button asChild variant="outline">
              <Link href="/accounts">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Accounts
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link href="/accounts">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{account.name}</h1>
              {account.industry ? (
                <Badge variant="secondary">{account.industry}</Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Created {formatDate(account.created_at)}
            </p>
          </div>
        </div>

        <PermissionGate permission={PERMISSIONS.accountsWrite}>
          <Button onClick={() => setEditing(account)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Account
          </Button>
        </PermissionGate>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Industry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold">
              {account.industry || "Not specified"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Company Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold">
              {account.size || "Not specified"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Website
            </CardTitle>
          </CardHeader>
          <CardContent>
            {account.website ? (
              <a
                href={account.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                <Globe className="mr-1.5 h-4 w-4" />
                {account.website.replace(/^https?:\/\//, "")}
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">None</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold truncate" title={account.address || undefined}>
              {account.address || "Not specified"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="activities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activities" className="gap-1.5">
            <Waypoints className="h-4 w-4" />
            Activity Timeline
          </TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1.5">
            <Contact className="h-4 w-4" />
            Contacts
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="gap-1.5">
            <TrendingUp className="h-4 w-4" />
            Opportunities (Sprint 7)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activities">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Chronological Interaction Timeline</CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => setIsLogActivityOpen(true)}>
                  <CalendarPlus className="mr-1.5 h-4 w-4" />
                  Log Activity
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsCreateTaskOpen(true)}>
                  <ClipboardPlus className="mr-1.5 h-4 w-4" />
                  Create Task
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ActivityTimeline items={timeline} loading={timelineLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <span className="font-semibold text-muted-foreground">
                    Full Name:
                  </span>{" "}
                  {account.name}
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">
                    Industry:
                  </span>{" "}
                  {account.industry || "—"}
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">
                    Size:
                  </span>{" "}
                  {account.size || "—"}
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">
                    Website:
                  </span>{" "}
                  {account.website || "—"}
                </div>
                <div className="sm:col-span-2">
                  <span className="font-semibold text-muted-foreground">
                    Address:
                  </span>{" "}
                  {account.address || "—"}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Linked Contacts</CardTitle>
              <CreateContactDialog defaultAccountId={account.id} />
            </CardHeader>
            <CardContent>
              {!contacts || contacts.length === 0 ? (
                <EmptyState
                  icon={Contact}
                  title="No linked contacts yet"
                  description="No contacts are linked to this account yet. Click 'Add Contact' to add one."
                />
              ) : (
                <div className="divide-y rounded-md border">
                  {contacts.map((c) => (
                    <div key={c.id} className="group flex items-center justify-between p-3 text-sm hover:bg-muted/50 transition-colors">
                      <div>
                        <Link href={`/contacts/${c.id}`} className="font-medium hover:underline text-foreground group-hover:text-primary transition-colors">
                          {c.first_name} {c.last_name}
                        </Link>
                        {c.title && <span className="text-xs text-muted-foreground ml-2">({c.title})</span>}
                        {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                      </div>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/contacts/${c.id}`}>View</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opportunities">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deals & Opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={TrendingUp}
                title="No opportunities yet"
                description="Sales opportunities for this account will appear here in Sprint 7."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EditAccountDialog
        account={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />

      <LogActivityModal
        isOpen={isLogActivityOpen}
        onClose={() => setIsLogActivityOpen(false)}
        onSuccess={() => loadTimeline()}
        entityType="account"
        entityId={account.id}
        entityName={account.name}
        accountId={account.id}
      />

      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        onSuccess={() => loadTimeline()}
        entityType="account"
        entityId={account.id}
        entityName={account.name}
        accountId={account.id}
      />
    </div>
  );
}
