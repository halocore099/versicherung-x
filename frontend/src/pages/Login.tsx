import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { firebaseAuth, useCurrentUser } from "app"; // Import firebaseAuth
import { signInWithEmailAndPassword } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useCurrentUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (!userLoading && user) {
      navigate("/Dashboard");
    }
  }, [user, userLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!firebaseAuth) {
        setError("Firebase ist nicht konfiguriert. Bitte kontaktieren Sie den Administrator.");
        return;
      }
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      // The useCurrentUser hook and useEffect above will handle the redirect to /Dashboard
      // No explicit navigate("/Dashboard") needed here if user state triggers redirect reliably.
    } catch (err: any) {
      console.error("Login failed:", err);
      if (err.code) {
        switch (err.code) {
          case "auth/user-not-found":
            setError("Ungültige E-Mail-Adresse oder falsches Passwort.");
            break;
          case "auth/wrong-password":
          case "auth/invalid-credential": // General incorrect credential error
            setError(
              "Ungültige E-Mail-Adresse oder falsches Passwort. " +
              "Wenn Sie ein importiertes Konto verwenden, müssen Sie möglicherweise Ihr Passwort zurücksetzen."
            );
            break;
          case "auth/invalid-email":
            setError("Ungültige E-Mail-Adresse.");
            break;
          case "auth/user-disabled":
            setError("Dieses Benutzerkonto wurde deaktiviert.");
            break;
          default:
            setError("Anmeldung fehlgeschlagen. Bitte versuchen Sie es später erneut.");
        }
      } else {
        setError("Ein unbekannter Fehler ist aufgetreten.");
      }
    } finally {
      setLoading(false);
    }
  };

  // If still loading initial user state, show a simple loading message
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 p-4">
        <p className="text-white text-xl">Laden...</p>
      </div>
    );
  }

  // If user is not logged in, show the login form
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-sky-100 via-green-50 to-blue-50 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 shadow-xl rounded-lg p-8">
        <div className="text-center mb-8">
          <img src="https://static.databutton.com/public/12488b2a-5495-49b3-9146-07e8a9e033b2/logo_justcom_claim_v21-300x76.png" alt="Justcom Logo" className="mx-auto mb-4 h-16 w-auto" />
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Anmelden
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Zugang zum Justcom Dashboard.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <Label htmlFor="email">E-Mail-Adresse</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@beispiel.com"
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
              className="mt-1"
            />
          </div>

          <div className="text-right text-sm">
            <Button 
              type="button" // Important: type="button" to prevent form submission
              variant="link"
              onClick={() => navigate("/ForgotPasswordPage")}
              className="text-justcom-blue hover:text-justcom-blue/80 p-0 h-auto font-normal"
            >
              Passwort vergessen?
            </Button>
          </div>

          <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800">
            <p className="font-medium mb-1">Hinweis für importierte Konten:</p>
            <p>Wenn Sie ein importiertes Konto verwenden, müssen Sie möglicherweise Ihr Passwort zurücksetzen, um sich anzumelden.</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Anmeldefehler</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full bg-justcom-green hover:bg-justcom-green/90 text-white" disabled={loading || userLoading}>
            {loading ? "Anmelden..." : "Anmelden"}
          </Button>
        </form>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-8 text-center">
          Wenden Sie sich an Ihren Administrator, um ein Konto zu erhalten.
        </p>
      </div>

      {/* Impressum Footer Bar */}
      <footer className="w-full max-w-md text-center py-4 mt-8">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <button 
            onClick={() => navigate("/ImpressumPage")} 
            className="mb-2 text-justcom-blue hover:text-justcom-blue/80 hover:underline"
          >
            Impressum
          </button>
          <div className="flex justify-center space-x-4 mt-2">
            <img src="https://static.databutton.com/public/12488b2a-5495-49b3-9146-07e8a9e033b2/s-mobil.png" alt="S-Mobil Logo" className="h-10 w-auto" />
            <img src="https://static.databutton.com/public/12488b2a-5495-49b3-9146-07e8a9e033b2/Haspa.png" alt="Haspa Logo" className="h-10 w-auto" />
          </div>
        </div>
      </footer>

    </div>
  );
}
