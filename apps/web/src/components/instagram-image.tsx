/**
 * An <img> for Instagram CDN media. Always sets referrerPolicy="no-referrer"
 * (IG blocks requests that leak our origin as the referrer) and renders nothing
 * when there's no src — replaces the four hand-written `{url && <img …/>}`
 * blocks across the tools.
 */
export function InstagramImage({
  src,
  alt = "",
  className,
}: {
  src: string | null | undefined;
  alt?: string;
  className?: string;
}) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} referrerPolicy="no-referrer" className={className} />
  );
}
