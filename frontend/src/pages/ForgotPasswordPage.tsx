import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { firebaseAuth } from "app"; // Correct import as per guidelines
import { sendPasswordResetEmail } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"; // For layout
import { Mail, AlertTriangle, ArrowLeft } from "lucide-react"; // Icons

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setMessage({ type: "error", text: "Bitte geben Sie Ihre E-Mail-Adresse ein." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      if (!firebaseAuth) {
        setMessage({ type: "error", text: "Firebase ist nicht konfiguriert. Bitte kontaktieren Sie den Administrator." });
        return;
      }
      await sendPasswordResetEmail(firebaseAuth, email);
      setMessage({
        type: "success",
        text: "E-Mail zum Zurücksetzen des Passworts wurde gesendet. Bitte überprüfen Sie Ihren Posteingang (auch den Spam-Ordner).",
      });
      setEmail(""); // Clear email field on success
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      let errorMessage = "Fehler beim Senden der Passwort-Reset-E-Mail.";
      if (error.code === "auth/user-not-found") {
        errorMessage = "Kein Benutzer mit dieser E-Mail-Adresse gefunden.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Ungültiges E-Mail-Format.";
      }
      // Firebase often provides user-friendly messages, but sometimes they are in English or too technical.
      // It's safer to map common error codes to German messages.
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 dark:from-slate-900 dark:to-sky-900 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <img src="https://static.databutton.com/public/12488b2a-5495-49b3-9146-07e8a9e033b2/986bbf76-fbe1-44f3-b882-8143c72575ea.png" alt="Justcom Logo" className="w-32 mx-auto mb-4" />
          <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-justcom-green to-justcom-blue">
            Passwort zurücksetzen
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400">
            Geben Sie Ihre E-Mail-Adresse ein, um Anweisungen zum Zurücksetzen Ihres Passworts zu erhalten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendResetEmail} className="space-y-6">
            {message && (
              <Alert variant={message.type === "error" ? "destructive" : "default"} className={message.type === "success" ? "bg-green-100 dark:bg-green-900 border-green-500 dark:border-green-700 text-green-700 dark:text-green-300" : ""}>
                {message.type === "error" ? 
                  <AlertTriangle className="h-4 w-4" /> 
                  : 
                  <Mail className="h-4 w-4" /> /* Using Mail icon for success */ 
                }
                <AlertTitle>{message.type === "success" ? "E-Mail gesendet" : "Fehler"}</AlertTitle>
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                E-Mail-Adresse
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ihre.email@beispiel.de"
                  required
                  disabled={loading}
                  className="pl-10 w-full border-justcom-blue/50 text-slate-800 dark:text-slate-200 focus:ring-justcom-blue/70 focus:border-justcom-blue placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-justcom-green hover:bg-justcom-green/90 text-white font-semibold py-3">
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Senden...
                </>
              ) : "Passwort-Reset-E-Mail senden"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="mt-6 text-center flex justify-center">
          <Button variant="link" onClick={() => navigate("/Login")} className="text-sm text-justcom-blue hover:text-justcom-blue/80">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zum Login
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
