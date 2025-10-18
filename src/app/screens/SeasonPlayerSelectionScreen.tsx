

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth, useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import type { Player, SeasonPrediction } from '@/lib/types';
import { CURRENT_SEASON } from '@/lib/constants';
import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { FootballIcon } from '@/components/icons/FootballIcon';
import { FixedSizeList as List } from 'react-window';
import { hardcodedTranslations } from '@/lib/hardcoded-translations';


interface SeasonPlayerSelectionScreenProps extends ScreenProps {
    leagueId: number;
    leagueName: string;
    teamId: number;
    teamName:string;
}

interface PlayerResponse {
    player: Player;
    statistics: any[];
}


const PlayerListItem = React.memo(({ player, isPredictedTopScorer, onScorerSelect }: { player: Player, isPredictedTopScorer: boolean, onScorerSelect: (playerId: number) => void }) => {
    return (
        <div className="flex items-center p-2 border rounded-lg bg-card">
             <div className="flex-1 flex items-center gap-3">
                <Avatar className="h-10 w-10"><AvatarImage src={player.photo} /></Avatar>
                <div>
                   <p className="font-semibold">{player.name}</p>
                   <p className="text-xs text-muted-foreground">{player.position}</p>
                </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onScorerSelect(player.id)}>
                <FootballIcon className={cn("h-6 w-6 text-muted-foreground transition-colors", isPredictedTopScorer && "text-yellow-400")} />
            </Button>
        </div>
    );
});
PlayerListItem.displayName = 'PlayerListItem';


export function SeasonPlayerSelectionScreen({ navigate, goBack, canGoBack, headerActions, leagueId, leagueName, teamId, teamName }: SeasonPlayerSelectionScreenProps) {
    const { user } = useAuth();
    const { db } = useFirestore();
    const { toast } = useToast();
    const [players, setPlayers] = useState<PlayerResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [predictedTopScorerId, setPredictedTopScorerId] = useState<number | undefined>();

    const privatePredictionDocRef = useMemo(() => {
        if (!user || !db) return null;
        return doc(db, 'seasonPredictions', `${user.uid}_${leagueId}_${CURRENT_SEASON}`);
    }, [user, db, leagueId]);

    const publicPredictionDocRef = useMemo(() => {
        if(!user || !db) return null;
        return doc(db, 'publicSeasonPredictions', `${user.uid}_${leagueId}_${CURRENT_SEASON}`);
    }, [user, db, leagueId]);

    // Fetch players with pagination
    useEffect(() => {
        const fetchAllPlayers = async () => {
            setLoading(true);
            const playerMap = new Map<number, PlayerResponse>();
            let currentPage = 1;
            let totalPages = 1;

            try {
                while (currentPage <= totalPages) {
                    const res = await fetch(`/api/football/players?team=${teamId}&season=${CURRENT_SEASON}&page=${currentPage}`);
                    const data = await res.json();
                    
                    if (data.response) {
                        data.response.forEach((playerResponse: PlayerResponse) => {
                            if (!playerMap.has(playerResponse.player.id)) {
                                const translatedPlayer = {
                                    ...playerResponse,
                                    player: {
                                        ...playerResponse.player,
                                        name: hardcodedTranslations.players[playerResponse.player.id] || playerResponse.player.name
                                    }
                                };
                                playerMap.set(playerResponse.player.id, translatedPlayer);
                            }
                        });
                    }

                    if (data.paging && data.paging.total > currentPage) {
                        totalPages = data.paging.total;
                        currentPage++;
                    } else {
                        break;
                    }
                }
                setPlayers(Array.from(playerMap.values()));
            } catch (e) {
                console.error('Failed to fetch players:', e);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحميل اللاعبين.' });
            } finally {
                setLoading(false);
            }
        };

        fetchAllPlayers();
    }, [teamId, toast]);

    // Fetch existing prediction
    useEffect(() => {
        if (!privatePredictionDocRef) return;
        getDoc(privatePredictionDocRef)
            .then(docSnap => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as SeasonPrediction;
                    setPredictedTopScorerId(data.predictedTopScorerId);
                }
            })
            .catch(error => {
                const permissionError = new FirestorePermissionError({ path: privatePredictionDocRef.path, operation: 'get' });
                errorEmitter.emit('permission-error', permissionError);
            });
    }, [privatePredictionDocRef]);

    const handleScorerSelect = useCallback(async (playerId: number) => {
        const newScorerId = predictedTopScorerId === playerId ? undefined : playerId;
        setPredictedTopScorerId(newScorerId);
        
        if (!privatePredictionDocRef || !publicPredictionDocRef || !user || !db) return;

        try {
            const batch = writeBatch(db);

            const privateData: Partial<SeasonPrediction> = {
                predictedTopScorerId: newScorerId,
                timestamp: new Date(),
            };
            batch.set(privatePredictionDocRef, privateData, { merge: true });

            const publicData: Partial<SeasonPrediction> = {
                userId: user.uid,
                leagueId: leagueId,
                leagueName: leagueName,
                season: CURRENT_SEASON,
                predictedTopScorerId: newScorerId,
                timestamp: new Date(),
            };
            batch.set(publicPredictionDocRef, publicData, { merge: true });

            await batch.commit();
        } catch (error) {
             const permissionError = new FirestorePermissionError({
                path: `batch write to ${privatePredictionDocRef.path} and ${publicPredictionDocRef.path}`,
                operation: 'write',
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    }, [predictedTopScorerId, privatePredictionDocRef, publicPredictionDocRef, user, db, leagueId, leagueName]);


    const Row = ({ index, style }: { index: number, style: React.CSSProperties }) => {
        const playerResponse = players[index];
        if (!playerResponse) return null;
        const { player } = playerResponse;

        return (
             <div style={style} className="px-4 py-1">
                <PlayerListItem
                    player={player}
                    isPredictedTopScorer={predictedTopScorerId === player.id}
                    onScorerSelect={handleScorerSelect}
                />
            </div>
        )
    };


    if (loading) {
        return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title={`اختيار هداف من ${teamName}`} onBack={goBack} canGoBack={true} />
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title={`اختيار هداف من ${teamName}`} onBack={goBack} canGoBack={true} />
             <div className='p-4 text-center text-sm text-muted-foreground border-b'>
                <p>اختر الهداف المتوقع للدوري بالضغط على أيقونة الكرة.</p>
            </div>
            <div className="flex-1 overflow-y-auto">
                {players.length > 0 ? (
                     <List
                        height={window.innerHeight - 150} // Adjust height based on your layout
                        itemCount={players.length}
                        itemSize={76} // The height of each PlayerListItem + padding
                        width="100%"
                    >
                        {Row}
                    </List>
                ) : (
                    <p className="text-center pt-8 text-muted-foreground">لا يوجد لاعبون متاحون لهذا الفريق.</p>
                )}
            </div>
        </div>
    );
}
