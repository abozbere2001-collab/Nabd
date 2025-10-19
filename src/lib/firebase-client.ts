
"use client";

import { 
  GoogleAuthProvider, 
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithPopup,
  signInAnonymously as firebaseSignInAnonymously,
  updateProfile,
  type User, 
} from "firebase/auth";
import { doc, setDoc, getDoc, Firestore } from 'firebase/firestore';
import type { UserProfile, UserScore } from './types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { auth, firestore as db } from "@/firebase";

// ملاحظة أمنية هامة:
// كل المعلومات والإعدادات في هذا الملف (مثل `firebaseConfig`) مصممة لتكون عامة وتعمل في بيئة العميل (المتصفح).
// الأمان الحقيقي للتطبيق لا يعتمد على إخفاء هذه المعلومات، بل يعتمد بشكل كامل على "قواعد الأمان" (Security Rules)
// التي يتم تطبيقها على خوادم Firebase. هذه القواعد هي التي تحدد من يمكنه قراءة أو كتابة البيانات،
// وتمنع أي وصول غير مصرح به حتى لو كان شخص ما يمتلك إعدادات المشروع.

export const handleNewUser = async (user: User, firestore: Firestore) => {
    const userRef = doc(firestore, 'users', user.uid);
    const leaderboardRef = doc(firestore, 'leaderboard', user.uid);

    try {
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
            const displayName = user.isAnonymous 
                ? `زائر_${user.uid.substring(0, 5)}`
                : user.displayName || `مستخدم_${user.uid.substring(0, 5)}`;
            
            const photoURL = user.photoURL || '';

            const userProfileData: UserProfile = {
                displayName: displayName,
                email: user.email!,
                photoURL: photoURL,
                isProUser: false,
                isAnonymous: user.isAnonymous,
                onboardingComplete: false,
            };
            await setDoc(userRef, userProfileData)
              .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                  path: userRef.path,
                  operation: 'create',
                  requestResourceData: userProfileData,
                });
                errorEmitter.emit('permission-error', permissionError);
              });

             const leaderboardEntry: UserScore = {
                userId: user.uid,
                userName: displayName,
                userPhoto: photoURL,
                totalPoints: 0,
            };
            await setDoc(leaderboardRef, leaderboardEntry)
              .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                  path: leaderboardRef.path,
                  operation: 'create',
                  requestResourceData: leaderboardEntry,
                });
                errorEmitter.emit('permission-error', permissionError);
              });
        }

    } catch (error: any) {
        const permissionError = new FirestorePermissionError({
            path: `users/${user.uid} or leaderboard/${user.uid}`,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
    }
}


export const signInWithGoogle = async (): Promise<User> => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
};

export const signInAnonymously = async (): Promise<User> => {
    const result = await firebaseSignInAnonymously(auth);
    return result.user;
}


export const signOut = (): Promise<void> => {
    return firebaseSignOut(auth);
};


export const updateUserDisplayName = async (user: User, newDisplayName: string): Promise<void> => {
    if (!user) throw new Error("User not authenticated.");

    // Update Firebase Auth profile first
    await updateProfile(user, { displayName: newDisplayName });

    const userRef = doc(db, 'users', user.uid);
    const leaderboardRef = doc(db, 'leaderboard', user.uid);
    
    // Update users collection
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

    // Update leaderboard collection
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
};
