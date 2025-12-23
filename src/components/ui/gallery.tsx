import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
} from "@/components/ui/item";
import { X } from "lucide-react";

export type GalleryItem = {
  id: string;
  isbn: string;
  fileName: string;
  blob: Blob;
  preview: string; // object URL
  uploading?: boolean;
  uploaded?: boolean;
};

type GalleryProps = {
  items: GalleryItem[];
  onRemove: (id: string) => void;
};

export default function Gallery({
  items,
  onRemove,
}: GalleryProps) {
  return (
    <div className="space-y-3">
      <ItemGroup className="flex flex-row flex-wrap gap-2">
        {items.map((item) => (
          <Item 
            key={item.id} 
            variant="outline" 
            className="flex flex-row bg-white rounded-md relative w-50"
          >
            <ItemHeader className="flex justify-center">
              <img
                src={item.preview}
                alt={item.fileName}
                className="w-32 h-32 object-cover rounded-sm text-wrap text-center"
                onError={(e) => {
                  console.error("Failed to load image preview:", item.preview, item.fileName);
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
                onLoad={() => {
                  console.log("Image preview loaded:", item.fileName);
                }}
              />
            </ItemHeader>
            <ItemContent className="text-center flex-1 flex flex-col items-center text-wrap justify-center w-24">
              <ItemDescription className="text-muted-foreground text-xs text-center">
                ISBN: {item.isbn}
              </ItemDescription>
              <ItemDescription className="text-muted-foreground text-xs text-center break-words">
                File: {item.fileName}
              </ItemDescription>
              <ItemDescription className="text-muted-foreground text-xs text-center">
                Status:{" "}
                {item.uploaded
                  ? "Uploaded"
                  : item.uploading
                  ? "Uploading..."
                  : "Pending"}
              </ItemDescription>
            </ItemContent>
            <button
              onClick={() => onRemove(item.id)}
              className="absolute top-2 right-2 p-1 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors z-10"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </Item>
        ))}
      </ItemGroup>

      {items.length === 0 && (
        <div className="text-sm text-gray-500">No captured images</div>
      )}
    </div>
  );
}
