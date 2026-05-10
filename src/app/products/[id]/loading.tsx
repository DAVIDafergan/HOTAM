import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#FDFCF0] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-primary">
        <Loader2 className="w-10 h-10 animate-spin" />
        <p className="text-sm font-black">טוען את המוצר...</p>
      </div>
    </div>
  );
}
