"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { BottomNav } from '@/components/BottomNav';
import { MatchesScreen } from './screens/MatchesScreen';
import { CompetitionsScreen } from './screens/CompetitionsScreen';
import { IraqScreen } from './screens/IraqScreen';
import { NewsScreen } from './screens/NewsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { CompetitionDetailScreen } from './screens/CompetitionDetailScreen';
import { cn } from '@/lib/utils';
import { LoginScreen } from './screens/LoginScreen';
import { getAuth } from 'firebase/auth';
import { initializeFirebase } from '@/lib/firebase';

// Initialize Firebase and Auth
const app = initializeFirebase();
const auth = getAuth(app);

export type ScreenKey = 'Login' | 'SignUp' | 'Matches' | 'Competitions' | 'Iraq' | 'News' | 'Settings' | 'CompetitionDetails';
export type ScreenProps = {
  navigate: (screen: ScreenKey, props?: Record<string, any>) => void;
  goBack: () => void;
  canGoBack: boolean;
};

const screens: Record<ScreenKey, React.ComponentType<any>> = {
  Login: LoginScreen,
  SignUp: LoginScreen, 
  Matches: MatchesScreen,
  Competitions: CompetitionsScreen,
  Iraq: IraqScreen,
  News: NewsScreen,
  Settings: SettingsScreen,
  CompetitionDetails: CompetitionDetailScreen,
};

const mainTabs: ScreenKey[] = ['Matches', 'Competitions', 'Iraq', 'News', 'Settings'];

type StackItem = {
  key: string;
  screen: ScreenKey;
  props?: Record<string, any>;
};

function AppContent({ user }: { user: User }) {
  const [stack, setStack] = useState<StackItem[]>([{ key: 'Matches-0', screen: 'Matches' }]);
  const [isAnimatingOut, setIsAnimatingOut] = useState<string | null>(null);
  
  const screenInstances = useRef<Record<string, JSX.Element>>({});

  const goBack = useCallback(() => {
    if (stack.length > 1) {
      const lastItemKey = stack[stack.length - 1].key;
      setIsAnimatingOut(lastItemKey);
      setTimeout(() => {
        setStack(prev => {
            const newStack = prev.slice(0, -1);
            delete screenInstances.current[lastItemKey];
            return newStack;
        });
        setIsAnimatingOut(null);
      }, 300);
    }
  }, [stack]);

  const navigate = useCallback((screen: ScreenKey, props?: Record<string, any>) => {
    const isMainTab = mainTabs.includes(screen);
    const newKey = `${screen}-${Date.now()}`;
    const newItem = { key: newKey, screen, props };

    setStack(prevStack => {
      if (isMainTab) {
        if (prevStack.length === 1 && prevStack[0].screen === screen) return prevStack;
        screenInstances.current = {}; 
        return [newItem];
      } else {
        return [...prevStack, newItem];
      }
    });
  }, []);

  const renderedStack = useMemo(() => {
    const canGoBack = stack.length > 1;
    const navigationProps = { navigate, goBack, canGoBack };
    
    return stack.map((item) => {
      if (!screenInstances.current[item.key]) {
        const ScreenComponent = screens[item.screen];
        screenInstances.current[item.key] = <ScreenComponent {...navigationProps} {...item.props} />;
      }
      return {
        ...item,
        component: screenInstances.current[item.key]
      };
    });
  }, [stack, navigate, goBack]);

  const activeScreenKey = stack.length > 0 ? stack[stack.length - 1].screen : null;
  const showBottomNav = user && activeScreenKey && mainTabs.includes(activeScreenKey);

  return (
    <main className="h-screen w-screen bg-background flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        {renderedStack.map((item, index) => {
          const isTop = index === stack.length - 1;
          const isAnimating = isAnimatingOut === item.key;
          
          return (
            <div
              key={item.key}
              className={cn(
                "absolute inset-0 bg-background transition-transform duration-300 ease-out flex flex-col",
                stack.length > 1 && index > 0 && isTop && !isAnimating ? 'animate-slide-in-from-right' : '',
                isAnimating ? 'animate-slide-out-to-right' : '',
                !isTop ? 'pointer-events-none' : ''
              )}
              style={{ 
                zIndex: index,
                visibility: isTop ? 'visible' : 'hidden'
              }}
              aria-hidden={!isTop}
            >
              {item.component}
            </div>
          );
        })}
      </div>
      
      {showBottomNav && activeScreenKey && <BottomNav activeScreen={activeScreenKey} onNavigate={navigate} />}
    </main>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  if (loadingAuth) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (!user) {
    // Pass a dummy navigate function as it won't be used, but LoginScreen expects it.
    // Real navigation is handled by the user state change.
    return <LoginScreen navigate={() => {}} goBack={() => {}} canGoBack={false} />;
  }

  return <AppContent user={user} />;
}
