
"use client";
import React from 'react';
import { Button } from '@/components/ui/button';
import { NabdAlMalaebLogo } from '@/components/icons/NabdAlMalaebLogo';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { GoogleAuthProvider, signInWithRedirect } from 'firebase/auth';
import { auth } from '@/firebase';

interface WelcomeScreenProps {
  onGuestChoice: () => void;
}

export function WelcomeScreen({ onGuestChoice }: WelcomeScreenProps) {
  
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (e) {
      console.error("Login Error:", e);
      // Optionally show a toast or alert to the user here
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <NabdAlMalaebLogo className="h-24 w-24 mb-4" />
        <h1 className="text-3xl font-bold mb-2 font-headline text-primary">أهلاً بك في نبض الملاعب</h1>
        <p className="text-muted-foreground mb-8">عالم كرة القدم بين يديك. سجل الدخول لمزامنة مفضلاتك، أو تصفح كزائر.</p>
        
        <div className="w-full max-w-xs space-y-4">
            <Button 
              onClick={handleGoogleLogin} 
              className="w-full" 
              size="lg"
            >
              <GoogleIcon className="h-5 w-5 mr-2" />
              المتابعة باستخدام جوجل
            </Button>
            <Button
                variant="ghost"
                onClick={onGuestChoice}
                className="w-full"
            >
                تصفح كزائر
            </Button>
        </div>

        <p className="mt-8 text-xs text-muted-foreground/80 px-4">
          بالاستمرار، أنت توافق على شروط الخدمة و سياسة الخصوصية.
        </p>
      </div>
    </div>
  );
}
