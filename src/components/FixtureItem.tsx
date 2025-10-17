
"use client";

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { cn } from '@/lib/utils';
import { CommentsButton } from '@/components/CommentsButton';
import type { Fixture as FixtureType, MatchDetails } from '@/lib/types';
import { useAdmin } from '@/firebase/provider';
import { LiveMatchStatus } from './LiveMatchStatus';

// Fixture Item Component
export const FixtureItem = React.memo(({ fixture, navigate, commentsEnabled, customStatus }: { fixture: FixtureType, navigate: ScreenProps['navigate'], commentsEnabled?: boolean, customStatus?: string | null }) => {
    const { isAdmin } = useAdmin();
    const hasCommentsFeature = commentsEnabled || isAdmin;

    return (
      <div 
        key={fixture.fixture.id} 
        className="relative rounded-lg bg-card border text-sm transition-all duration-300 flex flex-col justify-between"
      >
        <div 
            className="flex-1 p-2 cursor-pointer"
            onClick={() => navigate('MatchDetails', { fixtureId: fixture.fixture.id, fixture })}
        >
         <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
            {/* Home Team (Right) */}
            <div className="flex items-center gap-2 justify-end truncate">
                <span className="font-semibold text-[10px] truncate">{fixture.teams.home.name}</span>
                <Avatar className={'h-4 w-4'}><AvatarImage src={fixture.teams.home.logo} alt={fixture.teams.home.name} /></Avatar>
            </div>

            {/* Match Status (Center) */}
            <div className="flex flex-col items-center justify-center min-w-[70px] text-center">
                <LiveMatchStatus fixture={fixture} customStatus={customStatus} />
            </div>

            {/* Away Team (Left) */}
            <div className="flex items-center gap-2 justify-start truncate">
                <Avatar className={'h-4 w-4'}><AvatarImage src={fixture.teams.away.logo} alt={fixture.teams.away.name} /></Avatar>
                <span className="font-semibold text-[10px] truncate">{fixture.teams.away.name}</span>
            </div>
         </div>
        </div>
         
         <div className="absolute top-1 right-1 flex items-center gap-1">
            {hasCommentsFeature && (
                <CommentsButton 
                  matchId={fixture.fixture.id} 
                  navigate={navigate} 
                  commentsEnabled={commentsEnabled}
                  size="sm"
                />
            )}
         </div>
      </div>
    );
});
FixtureItem.displayName = 'FixtureItem';
