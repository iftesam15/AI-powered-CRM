"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormAlert } from "@/components/shared/form-alert";
import { SubmitButton } from "@/components/shared/submit-button";
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
  FormDescription,
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
import { useCreateUser } from "@/features/users/api/mutations";
import { createUserSchema, type CreateUserValues } from "@/features/users/schemas";
import type { RoleOption } from "@/features/users/types";
import { ApiError } from "@/lib/api-client";

const EMPTY: CreateUserValues = {
  email: "",
  fullName: "",
  role: "sales_rep",
  password: "",
};

/**
 * The initial password is set here rather than emailed as an invitation link.
 * Invitations need a mail path that is only reliable once SMTP is configured
 * per deployment; handing over a first password is the flow this sprint can
 * actually finish, and the person changes it through the existing reset form.
 */
export function CreateUserDialog({ roles }: { roles: RoleOption[] }) {
  const [open, setOpen] = useState(false);
  const createUser = useCreateUser();

  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: EMPTY,
    mode: "onSubmit",
  });

  const conflict = createUser.error instanceof ApiError && createUser.error.status === 409;

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      form.reset(EMPTY);
      createUser.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4" aria-hidden />
          Add user
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a user</DialogTitle>
          <DialogDescription>
            They join {""}
            <span className="font-medium text-foreground">this organisation</span> and can
            sign in immediately with the password you set here.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            noValidate
            id="create-user-form"
            onSubmit={form.handleSubmit((values) =>
              createUser.mutate(values, { onSuccess: () => onOpenChange(false) }),
            )}
            className="space-y-4"
          >
            {createUser.error ? (
              <FormAlert
                tone="error"
                title={conflict ? "That email is already in use" : "Could not add the user"}
              >
                {createUser.error.message}
              </FormAlert>
            ) : null}

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem className="gap-2">
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="gap-2">
                  <FormLabel>Work email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" autoComplete="off" spellCheck={false} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem className="gap-2">
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Decides what they can see and change. It can be changed later.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="gap-2">
                  <FormLabel>Initial password</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" autoComplete="new-password" />
                  </FormControl>
                  <FormDescription>
                    Share it with them directly. They can change it from the sign-in page.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton
            form="create-user-form"
            pending={createUser.isPending}
            pendingLabel="Adding"
          >
            Add user
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
