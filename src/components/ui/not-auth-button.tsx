import { Button } from "@/components/ui/button";

type NotAuthButtonProps = {
  onAddPlaceholder: () => void;
};

export default function NotAuthButton({ onAddPlaceholder }: NotAuthButtonProps) {
  return (
    <Button
      className="px-3 py-2 bg-orange-500 text-white rounded"
      onClick={onAddPlaceholder}
    >
      Not Auth
    </Button>
  );
}
