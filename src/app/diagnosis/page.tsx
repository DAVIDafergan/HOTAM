
"use client";

import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { diagnoseMezuzah } from '@/ai/flows/mezuzah-diagnosis';
import { Upload, Loader2, CheckCircle2, AlertCircle, Camera } from 'lucide-react';
import Image from 'next/image';

const MAX_DIAGNOSIS_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_DIAGNOSIS_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
]);

export default function DiagnosisPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    e.target.value = '';
    if (selectedFile) {
      if (!SUPPORTED_DIAGNOSIS_IMAGE_TYPES.has(selectedFile.type)) {
        setFile(null);
        setPreview(null);
        setResult('סוג הקובץ אינו נתמך. נא להעלות JPG/PNG/WEBP/GIF/AVIF/HEIC.');
        return;
      }

      if (selectedFile.size <= 0 || selectedFile.size > MAX_DIAGNOSIS_FILE_SIZE) {
        setFile(null);
        setPreview(null);
        setResult('גודל הקובץ אינו תקין. ניתן להעלות עד 10MB.');
        return;
      }

      setFile(selectedFile);
      setResult(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleDiagnosis = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const { diagnosis } = await diagnoseMezuzah({ photoDataUri: preview });
      setResult(diagnosis);
    } catch (error) {
      console.error(error);
      setResult("מצטערים, חלה שגיאה בעיבוד התמונה. נסה שוב מאוחר יותר.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto pt-24">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-headline font-bold text-primary mb-4">אבחון מזוזה ב-AI</h1>
            <p className="text-muted-foreground text-lg">
              העלה צילום ברור של המזוזה שלך וקבל הערכה ראשונית על מצב הכתב והכשרות מהסופר הדיגיטלי שלנו.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border-2 border-dashed border-primary/20 bg-white shadow-none">
              <CardHeader>
                <CardTitle className="text-xl text-center">העלה תמונה</CardTitle>
                <CardDescription className="text-center">וודא שהצילום מואר וברור</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center p-8">
                {preview ? (
                  <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden border mb-4">
                    <Image src={preview} alt="Preview" fill className="object-cover" />
                  </div>
                ) : (
                  <div 
                    onClick={() => document.getElementById('image-upload')?.click()}
                    className="w-full aspect-[4/3] bg-muted flex flex-col items-center justify-center rounded-lg mb-4 text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors"
                  >
                    <Camera className="w-12 h-12 mb-2" />
                    <p className="font-bold">לחץ לצילום / העלאה</p>
                  </div>
                )}
                
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                  className="hidden" 
                  id="image-upload" 
                  capture="environment"
                />
                
                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => document.getElementById('image-upload')?.click()}>
                    {preview ? 'החלף תמונה' : 'בחר תמונה'}
                  </Button>
                  {preview && (
                    <Button onClick={handleDiagnosis} disabled={loading} className="bg-primary hover:bg-primary/90">
                      {loading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> מעבד...</> : 'אבחן עכשיו'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-lg border-none">
              <CardHeader>
                <CardTitle className="text-xl">תוצאות האבחון</CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                {result ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-lg border border-primary/10">
                      <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />
                      <div className="text-right whitespace-pre-wrap leading-relaxed">
                        {result}
                      </div>
                    </div>
                    <div className="p-4 bg-accent/10 rounded-lg flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-accent shrink-0" />
                      <p className="text-sm font-medium">שימו לב: אבחון זה אינו מהווה פסק הלכתי סופי ומיועד להערכה כללית בלבד.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-muted-foreground opacity-50">
                    <PenToolIcon className="w-16 h-16 mb-4" />
                    <p>העלה תמונה כדי לקבל אבחון</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function PenToolIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l5 5" />
      <path d="M11 11l1 1" />
    </svg>
  );
}
