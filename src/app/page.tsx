
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth, useFirestore } from '@/firebase';
import { AppContentWrapper } from './AppContentWrapper';
import { AdProvider } from '@/components/AdProvider';
import { Loader2 } from 'lucide-react';
import { FavoriteSelectionScreen } from './screens/FavoriteSelectionScreen';
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { NabdAlMalaebLogo } from '@/components/icons/NabdAlMalaebLogo';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { getLocalFavorites, setLocalFavorites } from '@/lib/local-favorites';
import { signInWithGoogle, handleNewUser } from '@/lib/firebase-client';

export type ScreenKey = 'Welcome' | 'Matches' | 'Competitions' | 'AllCompetitions' | 'Iraq' | 'News' | 'Settings' | 'CompetitionDetails' | 'TeamDetails' | 'PlayerDetails' | 'AdminFavoriteTeamDetails' | 'Comments' | 'Notifications' | 'GlobalPredictions' | 'AdminMatchSelection' | 'Profile' | 'SeasonPredictions' | 'SeasonTeamSelection' | 'SeasonPlayerSelection' | 'AddEditNews' | 'ManageTopScorers' | 'MatchDetails' | 'NotificationSettings' | 'GeneralSettings' | 'ManagePinnedMatch' | 'PrivacyPolicy' | 'TermsOfService' | 'FavoriteSelection' | 'GoPro' | 'Login';

export type ScreenProps = {
  navigate: (screen: ScreenKey, props?: Record<string, any>) => void;
  goBack: () => void;
  canGoBack: boolean;
};

const GUEST_ONBOARDING_COMPLETE_KEY = 'goalstack_guest_onboarding_complete';

const LoadingSplashScreen = () => (
    <div className="flex flex-col items-center justify-center h-screen bg-background text-center">
        <NabdAlMalaebLogo className="h-24 w-24 mb-4" />
        <h1 className="text-2xl font-bold font-headline mb-8 text-primary">نبض الملاعب</h1>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
);


const AppFlow = () => {
    const { user, isUserLoading } = useAuth();
    const { db } = useFirestore();
    const [flowState, setFlowState] = useState<'loading' | 'welcome' | 'favorite_selection' | 'app'>('loading');

    useEffect(() => {
        const checkUserStatus = async () => {
            if (isUserLoading) {
                setFlowState('loading');
                return;
            }

            // For development, always show welcome screen if not logged in.
            // In production, you would re-enable the localStorage check.
            const alwaysShowWelcomeForTesting = true; 

            if (user) {
                // User is logged in, check if they have completed onboarding in Firestore
                if (!db) return;
                const userDocRef = doc(db, 'users', user.uid);
                try {
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists() && userDoc.data().onboardingComplete) {
                        setFlowState('app');
                    } else {
                        // New registered user or existing user who hasn't onboarded
                        setFlowState('favorite_selection');
                    }
                } catch (error) {
                    const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'get' });
                    errorEmitter.emit('permission-error', permissionError);
                    setFlowState('app'); // Fail gracefully
                }
            } else {
                // No user is logged in
                if (alwaysShowWelcomeForTesting) {
                     setFlowState('welcome');
                     return;
                }
                const guestOnboardingComplete = localStorage.getItem(GUEST_ONBOARDING_COMPLETE_KEY) === 'true';
                 if (guestOnboardingComplete) {
                    setFlowState('app');
                } else {
                    setFlowState('welcome');
                }
            }
        };

        checkUserStatus();

    }, [user, isUserLoading, db]);

    const handleOnboardingComplete = async () => {
        if (user && db) {
             const userDocRef = doc(db, 'users', user.uid);
             try {
                // This ensures the user exists before updating
                await setDoc(userDocRef, { onboardingComplete: true }, { merge: true });
            } catch (error) {
                const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'update', requestResourceData: { onboardingComplete: true } });
                errorEmitter.emit('permission-error', permissionError);
            }
        } else {
            // This is a guest user completing onboarding
            localStorage.setItem(GUEST_ONBOARDING_COMPLETE_KEY, 'true');
        }
        setFlowState('app');
    };
    
    const handleChoice = (choice: 'google' | 'guest') => {
        if (choice === 'google') {
            signInWithGoogle().catch(err => console.error(err));
            // The useEffect hook will react to the user change and move to favorite_selection
        } else { // guest
            setFlowState('favorite_selection');
        }
    };
    
    switch (flowState) {
        case 'loading':
             return <LoadingSplashScreen />;
        case 'welcome':
            return <WelcomeScreen onChoice={handleChoice} />;
        case 'favorite_selection':
            return <FavoriteSelectionScreen onOnboardingComplete={handleOnboardingComplete} />;
        case 'app':
            return (
                <AdProvider>
                    <AppContentWrapper />
                </AdProvider>
            );
        default:
             return <LoadingSplashScreen />;
    }
};

export default function Home() {
  return (
    <AppFlow />
  );
}
