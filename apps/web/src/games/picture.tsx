import type { Picture } from '@happyclass/game-core/templates';

export function PictureView({ picture, size = 64, className }: { picture: Picture; size?: number; className?: string }) {
  if (picture.kind === 'emoji') {
    return <span className={`pic-emoji ${className ?? ''}`} style={{ fontSize: size }} role="img" aria-hidden="true">{picture.value}</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={picture.src} alt={picture.alt} width={size} height={size} style={{ objectFit: 'contain' }} />;
}
