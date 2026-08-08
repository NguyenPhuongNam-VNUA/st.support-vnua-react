'use client';

import NextLink from 'next/link';

export default function Link({
  ref,
  href,
  children,
  ...others
}: any) {
  return (
    <NextLink ref={ref} href={href || '#'} {...others}>
      {children}
    </NextLink>
  );
}