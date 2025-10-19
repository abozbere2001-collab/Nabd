
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { NabdAlMalaebLogo } from '@/components/icons/NabdAlMalaebLogo';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from 'lucide-react';
import { signInWithGoogle } from '@/lib/firebase-client';
import type { ScreenProps } from '@/app/page';

export function LoginScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuthError = (e: any) => {
    console.error("Login Error:", e);
    
    let errorMessage = e.message || 'حدث خطأ أثناء محاولة تسجيل الدخول. يرجى المحاولة مرة أخرى.';

    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        errorMessage = 'تم إلغاء عملية تسجيل الدخول.';
    }
    
    setError(errorMessage);
    setLoading(false);
  }

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // Auth state listener in AppFlow will handle navigation
      // and data migration. After successful sign-in, the user will
      // be in the 'app' state.
    } catch (e: any) {
      handleAuthError(e);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        {error && (
          <Alert variant="destructive" className="mb-6 text-right">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>خطأ في تسجيل الدخول</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <NabdAlMalaebLogo className="h-24 w-24 mb-4" />
        <h1 className="text-3xl font-bold mb-2 font-headline text-primary">تسجيل الدخول</h1>
        <p className="text-muted-foreground mb-8">قم بتسجيل الدخول لمزامنة مفضلاتك وبياناتك عبر أجهزتك.</p>
        
        <div className="w-full max-w-xs space-y-4">
            <Button 
              onClick={handleGoogleLogin} 
              className="w-full" 
              disabled={loading}
              size="lg"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <GoogleIcon className="h-5 w-5 mr-2" />
              )}
              المتابعة باستخدام جوجل
            </Button>
            <Button
                variant="ghost"
                onClick={goBack}
                className="w-full"
                disabled={loading}
            >
                العودة
            </Button>
        </div>

        <p className="mt-8 text-xs text-muted-foreground/80 px-4">
          بالاستمرار، أنت توافق على 
          <button className="underline hover:text-primary px-1" onClick={() => navigate('TermsOfService')}>شروط الخدمة</button> 
          و 
          <button className="underline hover:text-primary px-1" onClick={() => navigate('PrivacyPolicy')}>سياسة الخصوصية</button>
          .
        </p>
      </div>
    </div>
  );
}
