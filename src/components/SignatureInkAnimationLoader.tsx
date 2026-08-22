"use client";

import dynamic from 'next/dynamic';

// WebGL doesn't exist server-side, and `ssr: false` in next/dynamic is only
// allowed from a Client Component — hence this thin wrapper around the
// actual (decorative, non-critical) animation.
const SignatureInkAnimation = dynamic(() => import('@/components/SignatureInkAnimation'), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="w-full max-w-2xl mx-auto h-32 md:h-40" />,
});

export default SignatureInkAnimation;
