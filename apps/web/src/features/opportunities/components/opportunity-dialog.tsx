"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { accountsQueryOptions } from "@/features/accounts/api/queries";
import { contactsQueryOptions } from "@/features/contacts/api/queries";
import { defaultPipelineQueryOptions } from "@/features/pipelines/api/queries";
import { useCreateOpportunity, useUpdateOpportunity } from "@/features/opportunities/api/queries";
import type { CrmOpportunity } from "@/features/opportunities/types";

const opportunitySchema = z.object({
  name: z.string().min(1, "Opportunity name is required").max(255),
  amount: z.string().refine((val) => !val || !isNaN(Number(val)), "Must be a valid number"),
  currency: z.string().length(3, "Currency must be 3 letters"),
  stage_id: z.string().min(1, "Stage is required"),
  account_id: z.string().optional(),
  primary_contact_id: z.string().optional(),
  expected_close_date: z.string().optional(),
  probability: z.string().refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100), "0-100%"),
  notes: z.string().max(2000).optional(),
});

type OpportunityFormValues = z.infer<typeof opportunitySchema>;

interface OpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity?: CrmOpportunity | null;
  defaultStageId?: string;
}

export function OpportunityDialog({
  open,
  onOpenChange,
  opportunity,
  defaultStageId,
}: OpportunityDialogProps) {
  const isEditing = Boolean(opportunity);
  const createMutation = useCreateOpportunity();
  const updateMutation = useUpdateOpportunity(opportunity?.id || "");

  const { data: pipeline } = useQuery(defaultPipelineQueryOptions());
  const { data: accountsData } = useQuery(accountsQueryOptions({ limit: 100 }));
  const { data: contactsData } = useQuery(contactsQueryOptions({ limit: 100 }));

  const stages = pipeline?.stages || [];
  const accounts = accountsData?.items || [];
  const contacts = contactsData?.items || [];

  const defaultStage = stages.find((s) => !s.is_won && !s.is_lost) || stages[0];

  const form = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: {
      name: "",
      amount: "0.00",
      currency: "USD",
      stage_id: defaultStageId || defaultStage?.id || "",
      account_id: "",
      primary_contact_id: "",
      expected_close_date: "",
      probability: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (opportunity) {
        form.reset({
          name: opportunity.name,
          amount: opportunity.amount || "0.00",
          currency: opportunity.currency || "USD",
          stage_id: opportunity.stage_id,
          account_id: opportunity.account_id || "",
          primary_contact_id: opportunity.primary_contact_id || "",
          expected_close_date: opportunity.expected_close_date || "",
          probability: opportunity.probability !== undefined ? String(opportunity.probability) : "",
          notes: opportunity.notes || "",
        });
      } else {
        const initStage = defaultStageId || defaultStage?.id || (stages[0]?.id ?? "");
        const stageObj = stages.find((s) => s.id === initStage);
        form.reset({
          name: "",
          amount: "",
          currency: "USD",
          stage_id: initStage,
          account_id: "",
          primary_contact_id: "",
          expected_close_date: "",
          probability: stageObj ? String(stageObj.probability) : "",
          notes: "",
        });
      }
    }
  }, [open, opportunity, defaultStageId, stages, form, defaultStage]);

  // When stage changes, auto-fill default probability if not explicitly set
  const handleStageSelect = (stgId: string) => {
    form.setValue("stage_id", stgId);
    const target = stages.find((s) => s.id === stgId);
    if (target && !isEditing) {
      form.setValue("probability", String(target.probability));
    }
  };

  const onSubmit = async (values: OpportunityFormValues) => {
    const payload = {
      name: values.name.trim(),
      amount: values.amount ? parseFloat(values.amount) : 0,
      currency: values.currency.toUpperCase(),
      pipeline_id: pipeline?.id,
      stage_id: values.stage_id,
      account_id: values.account_id ? values.account_id : null,
      primary_contact_id: values.primary_contact_id ? values.primary_contact_id : null,
      expected_close_date: values.expected_close_date || null,
      probability: values.probability ? parseInt(values.probability, 10) : undefined,
      notes: values.notes?.trim() || null,
    };

    if (isEditing && opportunity) {
      await updateMutation.mutateAsync(payload);
    } else {
      await createMutation.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            {isEditing ? "Edit Opportunity" : "Create New Opportunity"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update details, monetary value, or stage for this deal."
              : "Add a prospective deal to your sales pipeline to track revenue and close dates."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opportunity Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Acme Fleet Route Expansion" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Value ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" placeholder="50000.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stage_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pipeline Stage *</FormLabel>
                    <Select value={field.value} onValueChange={handleStageSelect}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stages.map((stg) => (
                          <SelectItem key={stg.id} value={stg.id}>
                            {stg.name} ({stg.probability}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Associated Account</FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an Account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None (Individual / Unassigned)</SelectItem>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="primary_contact_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Contact</FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Contact" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {contacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.first_name} {c.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="expected_close_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Close Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="probability"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Win Probability (%)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="100" placeholder="e.g. 60" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal Notes / Context</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes on scope, contract terms, or next steps..."
                      className="resize-none h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Deal"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
