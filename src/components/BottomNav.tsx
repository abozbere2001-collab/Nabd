
"use client";
import { Star, Newspaper, BarChart2, Tv, MoreHorizontal, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScreenKey } from '@/app/page';

const navItems: { key: ScreenKey; label: string; icon: React.ElementType }[] = [
  { key: 'Matches', label: 'المباريات', icon: Shield },
  { key: 'Competitions', label: 'اختياراتي', icon: Star },
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
  
  const mainTabs: ScreenKey[] = ['Matches', 'Competitions', 'News', 'GlobalPredictions', 'Settings', 'Iraq'];
  const isMainTabActive = mainTabs.includes(activeScreen);

  if (!isMainTabActive) return null;

  return (
    <div className="h-20 flex-shrink-0 border-t bg-card/80 backdrop-blur-md">
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
