import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Honest placeholder for areas scheduled in a later build phase.
 * Not a fake feature — it states plainly that the section isn't built yet.
 */
export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Construction className="size-6" />
        </div>
        <div>
          <h2 className="font-medium">{title}</h2>
          <p className="text-sm text-muted-foreground">
            This section is scheduled for {phase}. The data model and navigation are in place;
            the screens are not built yet.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
