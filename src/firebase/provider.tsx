
'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect, useCallback } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { handleNewUser } from '@/lib/firebase-client';
import { FirestorePermissionError } from './errors';
import { errorEmitter } from './error-emitter';

interface FirebaseContextProps {
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: User | null;
  isAdmin: boolean;
  isProUser: boolean;
  setProUser: (isPro: boolean) => Promise<void>;
  makeAdmin: () => Promise<void>;
  isLoading: boolean;
}

const FirebaseContext = createContext<FirebaseContextProps | undefined>(undefined);

export const FirebaseProvider = ({
  children,
  firebaseApp,
  auth,
  firestore,
}: {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isProUser, setProUser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkUserStatus = useCallback(async (firebaseUser: User | null) => {
    if (!firebaseUser || !firestore) {
        setUser(null);
        setIsAdmin(false);
        setProUser(false);
        setIsLoading(false);
        return;
    }

    setUser(firebaseUser);
    setIsLoading(true);

    const adminDocRef = doc(firestore, 'admins', firebaseUser.uid);
    const userDocRef = doc(firestore, 'users', firebaseUser.uid);

    try {
        // Check admin status. We expect this to fail for non-admins.
        const adminDocPromise = getDoc(adminDocRef)
            .then(docSnap => docSnap.exists()) // Returns true if admin, false otherwise
            .catch(error => {
                // If it's a permission error, it's expected for non-admins. Return false.
                if (error.code === 'permission-denied') {
                    return false;
                }
                // For other errors, emit a proper permission error
                const permissionError = new FirestorePermissionError({ path: adminDocRef.path, operation: 'get' });
                errorEmitter.emit('permission-error', permissionError);
                throw permissionError;
            });

        // Check user profile data (pro status, etc.)
        const userDocPromise = getDoc(userDocRef).catch(serverError => {
            const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'get' });
            errorEmitter.emit('permission-error', permissionError);
            throw permissionError;
        });

        const [isAdminStatus, userDoc] = await Promise.all([
            adminDocPromise,
            userDocPromise
        ]);

        setIsAdmin(isAdminStatus);
        
        if (userDoc.exists()) {
            setProUser(userDoc.data()?.isProUser || false);
        } else {
            await handleNewUser(firebaseUser, firestore);
            setProUser(false);
        }

    } catch (error) {
        console.error("Failed to check user status, this might be expected for some operations.", error);
    } finally {
        setIsLoading(false);
    }
  }, [firestore]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, checkUserStatus);
    return () => unsubscribe();
  }, [auth, checkUserStatus]);
  
  const handleSetPro = async (isPro: boolean) => {
    if (user && firestore) {
        const userDocRef = doc(firestore, 'users', user.uid);
        const data = { isProUser: isPro };
        try {
            await setDoc(userDocRef, data, { merge: true });
            setProUser(isPro); // Update state after successful write
        } catch (error) {
            const permissionError = new FirestorePermissionError({
              path: userDocRef.path,
              operation: 'update',
              requestResourceData: data,
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    }
  }

  const handleMakeAdmin = async () => {
    if (user && firestore) {
        const adminDocRef = doc(firestore, 'admins', user.uid);
        const data = { isAdmin: true, addedAt: new Date() };
        try {
            await setDoc(adminDocRef, data);
            setIsAdmin(true); // Update state after successful write
        } catch (error) {
            const permissionError = new FirestorePermissionError({
              path: adminDocRef.path,
              operation: 'create',
              requestResourceData: data,
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    }
  }


  const value = { firebaseApp, firestore, auth, user, isAdmin, isProUser, setProUser: handleSetPro, makeAdmin: handleMakeAdmin, isLoading };

  return (
    <FirebaseContext.Provider value={value}>
       <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};

export const useAuth = () => {
    const context = useFirebase();
    if (context === undefined) {
        throw new Error('useAuth must be used within a FirebaseProvider');
    }
    return { 
        user: context.user, 
        isProUser: context.isProUser, 
        setProUser: context.setProUser,
        isUserLoading: context.isLoading
    };
};

export const useAdmin = () => {
    const context = useFirebase();
    if (context === undefined) {
        throw new Error('useAdmin must be used within a FirebaseProvider');
    }
    return { 
        isAdmin: context.isAdmin,
        makeAdmin: context.makeAdmin,
    };
};

export const useFirestore = () => {
    const context = useFirebase();
    if (context === undefined) {
        throw new Error('useFirestore must be used within a FirebaseProvider');
    }
    return { db: context.firestore };
};

export const useFirebaseApp = () => {
    const context = useFirebase();
    if (context === undefined) {
        throw new Error('useFirebaseApp must be used within a FirebaseProvider');
    }
    return { app: context.firebaseApp };
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

export const useUser = (): { user: User | null; isUserLoading: boolean } => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    return { user: null, isUserLoading: true };
  }
  return { user: context.user, isUserLoading: context.isLoading };
};
