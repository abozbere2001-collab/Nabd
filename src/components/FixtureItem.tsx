"use client";

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { CommentsButton } from '@/components/CommentsButton';
import type { Fixture as FixtureType } from '@/lib/types';
import { useAdmin } from '@/firebase/provider';
import { LiveMatchStatus } from './LiveMatchStatus';

export const FixtureItem = React.memo(({ fixture, navigate, commentsEnabled }: { fixture: FixtureType, navigate: ScreenProps['navigate'], commentsEnabled?: boolean }) => {
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
         <main className="grid grid-cols-[1fr_auto_1fr] items-center justify-between gap-2">
            {/* Away Team */}
            <div className="flex items-center gap-2 truncate justify-start text-left">
                <Avatar className={'h-6 w-6'}>
                    <AvatarImage src={fixture.teams.away.logo} alt={fixture.teams.away.name} />
                    <AvatarFallback>{fixture.teams.away.name?.charAt(0) || ''}</AvatarFallback>
                </Avatar>
                <span className="font-semibold text-xs truncate">{fixture.teams.away.name}</span>
            </div>

            {/* Status */}
            <div className="flex flex-col items-center justify-center min-w-[70px] text-center">
                <LiveMatchStatus fixture={fixture} />
            </div>

            {/* Home Team */}
            <div className="flex items-center gap-2 truncate justify-end text-right">
                <Avatar className={'h-6 w-6'}>
                    <AvatarImage src={fixture.teams.home.logo} alt={fixture.teams.home.name} />
                    <AvatarFallback>{fixture.teams.home.name?.charAt(0) || ''}</AvatarFallback>
                </Avatar>
                <span className="font-semibold text-xs truncate">{fixture.teams.home.name}</span>
            </div>
         </main>
        </div>

         <div className="absolute top-1 left-1 flex items-center gap-1">
            {hasCommentsFeature && (
                <CommentsButton
                  matchId={fixture.fixture.id}
                  navigate={navigate}
                  commentsEnabled={commentsEnabled}
                  size="icon"
                />
            )}
         </div>
      </div>
    );
});
FixtureItem.displayName = 'FixtureItem';
