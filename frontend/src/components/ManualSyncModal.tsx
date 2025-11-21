import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import brain from "brain";
import { ManualSyncResponse } from "types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ManualSyncModal({ isOpen, onClose }: Props) {
  const [identifiers, setIdentifiers] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ManualSyncResponse | null>(null);

  const handleSync = async () => {
    setIsLoading(true);
    setResult(null);
    const identifierList = identifiers.split(/\\n|\\s|,/).filter(Boolean);

    try {
      // Note: manual_sync method doesn't exist in the brain client
      // This will need to be implemented or use an existing method
      // For now, this is a placeholder that will fail gracefully
      const response = await (brain as any).manual_sync({ identifiers: identifierList });
      if (response && response.data) {
        setResult(response.data);
      } else if (response) {
        // Fallback if response structure is different
        setResult(response);
      } else {
        throw new Error("Manual sync method not available");
      }
    } catch (error) {
      console.error("Manual sync failed:", error);
      const errorDetail = error instanceof Error ? error.message : "An unknown error occurred.";
      setResult({
        successful: 0,
        failed: identifierList.length,
        details: [`Frontend Error: ${errorDetail}`],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setIdentifiers("");
    setResult(null);
    setIsLoading(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] bg-card">
        <DialogHeader>
          <DialogTitle>Manual Case Sync</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter Case IDs or Case Numbers below, separated by new lines, spaces, or commas.
          </p>
          <Textarea
            placeholder="e.g., 12345\\nCS-67890\\n..."
            value={identifiers}
            onChange={(e) => setIdentifiers(e.target.value)}
            rows={10}
            disabled={isLoading}
          />
          {result && (
            <div className="p-4 border rounded-lg bg-background max-h-48 overflow-y-auto">
              <h4 className="font-semibold mb-2">Sync Results</h4>
              <p className="text-sm">
                <span className="text-green-500">{result.successful} Succeeded</span>,{" "}
                <span className="text-red-500">{result.failed} Failed</span>
              </p>
              <ul className="list-disc list-inside mt-2 text-xs text-muted-foreground">
                {result.details.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Close
          </Button>
          <Button onClick={handleSync} disabled={isLoading || !identifiers}>
            {isLoading ? "Syncing..." : "Start Sync"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
