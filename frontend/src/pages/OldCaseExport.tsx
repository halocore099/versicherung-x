import React, { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import brain from "brain";

const OldCaseExport = () => {
  const [caseNumbers, setCaseNumbers] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    if (!caseNumbers.trim()) {
      toast.error("Bitte geben Sie mindestens eine Servicefall-Nr. ein.");
      return;
    }
    setIsLoading(true);
    toast.info("Der Export wird vorbereitet und startet in Kürze...");

    try {
      const caseNumbersList = caseNumbers
        .split(/\\n|,|;/)
        .map((num) => num.trim())
        .filter((num) => num);

      // requestStream returns an async iterable, so we need to collect the chunks
      const stream = brain.export_specific_old_cases_from_reparline_excel(
        { case_numbers: caseNumbersList }
      );

      const chunks: Uint8Array[] = [];
      try {
        for await (const chunk of stream) {
          if (chunk instanceof Uint8Array) {
            chunks.push(chunk);
          }
        }

        // Combine all chunks into a single blob
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        const blob = new Blob([combined], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "reparline_export.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        toast.success("Export erfolgreich abgeschlossen!");
      } catch (streamError: any) {
        console.error("Export failed:", streamError);
        const errorMessage = streamError?.message || streamError?.detail || "Unbekannter Fehler";
        toast.error(`Export fehlgeschlagen: ${errorMessage}`);
      }
    } catch (error) {
      console.error("An error occurred during export:", error);
      toast.error("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Export älterer Servicefälle</h1>
        <p className="text-muted-foreground mt-2">
          Geben Sie eine Liste von Servicefall-Nummern ein (getrennt durch Komma, Semikolon oder Zeilenumbruch), um die dazugehörigen Daten als Excel-Datei zu exportieren.
        </p>
      </header>
      
      <div className="flex flex-col gap-4">
        <Textarea
          placeholder="z.B. 12345, 12346, 12347..."
          className="min-h-[200px] text-base"
          value={caseNumbers}
          onChange={(e) => setCaseNumbers(e.target.value)}
          disabled={isLoading}
        />
        <Button onClick={handleExport} disabled={isLoading}>
          {isLoading ? "Export wird erstellt..." : "Als Excel exportieren"}
        </Button>
      </div>
    </div>
  );
};

export default OldCaseExport;
