import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "app"; // Correct import for Firebase Auth User hook
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton"; // For loading state

export default function App() {
  const { user, loading } = useCurrentUser();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-sky-100 via-green-50 to-blue-50 p-4">
        <Card className="w-full max-w-lg shadow-2xl">
          <CardHeader className="text-center">
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <Skeleton className="h-6 w-1/2 mx-auto mt-2" />
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-6 p-8">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-10 w-full max-w-xs" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user) {
    // User is logged in
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-sky-100 via-green-50 to-blue-50 p-4">
        <Card className="w-full max-w-lg shadow-2xl text-center">
          <CardHeader className="text-center"> {/* Added text-center here for logo */}
            <img src="https://static.databutton.com/public/12488b2a-5495-49b3-9146-07e8a9e033b2/logo_justcom_claim_v21-300x76.png" alt="Justcom Logo" className="mx-auto mb-4 h-16 w-auto" />
            <CardTitle className="text-3xl font-bold">Justcom Home</CardTitle>
            <CardDescription className="text-lg pt-2">
              Sie sind angemeldet.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-6 p-8">
            <p className="text-muted-foreground">
              Navigieren Sie zu Ihrem Dashboard, um Ihre Reparaturfälle zu verwalten.
            </p>
            <Button 
              size="lg" 
              className="w-full max-w-xs bg-justcom-green hover:bg-justcom-green/90 text-white"
              onClick={() => navigate("/Dashboard")} // Navigate to DashboardPage
            >
              Zum Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is not logged in - original welcome screen
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Willkommen bei Justcom</CardTitle>
          <CardDescription className="text-lg pt-2">
            Ihr Dashboard zur effizienten Bearbeitung von Reparaturfällen.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6 p-8">
          <p className="text-center text-muted-foreground">
            Justcom hilft Ihnen, Reparaturfälle schnell zu bearbeiten, indem es automatisch alle Fälle filtert, bei denen in der Spalte "Versicherung" ein "Ja" eingetragen ist. Konzentrieren Sie sich auf das Wesentliche.
          </p>
          <Button 
            size="lg" 
            className="w-full max-w-xs bg-justcom-green hover:bg-justcom-green/90 text-white"
            onClick={() => navigate("/login")} // Navigate to login page
          >
            Anmelden
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
