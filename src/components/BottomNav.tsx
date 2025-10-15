
"use client";
import { Star, Newspaper, MoreHorizontal, Shield, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScreenKey } from '@/app/page';
import { FootballIcon } from './icons/FootballIcon';
import React, { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTranslation } from './LanguageProvider';


const IRAQ_TOUR_KEY = 'goalstack_iraq_tour_seen';

interface BottomNavProps {
  activeScreen: ScreenKey;
  onNavigate: (screen: ScreenKey) => void;
}

export function BottomNav({ activeScreen, onNavigate }: BottomNavProps) {
  const [showTour, setShowTour] = useState(false);
  const { t } = useTranslation();

  const navItems: { key: ScreenKey; label: string; icon: React.ElementType }[] = [
    { key: 'Matches', label: t('matches'), icon: Shield },
    { key: 'Competitions', label: t('my_choices'), icon: Star },
    { key: 'Iraq', label: t('iraq'), icon: FootballIcon },
    { key: 'News', label: t('news'), icon: Newspaper },
    { key: 'Notifications', label: t('notifications'), icon: Bell },
  ];

  useEffect(() => {
    // This effect runs only on the client
    const hasSeenTour = localStorage.getItem(IRAQ_TOUR_KEY);
    if (hasSeenTour !== 'true') {
      const timer = setTimeout(() => {
        setShowTour(true);
      }, 1500); // Delay before showing the tour popover
      return () => clearTimeout(timer);
    }
  }, []);

  const handleTourOpenChange = (open: boolean) => {
    // This is called when the popover tries to close (e.g., by clicking outside)
    if (!open) {
      setShowTour(false);
      localStorage.setItem(IRAQ_TOUR_KEY, 'true');
    }
  };
  
  const handleNavigation = (key: ScreenKey) => {
    if (showTour) {
        // If the tour is showing, interacting with the nav should hide it.
        handleTourOpenChange(false);
    }
    if (navItems.some(item => item.key === key)) {
      onNavigate(key);
    }
  };

  return (
    <div className="h-16 flex-shrink-0 border-t bg-card/95 backdrop-blur-md">
      <nav className="flex h-full items-center justify-around px-2 max-w-md mx-auto">
        {navItems.map(({ key, label, icon: Icon }) => {
          const isActive = activeScreen === key;
          const isIraqTab = key === 'Iraq';

          const NavButton = (
             <button
              key={key}
              onClick={() => handleNavigation(key as ScreenKey)}
              className={cn(
                'relative flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-xs font-medium outline-none transition-colors w-[60px]',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-6 w-6" />
              <span>{label}</span>
              {isActive && (
                <div className="absolute bottom-1 h-1 w-6 rounded-full bg-primary" />
              )}
            </button>
          );

          if (isIraqTab) {
            return (
              <Popover key={key} open={showTour} onOpenChange={handleTourOpenChange}>
                <PopoverTrigger asChild>
                  {NavButton}
                </PopoverTrigger>
                <PopoverContent side="top" align="center" className="w-auto p-2">
                  <p className="text-sm font-semibold">{t('iraq_tour_tooltip')}</p>
                </PopoverContent>
              </Popover>
            );
          }

          return NavButton;
        })}
      </nav>
    </div>
  );
}
