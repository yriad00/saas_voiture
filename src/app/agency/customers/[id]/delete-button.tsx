"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { deleteCustomer } from "../actions";
import { Button } from "@/components/ui/button";

export function DeleteCustomerButton({ customerId }: { customerId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    if (!window.confirm("Supprimer ce client ?")) return;
    startTransition(async () => {
      const res = await deleteCustomer(customerId);
      if (res?.error) {
        window.alert(res.error);
        return;
      }
      router.push("/agency/customers");
    });
  };

  return (
    <Button variant="destructive" size="sm" disabled={pending} onClick={handleDelete}>
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      Supprimer
    </Button>
  );
}
