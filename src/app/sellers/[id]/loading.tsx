import { Loader2 } from 'lucide-react';

export default function LoadingSellerPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );
}
