import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { signOut, getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import signOutIcon from "@/assets/sign-out.svg";

function DefaultLayout({ children }: { children: React.ReactNode }) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    const fetchUserEmail = async () => {
      const user = await getCurrentUser();
      if (user?.email) {
        const name = user.email.split("@")[0]
          .replace(/\./g, " ")
          .split(" ")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" ");
        setUserEmail(name);
      }
    };
    fetchUserEmail();
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      // The AuthGuard will automatically redirect to login on sign out
    } catch (error) {
      logger.error("Error signing out:", error);
      toast.error("Failed to sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="text-black p-4 flex-shrink-0">
        {/* Top right sign out button with email */}
        <div className="flex justify-end items-center gap-2 mb-2">
          {userEmail && (
            <span className="text-sm text-gray-600">{userEmail}</span>
          )}
          <Button
            className="w-auto"
            variant="outline"
            onClick={handleSignOut}
            disabled={isSigningOut}
            title={isSigningOut ? "Signing out..." : "Sign Out"}
          >
            <img 
              src={signOutIcon} 
              alt="Sign Out" 
              className="w-5 h-5"
            />
          </Button>
        </div>
        
        <h1 className="text-2xl font-bold">Returns App Beta</h1>
      </header>
      <main className="flex-1 p-4">{children}</main>
      <footer className="bg-gray-200 text-center p-4 ">
        &copy; {new Date().getFullYear()} Techra. All rights reserved.
        <br />
        Version 0.10.0
      </footer>
    </div>
  );
}

export default DefaultLayout;
