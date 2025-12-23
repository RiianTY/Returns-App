import { useState } from "react";
import { Button } from "@/components/ui/button";
import DefaultLayout from "@/DefaultLayout";
import { Link } from "react-router-dom";
import { AuthGuard } from "@/components/auth-guard";
import { signOut } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

function IndexPage() {
  const [isSigningOut, setIsSigningOut] = useState(false);

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
    <AuthGuard>
      <DefaultLayout>
        <div className="flex flex-col">
          <Link to="./overstock">
            <Button className="m-2">Overstock</Button>
          </Link>
          <Link to="./damages">
            <Button className="m-2">Damages</Button>
          </Link>
          <Link to="./sales">
            <Button className="m-2">Sales</Button>
          </Link>
          <Link to="./final">
            <Button className="m-2">Final</Button>
          </Link>
          <Button
            className="m-2"
            variant="outline"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? "Signing out..." : "Sign Out"}
          </Button>
        </div>
      </DefaultLayout>
    </AuthGuard>
  );
}
export default IndexPage;
