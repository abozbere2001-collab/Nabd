
"use client";

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { NabdAlMalaebLogo } from '@/components/icons/NabdAlMalaebLogo';
import { useAuth, useFirestore } from '@/firebase/provider';
import { doc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import type { Favorites } from '@/lib/types';
import { POPULAR_TEAMS, POPULAR_LEAGUES } from '@/lib/popular-data';
import { Star, Check } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FavoriteSelectionScreenProps {
  onOnboardingComplete: () => void;
}

const ItemGrid = ({ items, onSelect, selectedIds, itemType }: { items: any[], onSelect: (item: any) => void, selectedIds: Set<number>, itemType: 'team' | 'league' }) => {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
      {items.map(item => (
        <div 
          key={item.id} 
          className="relative flex flex-col items-center justify-start gap-1 text-center cursor-pointer h-[88px]"
          onClick={() => onSelect(item)}
        >
          <Avatar className="h-14 w-14 border-2 border-transparent data-[state=selected]:border-primary transition-all">
            <AvatarImage src={item.logo} alt={item.name} className={cn(itemType === 'league' && 'object-contain p-1')} />
            <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="text-[11px] font-medium truncate w-full">{item.name}</span>
          {selectedIds.has(item.id) && (
            <div className="absolute top-0 right-0 h-5 w-5 bg-primary rounded-full flex items-center justify-center border-2 border-background">
              <Check className="h-3 w-3 text-primary-foreground" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};


export function FavoriteSelectionScreen({ onOnboardingComplete }: FavoriteSelectionScreenProps) {
  const { user } = useAuth();
  const { db } = useFirestore();
  const [selectedTeams, setSelectedTeams] = useState<Set<number>>(new Set());
  const [selectedLeagues, setSelectedLeagues] = useState<Set<number>>(new Set());

  const handleSelect = useCallback((item: any, type: 'team' | 'league') => {
    const updater = type === 'team' ? setSelectedTeams : setSelectedLeagues;
    updater(prev => {
      const newSet = new Set(prev);
      if (newSet.has(item.id)) {
        newSet.delete(item.id);
      } else {
        newSet.add(item.id);
      }
      return newSet;
    });
  }, []);
  
  const handleContinue = async () => {
    if (!user || !db) {
        onOnboardingComplete(); // Fail gracefully
        return;
    };
    
    const favRef = doc(db, 'users', user.uid, 'favorites', 'data');
    const favoritesData: Partial<Favorites> = {
        userId: user.uid,
        teams: {},
        leagues: {}
    };

    POPULAR_TEAMS.forEach(team => {
        if (selectedTeams.has(team.id) && favoritesData.teams) {
            favoritesData.teams[team.id] = {
                teamId: team.id,
                name: team.name,
                logo: team.logo,
                type: team.type as 'Club' | 'National',
            };
        }
    });

    POPULAR_LEAGUES.forEach(league => {
        if (selectedLeagues.has(league.id) && favoritesData.leagues) {
            favoritesData.leagues[league.id] = {
                leagueId: league.id,
                name: league.name,
                logo: league.logo,
            };
        }
    });

    try {
        await setDoc(favRef, favoritesData, { merge: true });
    } catch (error) {
         const permissionError = new FirestorePermissionError({
            path: favRef.path,
            operation: 'create',
            requestResourceData: favoritesData
        });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
        onOnboardingComplete();
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
        <div className="p-4 flex justify-end">
            <Button variant="ghost" onClick={onOnboardingComplete}>تخطي</Button>
        </div>
        <div className="flex-1 flex flex-col items-center p-4 pt-0 text-center">
            <NabdAlMalaebLogo className="h-16 w-16 mb-4" />
            <h1 className="text-2xl font-bold mb-2 font-headline">خصص تجربتك</h1>
            <p className="text-muted-foreground mb-6">اختر فرقك وبطولاتك المفضلة لتبقى على اطلاع دائم.</p>
        
            <Tabs defaultValue="teams" className="w-full flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="teams">الفرق</TabsTrigger>
                    <TabsTrigger value="leagues">البطولات</TabsTrigger>
                </TabsList>
                <ScrollArea className="flex-1 mt-4">
                    <TabsContent value="teams">
                        <ItemGrid items={POPULAR_TEAMS} onSelect={(item) => handleSelect(item, 'team')} selectedIds={selectedTeams} itemType="team" />
                    </TabsContent>
                    <TabsContent value="leagues">
                        <ItemGrid items={POPULAR_LEAGUES} onSelect={(item) => handleSelect(item, 'league')} selectedIds={selectedLeagues} itemType="league" />
                    </TabsContent>
                </ScrollArea>
            </Tabs>
        </div>
        <div className="p-4 border-t sticky bottom-0 bg-background/90 backdrop-blur-sm">
             <Button onClick={handleContinue} className="w-full" size="lg">متابعة</Button>
        </div>
    </div>
  );
}
