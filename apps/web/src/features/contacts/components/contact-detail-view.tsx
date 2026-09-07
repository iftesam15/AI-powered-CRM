"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Contact as ContactIcon,
  Mail,
  Pencil,
  Phone,
  User,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { PermissionGate } from "@/components/shared/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { contactDetailQueryOptions } from "@/features/contacts/api/queries";
import { EditContactDialog } from "@/features/contacts/components/edit-contact-dialog";
import type { CrmContact } from "@/features/contacts/types";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

interface ContactDetailViewProps {
  id: string;
}

export function ContactDetailView({ id }: ContactDetailViewProps) {
  const { data: contact, isLoading, isError } = useQuery(
    contactDetailQueryOptions(id)
  );

  const [editing, setEditing] = useState<CrmContact | null>(null);

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

  if (isError || !contact) {
    return (
      <div className="pt-6 text-center">
        <EmptyState
          icon={ContactIcon}
          title="Contact not found"
          description="The contact you requested does not exist or you do not have permission to view it."
          action={
            <Button asChild variant="outline">
              <Link href="/contacts">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Contacts
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button asChild variant="ghost" size="sm" className="h-8 px-2">
              <Link href="/contacts">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Contacts
              </Link>
            </Button>
            <span className="text-muted-foreground">/</span>
            <Badge variant="secondary">Contact</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {contact.first_name} {contact.last_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {contact.title || "No job title specified"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.contactsWrite}>
            <Button variant="outline" onClick={() => setEditing(contact)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Contact
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Primary Account
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {contact.account_id ? (
              <div>
                <Link
                  href={`/accounts/${contact.account_id}`}
                  className="text-lg font-bold hover:underline text-primary"
                >
                  {contact.account_name || "Account"}
                </Link>
                <p className="text-xs text-muted-foreground mt-1">
                  Linked company account
                </p>
              </div>
            ) : (
              <div>
                <div className="text-lg font-bold text-muted-foreground">None</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Individual contact
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Contact Channels
            </CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-sm font-medium">
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className="text-primary hover:underline flex items-center">
                  <Mail className="h-3 w-3 mr-1.5" />
                  {contact.email}
                </a>
              ) : (
                <span className="text-muted-foreground font-normal">No email recorded</span>
              )}
            </div>
            <div className="text-sm">
              {contact.phone ? (
                <span className="flex items-center text-muted-foreground">
                  <Phone className="h-3 w-3 mr-1.5" />
                  {contact.phone}
                </span>
              ) : (
                <span className="text-muted-foreground text-xs font-normal">No phone recorded</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Metadata
            </CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <div>
              <span className="font-semibold text-foreground">Created: </span>
              {formatDate(contact.created_at)}
            </div>
            <div>
              <span className="font-semibold text-foreground">Last Updated: </span>
              {formatDate(contact.updated_at)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs section */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activities">
            Activities & Tasks
            <Badge variant="outline" className="ml-2 text-[10px]">
              Sprint 5
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs font-medium text-muted-foreground block">Full Name</span>
                  <span className="text-foreground font-medium">{contact.first_name} {contact.last_name}</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground block">Job Title</span>
                  <span>{contact.title || "—"}</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground block">Email</span>
                  <span>{contact.email || "—"}</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground block">Phone</span>
                  <span>{contact.phone || "—"}</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground block">Account</span>
                  {contact.account_id ? (
                    <Link href={`/accounts/${contact.account_id}`} className="text-primary hover:underline font-medium">
                      {contact.account_name || "Account"}
                    </Link>
                  ) : (
                    <span>Individual</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities" className="pt-4">
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={Waypoints}
                title="Activity timeline coming in Sprint 5"
                description="Call logs, emails, meetings and scheduled tasks associated with this contact will appear here in Sprint 5."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <EditContactDialog
        contact={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </div>
  );
}
