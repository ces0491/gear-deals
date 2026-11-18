import { ImageOff } from "lucide-react";

import { cn } from "@/lib/cn";
import { sizedImage } from "@/lib/images";

interface ProductImageProps {
  src: string | null;
  alt: string;
  width: number;
  className?: string;
  priority?: boolean;
}

/**
 * A store's own photo, loaded from the store. A plain <img> rather than next/image:
 * routing thousands of store photos through an image optimiser would copy them onto this
 * site's quota for no gain, since the stores already serve sized images.
 */
export function ProductImage({ src, alt, width, className, priority = false }: ProductImageProps) {
  return (
    <div className={cn("flex aspect-square items-center justify-center overflow-hidden bg-photo", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- see the component comment
        <img
          src={sizedImage(src, width)}
          alt={alt}
          width={width}
          height={width}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain p-3 mix-blend-multiply"
        />
      ) : (
        <ImageOff aria-hidden className="size-8 text-[#8a9396]" />
      )}
    </div>
  );
}
