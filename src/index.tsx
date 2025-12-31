import { Button } from "@/components/ui/button";
import DefaultLayout from "@/DefaultLayout";
import { Link } from "react-router-dom";
import { AuthGuard } from "@/components/auth-guard";

function IndexPage() {
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
        </div>
      </DefaultLayout>
    </AuthGuard>
  );
}
export default IndexPage;
