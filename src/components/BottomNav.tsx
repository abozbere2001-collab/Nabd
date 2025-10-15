
"use client";
import { Star, Newspaper, MoreHorizontal, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScreenKey } from '@/app/page';
import { FootballIcon } from './icons/FootballIcon';

const navItems: { key: ScreenKey; label: string; icon: React.ElementType }[] = [
  { key: 'Matches', label: 'المباريات', icon: Shield },
  { key: 'Competitions', label: 'اختياراتي', icon: Star },
  { key: 'Iraq', label: 'العراق', icon: FootballIcon },
  { key: 'News', label: 'أخبار', icon: Newspaper },
  { key: 'Settings', label: 'المزيد', icon: MoreHorizontal },
];


interface BottomNavProps {
  activeScreen: ScreenKey;
  onNavigate: (screen: ScreenKey) => void;
}

export function BottomNav({ activeScreen, onNavigate }: BottomNavProps) {
  const handleNavigation = (key: ScreenKey) => {
    if (navItems.some(item => item.key === key)) {
      onNavigate(key);
    }
  };

  return (
    <div className="h-16 flex-shrink-0 border-t bg-card/95 backdrop-blur-md">
      <nav className="flex h-full items-center justify-around px-2 max-w-md mx-auto">
        {navItems.map(({ key, label, icon: Icon }) => {
          const isActive = activeScreen === key;
          return (
            <button
              key={key}
              onClick={() => handleNavigation(key as ScreenKey)}
              className={cn(
                'flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-xs font-medium outline-none transition-colors w-[60px]',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-6 w-6" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
