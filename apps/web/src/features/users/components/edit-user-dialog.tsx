"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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
import { Separator } from "@/components/ui/separator";
import { useUpdateUser } from "@/features/users/api/mutations";
import { editUserSchema, type EditUserValues } from "@/features/users/schemas";
import type { CrmUser, RoleOption } from "@/features/users/types";
import { ApiError } from "@/lib/api-client";

/**
 * Editing and activation share one dialog but not one submit. Changing a name
 * or role is a form the person fills in and saves; switching an account off is
 * a single consequential act that should not be something you can do by
 * accident while typing a surname. So it lives below a rule, with its own
 * button and its own pending state.
 */
export function EditUserDialog({
  user,
  roles,
  currentUserId,
  open,
  onOpenChange,
}: {
  user: CrmUser | null;
  roles: RoleOption[];
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateUser = useUpdateUser();

  const form = useForm<EditUserValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { fullName: "", role: "sales_rep" },
    mode: "onSubmit",
  });

  // The dialog is mounted once and re-pointed at whichever row was clicked, so
  // the fields have to be re-seeded rather than set from initial props.
  useEffect(() => {
    if (user) {
      form.reset({ fullName: user.fullName, role: user.role });
      updateUser.reset();
    }
    // `form` and `updateUser` are stable for the life of the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) return null;

  const isSelf = user.id === currentUserId;
  const conflict = updateUser.error instanceof ApiError && updateUser.error.status === 409;

  function setActive(isActive: boolean) {
    if (!user) return;
    updateUser.mutate(
      { id: user.id, isActive },
      {
        onSuccess: (updated) => {
          toast.success(
            updated.isActive
              ? `${updated.fullName} can sign in again.`
              : `${updated.fullName} can no longer sign in.`,
          );
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {user.fullName}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        {updateUser.error ? (
          <FormAlert tone="error" title={conflict ? "Not allowed" : "Could not save"}>
            {updateUser.error.message}
          </FormAlert>
        ) : null}

        <Form {...form}>
          <form
            noValidate
            id="edit-user-form"
            onSubmit={form.handleSubmit((values) =>
              updateUser.mutate(
                { id: user.id, fullName: values.fullName, role: values.role },
                {
                  onSuccess: () => {
                    toast.success("Changes saved.");
                    onOpenChange(false);
                  },
                },
              ),
            )}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem className="gap-2">
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" />
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
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {user.isActive ? "Account is active" : "Account is deactivated"}
            </p>
            <p className="max-w-[38ch] text-xs leading-relaxed text-muted-foreground">
              {isSelf
                ? "You cannot deactivate the account you are signed in with."
                : user.isActive
                  ? "Deactivating blocks sign-in immediately. Records they own are kept."
                  : "Reactivating restores sign-in and clears any lockout."}
            </p>
          </div>
          <Button
            variant={user.isActive ? "outline" : "default"}
            size="sm"
            disabled={isSelf || updateUser.isPending}
            onClick={() => setActive(!user.isActive)}
          >
            {user.isActive ? "Deactivate" : "Reactivate"}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton
            form="edit-user-form"
            pending={updateUser.isPending}
            pendingLabel="Saving"
          >
            Save changes
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
