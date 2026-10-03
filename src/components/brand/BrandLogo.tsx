import type { ImgHTMLAttributes } from 'react'

type BrandLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  alt?: string
}

export function BrandLogo({ alt = 'Classy', className = '', ...props }: BrandLogoProps) {
  const imageClass = `w-auto max-w-full object-contain ${className}`.trim()

  return (
    <>
      <img src="/logo/logo-light-mode.png" alt={alt} className={`block dark:hidden ${imageClass}`} {...props} />
      <img src="/logo/logo-dark-mode.png" alt="" aria-hidden="true" className={`hidden dark:block ${imageClass}`} {...props} />
    </>
  )
}
