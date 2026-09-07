"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PermissionGate } from "@/components/shared/permission-gate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { accountsQueryOptions } from "@/features/accounts/api/queries";
import { checkDuplicateContact, useCreateContact } from "@/features/contacts/api/queries";
import type { CrmContact } from "@/features/contacts/types";
import { useDebounce } from "@/hooks/use-debounce";
import { PERMISSIONS } from "@/lib/permissions";

const createContactSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  title: z.string().optional(),
  account_id: z.string().optional(),
});

type FormValues = z.infer<typeof createContactSchema>;

interface CreateContactDialogProps {
  defaultAccountId?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateContactDialog({
  defaultAccountId,
  trigger,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: CreateContactDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = externalOnOpenChange ?? setInternalOpen;

  const [duplicateWarning, setDuplicateWarning] = useState<CrmContact[] | null>(null);

  const createMutation = useCreateContact();
  const { data: accountsData } = useQuery(
    accountsQueryOptions({ limit: 100 })
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(createContactSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      title: "",
      account_id: defaultAccountId || "",
    },
  });

  const emailValue = form.watch("email");
  const debouncedEmail = useDebounce(emailValue || "", 400);

  useEffect(() => {
    if (defaultAccountId) {
      form.setValue("account_id", defaultAccountId);
    }
  }, [defaultAccountId, form]);

  useEffect(() => {
    if (!debouncedEmail || !debouncedEmail.includes("@")) {
      setDuplicateWarning(null);
      return;
    }

    let isMounted = true;
    checkDuplicateContact(debouncedEmail)
      .then((res) => {
        if (isMounted) {
          if (res.is_duplicate) {
            setDuplicateWarning(res.matching_contacts);
          } else {
            setDuplicateWarning(null);
          }
        }
      })
      .catch(() => {
        if (isMounted) setDuplicateWarning(null);
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedEmail]);

  async function onSubmit(values: FormValues) {
    createMutation.mutate(
      {
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email || null,
        phone: values.phone || null,
        title: values.title || null,
        account_id: values.account_id === "none" ? null : values.account_id || null,
      },
      {
        onSuccess: () => {
          form.reset();
          setDuplicateWarning(null);
          setOpen(false);
        },
      }
    );
  }

  return (
    <PermissionGate permission={PERMISSIONS.contactsWrite}>
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger ? (
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        ) : (
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Contact</DialogTitle>
            <DialogDescription>
              Add a new person record and link them to an account.
            </DialogDescription>
          </DialogHeader>

          {duplicateWarning && duplicateWarning.length > 0 && (
            <Alert variant="default" className="my-2 border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle>Possible Duplicate Email</AlertTitle>
              <AlertDescription className="text-xs">
                A contact with email &quot;{debouncedEmail}&quot; already exists (
                {duplicateWarning[0].first_name} {duplicateWarning[0].last_name}
                {duplicateWarning[0].account_name ? ` at ${duplicateWarning[0].account_name}` : ""}).
                You can still proceed if this is intentional.
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="jane.doe@example.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 (555) 019-2834" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title</FormLabel>
                      <FormControl>
                        <Input placeholder="VP of Logistics" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Account</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None (Individual)</SelectItem>
                        {accountsData?.items.map((acc) => (
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

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Contact"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </PermissionGate>
  );
}
