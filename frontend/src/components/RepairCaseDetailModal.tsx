import React, { useEffect, useState } from "react";
import brain from "brain";
import { RepairCaseDB } from "types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  // DialogClose, // Removed as DialogContent provides its own
} from "@/components/ui/dialog";
// import { X } from "lucide-react"; // X icon is usually part of DialogContent's default close button

interface Props {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  caseId: string | null;
}

const RepairCaseDetailModal: React.FC<Props> = ({ isOpen, onOpenChange, caseId }) => {
  const [repairCase, setRepairCase] = useState<RepairCaseDB | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && caseId) {
      setLoading(true);
      setError(null);
      setRepairCase(null); // Reset previous case data
      brain.get_repair_case_details({ caseId })
        .then((response) => {
          if (response.ok) {
            const data = response.data;
            setRepairCase(data);
          } else {
            const errorText = response.error || `Status: ${response.status}`;
            console.error("Failed to fetch repair case details for modal:", response.status, errorText);
            setError(`Fall nicht gefunden oder Fehler beim Laden (Status: ${response.status}).`);
          }
        })
        .catch((err) => {
          console.error("Error fetching repair case details for modal:", err);
          setError("Ein unerwarteter Fehler ist aufgetreten beim Laden der Falldetails.");
        })
        .finally(() => {
          setLoading(false);
        });
    } else if (!isOpen) {
      // Optional: Clear data when modal is closed to ensure fresh load next time or save state
      // setRepairCase(null); 
      // setError(null);
    }
  }, [isOpen, caseId]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogOverlay className="bg-background/50 backdrop-blur-sm" />
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden shadow-2xl border-slate-300 bg-white/95 dark:bg-slate-900/95">
        <DialogHeader className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-3xl font-bold text-slate-800 dark:text-slate-100">Falldetails</DialogTitle>
            {/* Default close button from DialogContent will appear here or top-right of content area */}
          </div>
          {caseId && !loading && repairCase && <p className="text-sm text-slate-600 dark:text-slate-400 pt-1">Details für Fall-ID: {caseId}</p>}
        </DialogHeader>
        <div className="p-6 max-h-[calc(100vh-12rem)] overflow-y-auto"> {/* Scrollable content area */}
          {loading && <p className="text-center text-slate-600 dark:text-slate-300 py-10">Lade Falldetails...</p>}
          {error && <p className="text-center text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 p-4 rounded-md border border-red-300 dark:border-red-700 mx-6 my-4">{error}</p>}
          {!loading && !error && repairCase && (
            <div className="space-y-6">
              {/* Versicherungsinformationen */}
              <Card className="bg-white/80 dark:bg-slate-800/50 shadow-lg border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-slate-700 dark:text-slate-200">Versicherungsinformationen</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-x-6 gap-y-4 text-sm text-slate-600 dark:text-slate-300">
                  <div><strong>Versicherungsname:</strong> {repairCase.insuranceName || "N/A"}</div>
                  <div><strong>Vertragsnummer:</strong> {repairCase.insuranceContractNumber || "N/A"}</div>
                  <div><strong>Versicherung aktiv:</strong> {repairCase.insuranceIsActive ? "Ja" : "Nein"}</div>
                  <div><strong>Selbstbeteiligung:</strong> {typeof repairCase.insuranceDeductible === 'number' ? `${repairCase.insuranceDeductible.toFixed(2)} ${repairCase.currency || ""}`.trim() : "N/A"}</div>
                </CardContent>
              </Card>

              {/* Kunden- und Fallinformationen */}
              <Card className="bg-white/80 dark:bg-slate-800/50 shadow-lg border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-slate-700 dark:text-slate-200">Kunden- &amp; Fallinformationen</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-x-6 gap-y-4 text-sm text-slate-600 dark:text-slate-300">
                  <div><strong>Fallnummer:</strong> {repairCase.caseNumber || "N/A"}</div>
                  <div><strong>Kundennummer:</strong> {repairCase.customerNumber || "N/A"}</div>
                  <div><strong>Kundenname:</strong> {repairCase.customerName || "N/A"}</div>
                  <div><strong>Firma:</strong> {repairCase.customerCompanyName || "N/A"}</div>
                  <div><strong>E-Mail:</strong> {repairCase.customerEmail || "N/A"}</div>
                  <div><strong>Telefon:</strong> {repairCase.customerPhoneMain || "N/A"}</div>
                  <div><strong>Stadt:</strong> {repairCase.customerCity || "N/A"}</div>
                  <div><strong>PLZ:</strong> {repairCase.customerZipCode || "N/A"}</div>
                </CardContent>
              </Card>

              {/* Produktinformationen */}
              <Card className="bg-white/80 dark:bg-slate-800/50 shadow-lg border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-slate-700 dark:text-slate-200">Produktinformationen</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-x-6 gap-y-4 text-sm text-slate-600 dark:text-slate-300">
                  <div><strong>Produktname:</strong> {repairCase.productName || "N/A"}</div>
                  <div><strong>Hersteller:</strong> {repairCase.manufacturer || "N/A"}</div>
                  <div><strong>Seriennummer:</strong> {repairCase.productSerialNumber || "N/A"}</div>
                  <div className="md:col-span-2"><strong>Symptome/Fehlerbeschreibung:</strong> <pre className="whitespace-pre-wrap font-sans text-sm bg-slate-50 dark:bg-slate-700/30 p-2 rounded">{repairCase.symptoms || "N/A"}</pre></div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 dark:bg-slate-800/50 shadow-lg border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-slate-700 dark:text-slate-200">Fallstatus &amp; Service</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-x-6 gap-y-4 text-sm text-slate-600 dark:text-slate-300">
                  <div><strong>Status:</strong> {repairCase.status || "N/A"}</div>
                  <div><strong>Servicetyp:</strong> {repairCase.serviceType || "N/A"}</div>
                  <div><strong>Garantie:</strong> {repairCase.warranty || "N/A"}</div>
                  <div><strong>Geschäftstelle:</strong> {repairCase.storeName || "N/A"}</div>
                  <div><strong>Reparaturkosten gesamt:</strong> {typeof repairCase.totalRepairCost === 'number' ? `${repairCase.totalRepairCost.toFixed(2)} ${repairCase.currency || ""}`.trim() : "N/A"}</div>
                </CardContent>
              </Card>

              {/* Zeitstempel und Rohdaten */}
              <Card className="bg-white/80 dark:bg-slate-800/50 shadow-lg border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-slate-700 dark:text-slate-200">Zeitstempel</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                  <div><strong>Erfasst am:</strong> {repairCase.fetchedAt ? new Date(repairCase.fetchedAt).toLocaleString("de-DE") : "N/A"}</div>
                  <div><strong>Letzte API Aktualisierung:</strong> {repairCase.lastApiUpdate ? new Date(repairCase.lastApiUpdate).toLocaleString("de-DE") : "N/A"}</div>
                </CardContent>
              </Card>
            </div>
          )}
          {!loading && !error && !repairCase && caseId && ( // Show if no case but ID was provided (e.g. after error then clear)
             <p className="text-center text-slate-500 dark:text-slate-400 py-10">Keine Falldetails zum Anzeigen für ID: {caseId}.</p>
          )}
           {!loading && !caseId && ( // Show if no ID was ever provided
             <p className="text-center text-slate-500 dark:text-slate-400 py-10">Keine Fall-ID ausgewählt.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RepairCaseDetailModal;
