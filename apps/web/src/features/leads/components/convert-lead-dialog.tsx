"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Building2, UserCheck, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { accountsQueryOptions } from "@/features/accounts/api/queries";
import { useConvertLead } from "@/features/leads/api/queries";
import type { CrmLead } from "@/features/leads/types";
import { routes } from "@/config/routes";

interface ConvertLeadDialogProps {
  lead: CrmLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConvertLeadDialog({ lead, open, onOpenChange }: ConvertLeadDialogProps) {
  const router = useRouter();
  const convertMutation = useConvertLead();

  const [accountOption, setAccountOption] = useState<"create" | "existing" | "none">("create");
  const [customAccountName, setCustomAccountName] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const [createOpportunity, setCreateOpportunity] = useState(true);
  const [oppName, setOppName] = useState("");
  const [oppAmount, setOppAmount] = useState("");

  const accountsQuery = useQuery(accountsQueryOptions({ limit: 100 }));
  const existingAccounts = accountsQuery.data?.items ?? [];

  if (!lead) return null;

  const defaultAccountName = customAccountName || lead.company_name || `${lead.first_name} ${lead.last_name} Account`;

  const handleConvert = () => {
    let create_account = false;
    let account_id: string | null = null;
    let account_name: string | null = null;

    if (accountOption === "create") {
      create_account = true;
      account_name = defaultAccountName;
    } else if (accountOption === "existing") {
      account_id = selectedAccountId || null;
    }

    const opportunity_name = createOpportunity
      ? oppName.trim() || `${lead.company_name || `${lead.first_name} ${lead.last_name}`} Deal`
      : null;
    const opportunity_amount = createOpportunity && oppAmount ? Number(oppAmount) : null;

    convertMutation.mutate(
      {
        id: lead.id,
        payload: {
          create_account,
          account_id,
          account_name,
          opportunity_name,
          opportunity_amount,
        },
      },
      {
        onSuccess: (res) => {
          onOpenChange(false);
          if (res.opportunity_id) {
            router.push(routes.opportunity(res.opportunity_id));
          } else if (res.contact_id) {
            router.push(routes.contact(res.contact_id));
          }
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Convert Qualified Lead
          </DialogTitle>
          <DialogDescription>
            Convert <strong className="text-foreground">{lead.first_name} {lead.last_name}</strong> into a Contact and link to an Account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Action Overview Box */}
          <Alert className="border-primary/25 bg-primary/5 text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <AlertTitle className="text-sm font-semibold text-primary">Transactional Domain Conversion</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              This action creates a new Contact record, optionally links or creates an Account, updates lead status to <strong className="text-foreground font-semibold">Converted</strong>, and locks the lead history in a single atomic transaction.
            </AlertDescription>
          </Alert>

          {/* Contact Summary */}
          <div className="rounded-lg border border-border/60 p-3 bg-muted/30">
            <div className="flex items-center gap-2 font-medium text-sm text-foreground">
              <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Contact Record to Create:
            </div>
            <div className="mt-1 text-xs text-muted-foreground pl-6">
              <strong className="text-foreground">{lead.first_name} {lead.last_name}</strong> ({lead.email || "No email"} · {lead.title || "No title"})
            </div>
          </div>

          {/* Account Options */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary" />
              Account Handling
            </Label>

            <div className="space-y-2">
              {/* Option 1: Create New Account */}
              <div
                className={`group cursor-pointer rounded-lg border p-3 transition-all ${
                  accountOption === "create"
                    ? "border-primary bg-primary/5 text-foreground shadow-xs"
                    : "border-border/60 hover:border-primary/50 hover:bg-muted/40"
                }`}
                onClick={() => setAccountOption("create")}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="accountOption"
                    checked={accountOption === "create"}
                    onChange={() => setAccountOption("create")}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium transition-colors group-hover:text-primary">
                    Create a new Account
                  </span>
                </div>
                {accountOption === "create" && (
                  <div className="mt-3 pl-6">
                    <Label className="text-xs text-muted-foreground">Account Name</Label>
                    <Input
                      className="mt-1 h-8 text-xs"
                      value={customAccountName}
                      onChange={(e) => setCustomAccountName(e.target.value)}
                      placeholder={lead.company_name || `${lead.first_name} ${lead.last_name} Account`}
                    />
                  </div>
                )}
              </div>

              {/* Option 2: Link Existing Account */}
              <div
                className={`group cursor-pointer rounded-lg border p-3 transition-all ${
                  accountOption === "existing"
                    ? "border-primary bg-primary/5 text-foreground shadow-xs"
                    : "border-border/60 hover:border-primary/50 hover:bg-muted/40"
                }`}
                onClick={() => setAccountOption("existing")}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="accountOption"
                    checked={accountOption === "existing"}
                    onChange={() => setAccountOption("existing")}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium transition-colors group-hover:text-primary">
                    Link to an existing Account
                  </span>
                </div>
                {accountOption === "existing" && (
                  <div className="mt-3 pl-6">
                    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Choose an existing account..." />
                      </SelectTrigger>
                      <SelectContent>
                        {existingAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Option 3: Contact only */}
              <div
                className={`group cursor-pointer rounded-lg border p-3 transition-all ${
                  accountOption === "none"
                    ? "border-primary bg-primary/5 text-foreground shadow-xs"
                    : "border-border/60 hover:border-primary/50 hover:bg-muted/40"
                }`}
                onClick={() => setAccountOption("none")}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="accountOption"
                    checked={accountOption === "none"}
                    onChange={() => setAccountOption("none")}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium transition-colors group-hover:text-primary">
                    Do not create or link an Account (Contact only)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Opportunity Creation Option */}
          <div className="space-y-3 pt-1 border-t border-border/40">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createOpportunity}
                  onChange={(e) => setCreateOpportunity(e.target.checked)}
                  className="rounded border-border accent-primary"
                />
                Create a Sales Opportunity
              </Label>
              <span className="text-[11px] text-muted-foreground">Enters initial pipeline stage</span>
            </div>

            {createOpportunity && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Deal Name *</Label>
                  <Input
                    className="mt-1 h-8 text-xs bg-background"
                    value={oppName}
                    onChange={(e) => setOppName(e.target.value)}
                    placeholder={`${lead.company_name || `${lead.first_name} ${lead.last_name}`} Deal`}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Expected Value ($ USD)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    className="mt-1 h-8 text-xs bg-background"
                    value={oppAmount}
                    onChange={(e) => setOppAmount(e.target.value)}
                    placeholder="e.g. 25000"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConvert}
            disabled={convertMutation.isPending || (accountOption === "existing" && !selectedAccountId)}
          >
            {convertMutation.isPending ? "Converting..." : "Convert Lead"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
