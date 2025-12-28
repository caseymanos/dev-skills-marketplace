// Custom image loader for Cloudflare Pages
// Uses Cloudflare Images transformation API

interface ImageLoaderParams {
  src: string;
  width: number;
  quality?: number;
}

export default function cloudflareLoader({
  src,
  width,
  quality,
}: ImageLoaderParams): string {
  // For external URLs, use Cloudflare Image Resizing
  if (src.startsWith('http')) {
    const params = [`width=${width}`, `quality=${quality || 75}`, 'format=auto'];
    return `/cdn-cgi/image/${params.join(',')}/${src}`;
  }

  // For local images, return as-is (will be served from Pages)
  return src;
}
