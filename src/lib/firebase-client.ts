
"use client";

import { 
  GoogleAuthProvider,
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
  type User, 
  linkWithCredential,
  signInAnonymously as firebaseSignInAnonymously
} from "firebase/auth";
import { doc, setDoc, getDoc, Firestore, writeBatch } from 'firebase/firestore';
import type { UserProfile, UserScore, Favorites } from './types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { auth, firestore as db } from "@/firebase";
import { getLocalFavorites, clearLocalFavorites } from './local-favorites';
import { getDatabase, ref, set } from 'firebase/database';


export const handleNewUser = async (user: User, firestore: Firestore) => {
    const userRef = doc(firestore, 'users', user.uid);
    const leaderboardRef = doc(firestore, 'leaderboard', user.uid);
    const favoritesRef = doc(firestore, 'users', user.uid, 'favorites', 'data');
    const rtdb = getDatabase();
    const rtdbUserRef = ref(rtdb, `users/${user.uid}`);

    try {
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
            const displayName = user.displayName || `مستخدم_${user.uid.substring(0, 5)}`;
            const photoURL = user.photoURL || '';

            const userProfileData: UserProfile = {
                displayName: displayName,
                email: user.email!,
                photoURL: photoURL,
                isProUser: false,
                isAnonymous: user.isAnonymous,
                onboardingComplete: false,
            };

            const leaderboardEntry: UserScore = {
                userId: user.uid,
                userName: displayName,
                userPhoto: photoURL,
                totalPoints: 0,
            };

            const initialFavorites: Partial<Favorites> = {
                userId: user.uid,
                teams: {},
                leagues: {},
            };
            
            // This is a special handling for merging local favorites for a new user
            const localFavorites = getLocalFavorites();
            if (Object.keys(localFavorites.teams || {}).length > 0 || Object.keys(localFavorites.leagues || {}).length > 0) {
                 const mergedTeams = { ...(initialFavorites.teams || {}), ...(localFavorites.teams || {}) };
                 const mergedLeagues = { ...(initialFavorites.leagues || {}), ...(localFavorites.leagues || {}) };
                 initialFavorites.teams = mergedTeams;
                 initialFavorites.leagues = mergedLeagues;
                 clearLocalFavorites();
            }


            const batch = writeBatch(firestore);
            batch.set(userRef, userProfileData);
            batch.set(leaderboardRef, leaderboardEntry);
            batch.set(favoritesRef, initialFavorites);

            await Promise.all([
                batch.commit(),
                set(rtdbUserRef, {
                    displayName,
                    photoURL,
                }),
            ]);
        }
    } catch (error: any) {
        const permissionError = new FirestorePermissionError({
            path: `users/${user.uid} and related docs`,
            operation: 'write',
            requestResourceData: { 
                userProfile: { displayName: user.displayName, email: user.email },
                leaderboard: { userId: user.uid, userName: user.displayName }
            }
        });
        errorEmitter.emit('permission-error', permissionError);
        throw error;
    }
}


export const signOut = (): Promise<void> => {
    localStorage.removeItem('goalstack_guest_onboarding_complete');
    return firebaseSignOut(auth);
};


export const updateUserDisplayName = async (user: User, newDisplayName: string): Promise<void> => {
    if (!user) throw new Error("User not authenticated.");

    await updateProfile(user, { displayName: newDisplayName });

    const userRef = doc(db, 'users', user.uid);
    const leaderboardRef = doc(db, 'leaderboard', user.uid);
    const rtdbUserRef = ref(getDatabase(), `users/${user.uid}`);
    
    const userProfileUpdateData = { displayName: newDisplayName };
    setDoc(userRef, userProfileUpdateData, { merge: true })
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: userProfileUpdateData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });

    const leaderboardUpdateData = { userName: newDisplayName };
    setDoc(leaderboardRef, leaderboardUpdateData, { merge: true })
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: leaderboardRef.path,
                operation: 'update',
                requestResourceData: leaderboardUpdateData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });

    set(rtdbUserRef, { displayName: newDisplayName, photoURL: user.photoURL }).catch(console.error);
};

export async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
}
