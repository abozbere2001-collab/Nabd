
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { Fixture, Standing, LineupData, MatchEvent, MatchStatistics, PlayerWithStats, Player as PlayerType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shirt, Square, Clock, Loader2, Users, BarChart, ShieldCheck, ArrowUp, ArrowDown, Pencil } from 'lucide-react';
import { FootballIcon } from '@/components/icons/FootballIcon';
import { Progress } from '@/components/ui/progress';
import { LiveMatchStatus } from '@/components/LiveMatchStatus';
import { CURRENT_SEASON } from '@/lib/constants';
import { OddsTab } from '@/components/OddsTab';
import { useAdmin, useFirestore } from '@/firebase/provider';
import { RenameDialog } from '@/components/RenameDialog';
import { doc, setDoc, deleteDoc, getDocs, collection, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Button } from '@/components/ui/button';
import { hardcodedTranslations } from '@/lib/hardcoded-translations';

type RenameType = 'player' | 'coach' | 'team' | 'league' | 'continent' | 'country' | 'status';


const PlayerCard = ({ player, navigate, onRename, isAdmin }: { player: PlayerType, navigate: ScreenProps['navigate'], onRename: () => void, isAdmin: boolean }) => {
    const fallbackImage = "https://media.api-sports.io/football/players/0.png";
    const playerImage = player.photo && player.photo.trim() !== '' ? player.photo : fallbackImage;

    const rating = player.rating && !isNaN(parseFloat(player.rating))
        ? parseFloat(player.rating).toFixed(1)
        : null;

    const getRatingColor = (r: string | null) => {
        if (!r) return 'bg-gray-500';
        const val = parseFloat(r);
        if (val >= 8) return 'bg-green-600';
        if (val >= 7) return 'bg-yellow-600';
        return 'bg-red-600';
    };

    return (
        <div className="relative flex flex-col items-center cursor-pointer" onClick={() => player.id && navigate('PlayerDetails', { playerId: player.id })}>
            <div className="relative w-12 h-12">
                <Avatar className="rounded-full w-12 h-12 object-cover border-2 border-white/50">
                    <AvatarImage src={playerImage} alt={player?.name || "Player"} />
                    <AvatarFallback>{player?.name?.charAt(0) || 'P'}</AvatarFallback>
                </Avatar>
                {isAdmin && (
                    <Button variant="ghost" size="icon" className="absolute -bottom-2 -left-2 h-6 w-6 bg-background/80 hover:bg-background rounded-full" onClick={(e) => {e.stopPropagation(); onRename();}}>
                        <Pencil className="h-3 w-3" />
                    </Button>
                )}
                {player.number && (
                    <div className="absolute -top-1 -left-1 bg-gray-800 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background">
                        {player.number}
                    </div>
                )}
                {rating && (
                    <div className={cn(
                        `absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background`,
                        getRatingColor(rating)
                    )}>
                        {rating}
                    </div>
                )}
            </div>
            <span className="mt-1 text-[10px] font-semibold text-center truncate w-16 text-white">{player?.name || "غير معروف"}</span>
        </div>
    );
};


const MatchHeaderCard = ({ fixture, navigate, customStatus }: { fixture: Fixture, navigate: ScreenProps['navigate'], customStatus: string | null }) => {
    return (
        <Card className="mb-4 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4">
                <div className="flex justify-between items-center text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('CompetitionDetails', { leagueId: fixture.league.id })}>
                        <Avatar className="h-5 w-5"><AvatarImage src={fixture.league.logo} /></Avatar>
                        <span className="text-[10px]">{fixture.league.name}</span>
                    </div>
                    <span className="text-[10px]">{format(new Date(fixture.fixture.date), 'd MMMM yyyy', { locale: ar })}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col items-center gap-2 flex-1 truncate cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: fixture.teams.away.id })}>
                         <Avatar className="h-10 w-10 border-2 border-primary/50"><AvatarImage src={fixture.teams.away.logo} /></Avatar>
                        <span className="font-bold text-sm text-center truncate w-full">{fixture.teams.away.name}</span>
                    </div>
                     <div className="relative flex flex-col items-center justify-center min-w-[120px] text-center">
                        <LiveMatchStatus fixture={fixture} large customStatus={customStatus} />
                    </div>
                    <div className="flex flex-col items-center gap-2 flex-1 justify-end truncate cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: fixture.teams.home.id })}>
                        <Avatar className="h-10 w-10 border-2 border-primary/50"><AvatarImage src={fixture.teams.home.logo} /></Avatar>
                        <span className="font-bold text-sm text-center truncate w-full">{fixture.teams.home.name}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const DetailsTab = ({ fixture, statistics, loading }: { fixture: Fixture; statistics: MatchStatistics[] | null; loading: boolean }) => {
    const homeStats = statistics?.find(s => s.team.id === fixture.teams.home.id)?.statistics || [];
    const awayStats = statistics?.find(s => s.team.id === fixture.teams.away.id)?.statistics || [];

    const findStat = (stats: any[], type: string) => stats.find(s => s.type === type)?.value ?? '0';

    const statMapping: { labelKey: string; type: string; isProgress?: boolean }[] = [
      { labelKey: "الاستحواذ", type: "Ball Possession", isProgress: true },
      { labelKey: "التسديدات", type: "Total Shots" },
      { labelKey: "تسديدات على المرمى", type: "Shots on Goal" },
      { labelKey: "تسديدات خارج المرمى", type: "Shots off Goal" },
      { labelKey: "تسديدات محجوبة", type: "Blocked Shots"},
      { labelKey: "الأخطاء", type: "Fouls" },
      { labelKey: "البطاقات الصفراء", type: "Yellow Cards" },
      { labelKey: "البطاقات الحمراء", type: "Red Cards" },
      { labelKey: "الركنيات", type: "Corner Kicks" },
      { labelKey: "التسلل", type: "Offsides" },
    ];

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="p-4 text-sm text-right">
                    <div className="flex justify-between py-2 border-b">
                        <span className="font-semibold">{fixture.fixture.venue.name || "غير محدد"}</span>
                        <span className="text-muted-foreground">الملعب</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                        <span className="font-semibold">{fixture.league.round}</span>
                        <span className="text-muted-foreground">الجولة</span>
                    </div>
                    <div className="flex justify-between py-2">
                        <span className="font-semibold">{fixture.fixture.status.long}</span>
                        <span className="text-muted-foreground">الحالة</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <h3 className="font-bold text-center">إحصائيات المباراة</h3>
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : statistics && statistics.length > 0 ? (
                        statMapping.map(stat => {
                            const homeValueRaw = findStat(homeStats, stat.type);
                            const awayValueRaw = findStat(awayStats, stat.type);
                            
                            if (stat.isProgress) {
                                const homeVal = parseInt(String(homeValueRaw).replace('%','')) || 0;
                                const awayVal = parseInt(String(awayValueRaw).replace('%','')) || 0;
                                return (
                                    <div key={stat.type} className="space-y-2">
                                        <div className="flex justify-between items-center text-xs font-bold">
                                            <span>{awayValueRaw}</span>
                                            <span className="text-muted-foreground">{stat.labelKey}</span>
                                            <span>{homeValueRaw}</span>
                                        </div>
                                        <div className="flex items-center gap-1" dir="ltr">
                                            <Progress value={awayVal} indicatorClassName="bg-accent rounded-r-full" className="rounded-r-full" style={{transform: 'rotate(180deg)'}}/>
                                            <Progress value={homeVal} indicatorClassName="bg-primary rounded-l-full" className="rounded-l-full"/>
                                        </div>
                                    </div>
                                )
                            }
                            return (
                                <div key={stat.type} className="flex justify-between items-center text-sm font-bold">
                                    <span>{awayValueRaw}</span>
                                    <span className="text-muted-foreground font-normal">{stat.labelKey}</span>
                                    <span>{homeValueRaw}</span>
                                </div>
                            )
                        })
                    ) : (
                       <p className="text-center text-muted-foreground p-4">الإحصائيات غير متاحة لهذه المباراة.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};


const TimelineTabContent = ({ events, homeTeam, awayTeam, highlightsOnly }: { events: MatchEvent[] | null, homeTeam: Fixture['teams']['home'], awayTeam: Fixture['teams']['away'], highlightsOnly: boolean }) => {
    if (events === null) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    
    const filteredEvents = React.useMemo(() => {
        if (!events) return [];
        if (!highlightsOnly) return events;
        return events.filter(e => e.type === 'Goal' || (e.type === 'Card' && e.detail.includes('Red')));
    }, [events, highlightsOnly]);

    if (filteredEvents.length === 0) {
        const message = highlightsOnly ? "لا توجد أهداف أو بطاقات حمراء." : "لا توجد أحداث رئيسية في المباراة بعد.";
        return <p className="text-center text-muted-foreground p-8">{message}</p>;
    }
    
    const sortedEvents = [...filteredEvents].sort((a, b) => b.time.elapsed - a.time.elapsed);

    const getEventIcon = (event: MatchEvent) => {
        if (event.type === 'Goal') return <FootballIcon className="w-5 h-5 text-green-500" />;
        if (event.type === 'Card' && event.detail.includes('Yellow')) return <Square className="w-5 h-5 text-yellow-400 fill-current" />;
        if (event.type === 'Card' && event.detail.includes('Red')) return <Square className="w-5 h-5 text-red-500 fill-current" />;
        if (event.type === 'subst') return <Users className="w-4 h-4 text-blue-500" />;
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    };

    return (
        <div className="space-y-6 pt-4">
             <div className="flex justify-between items-center px-4">
                <div className="flex items-center gap-2">
                    <span className="font-bold">{homeTeam.name}</span>
                    <Avatar className="h-8 w-8"><AvatarImage src={homeTeam.logo} /></Avatar>
                </div>
                 <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8"><AvatarImage src={awayTeam.logo} /></Avatar>
                    <span className="font-bold">{awayTeam.name}</span>
                </div>
            </div>
            
            <div className="relative px-2">
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-border -translate-x-1/2"></div>
                {sortedEvents.map((event, index) => {
                    const isHomeEvent = event.team.id === homeTeam.id;
                    const playerOut = event.player;
                    const playerIn = event.assist;

                    return (
                        <div key={`${event.time.elapsed}-${event.player.name}-${index}`} className={cn("relative flex my-4 items-center", isHomeEvent ? "flex-row" : "flex-row-reverse")}>
                           <div className="flex-1 px-4">
                                <div className={cn("flex items-center gap-3 w-full", isHomeEvent ? "flex-row text-left" : "flex-row-reverse text-right")}>
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background flex-shrink-0">
                                        {getEventIcon(event)}
                                    </div>
                                    <div className="flex-1 text-sm min-w-0">
                                        {event.type === 'subst' && event.assist.name ? (
                                            <div className="flex flex-col gap-1 text-xs">
                                                <div className='flex items-center gap-1 font-semibold text-green-500'><ArrowUp className="h-3 w-3"/><span>{playerIn.name}</span></div>
                                                <div className='flex items-center gap-1 font-semibold text-red-500'><ArrowDown className="h-3 w-3"/><span>{playerOut.name}</span></div>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="font-semibold truncate">{event.player.name}</p>
                                                <p className="text-xs text-muted-foreground truncate">{event.detail}</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                           
                            <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 z-10 bg-background border rounded-full h-8 w-8 flex items-center justify-center font-bold text-xs">
                                {event.time.elapsed}'
                            </div>
                            
                            <div className="flex-1" />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const TimelineTab = ({ events, homeTeam, awayTeam }: { events: MatchEvent[] | null; homeTeam: Fixture['teams']['home'], awayTeam: Fixture['teams']['away'] }) => {
    return (
        <Tabs defaultValue="highlights" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="highlights">الأبرز</TabsTrigger>
                <TabsTrigger value="all">كل الأحداث</TabsTrigger>
            </TabsList>
            <TabsContent value="highlights">
                <TimelineTabContent events={events} homeTeam={homeTeam} awayTeam={awayTeam} highlightsOnly={true} />
            </TabsContent>
            <TabsContent value="all">
                <TimelineTabContent events={events} homeTeam={homeTeam} awayTeam={awayTeam} highlightsOnly={false} />
            </TabsContent>
        </Tabs>
    );
}

const LineupsTab = ({ lineups, events, navigate, isAdmin, onRename, homeTeamId, awayTeamId }: { lineups: LineupData[] | null; events: MatchEvent[] | null; navigate: ScreenProps['navigate'], isAdmin: boolean, onRename: (type: RenameType, id: number, name: string, originalName: string) => void, homeTeamId: number, awayTeamId: number }) => {
    if (lineups === null) {
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }
    
    if (lineups.length < 2) {
        return <p className="text-center text-muted-foreground p-8">التشكيلات غير متاحة حاليًا.</p>;
    }
    
    const home = lineups.find(l => l.team.id === homeTeamId);
    const away = lineups.find(l => l.team.id === awayTeamId);

    if (!home || !away) {
         return <p className="text-center text-muted-foreground p-8">خطأ في بيانات التشكيلة.</p>;
    }

    const [activeTeamTab, setActiveTeamTab] = useState<'home' | 'away'>('home');
    
    const activeLineup = activeTeamTab === 'home' ? home : away;
    
    const substitutionEvents = events?.filter(e => e.type === 'subst' && e.team.id === activeLineup.team.id) || [];
    
    const renderPitch = (lineup: LineupData) => {
        const formationGrid: { [key: number]: PlayerWithStats[] } = {};
        const ungriddedPlayers: PlayerWithStats[] = [];

        lineup.startXI.forEach(p => {
            if (p.player.grid && typeof p.player.grid === 'string') {
                const [row] = p.player.grid.split(':').map(Number);
                if (!formationGrid[row]) formationGrid[row] = [];
                formationGrid[row].push(p);
            } else {
                ungriddedPlayers.push(p);
            }
        });

        Object.keys(formationGrid).forEach(rowKey => {
            const row = Number(rowKey);
            formationGrid[row].sort((a, b) => {
                const colA = Number(a.player.grid?.split(':')[1] || 0);
                const colB = Number(b.player.grid?.split(':')[1] || 0);
                return colA - colB;
            });
        });
        
        const sortedRows = Object.keys(formationGrid).map(Number).sort((a, b) => a - b);

        return (
             <div className="relative w-full max-w-sm mx-auto aspect-[3/4] bg-green-700 bg-cover bg-center rounded-lg overflow-hidden border-4 border-green-900/50 flex flex-col-reverse justify-around p-2" style={{backgroundImage: "url('/pitch-vertical.svg')"}}>
                {sortedRows.map(row => (
                    <div key={row} className="flex justify-around items-center">
                        {formationGrid[row]?.map(p => <PlayerCard key={p.player.id || p.player.name} player={p.player} navigate={navigate} isAdmin={isAdmin} onRename={() => onRename('player', p.player.id, p.player.name, p.player.name)} />)}
                    </div>
                ))}
                 {ungriddedPlayers.length > 0 && (
                    <div className="flex justify-around items-center">
                        {ungriddedPlayers.map(p => <PlayerCard key={p.player.id || p.player.name} player={p.player} navigate={navigate} isAdmin={isAdmin} onRename={() => onRename('player', p.player.id, p.player.name, p.player.name)} />)}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <Tabs value={activeTeamTab} onValueChange={(val) => setActiveTeamTab(val as 'home' | 'away')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="home">{home.team.name}</TabsTrigger>
                    <TabsTrigger value="away">{away.team.name}</TabsTrigger>
                </TabsList>
            </Tabs>
            
            <div className="font-bold text-center text-muted-foreground text-sm">التشكيلة: {activeLineup.formation}</div>
            
            {renderPitch(activeLineup)}
            
            <Card>
                <CardContent className="p-3 text-center">
                    <h3 className="font-bold text-sm mb-2">المدرب</h3>
                    <div className="relative inline-flex flex-col items-center gap-1">
                        <Avatar className="h-12 w-12">
                            <AvatarImage src={activeLineup.coach.photo} />
                            <AvatarFallback>{activeLineup.coach.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-xs">{activeLineup.coach.name}</span>
                        {isAdmin && (
                            <Button variant="ghost" size="icon" className="absolute -top-1 -right-8 h-6 w-6" onClick={(e) => {e.stopPropagation(); onRename('coach', activeLineup.coach.id, activeLineup.coach.name, activeLineup.coach.name);}}>
                                <Pencil className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {substitutionEvents.length > 0 && (
                <div className='bg-card p-2 rounded-lg'>
                    <h3 className="text-base font-bold text-center p-2">التبديلات</h3>
                    <div className="space-y-1">
                        {substitutionEvents.map((event, index) => {
                            const playerIn = event.assist;
                            const playerOut = event.player;
                            return (
                                <div key={index} className="flex items-center justify-between text-xs p-1">
                                    <div className='font-bold w-10 text-center'>{event.time.elapsed}'</div>
                                    <div className='flex-1 flex items-center justify-end gap-1 font-semibold text-red-500'>
                                        <span>{playerOut.name}</span>
                                        <ArrowDown className="h-3 w-3"/>
                                    </div>
                                    <div className='flex-1 flex items-center justify-start gap-1 font-semibold text-green-500 ml-4'>
                                        <ArrowUp className="h-3 w-3"/>
                                        <span>{playerIn.name}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            <div className="pt-4">
                <h3 className="text-center text-base font-bold mb-2">الاحتياط</h3>
                <div className="space-y-1">
                    {activeLineup.substitutes.map(p => (
                         <div key={p.player.id || p.player.name} className="p-2 rounded-lg bg-card cursor-pointer" onClick={() => p.player.id && navigate('PlayerDetails', { playerId: p.player.id })}>
                            <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={p.player.photo} />
                                    <AvatarFallback>{p.player.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 text-right">
                                    <p className="font-semibold text-sm">{p.player.name}</p>
                                    <p className="text-xs text-muted-foreground">{p.player.position}</p>
                                </div>
                                {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => {e.stopPropagation(); onRename('player', p.player.id, p.player.name, p.player.name)}}><Pencil className="h-4 w-4" /></Button>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


const StandingsTab = ({ standings, fixture, navigate, loading }: { standings: Standing[] | null, fixture: Fixture, navigate: ScreenProps['navigate'], loading: boolean }) => {
    if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    if (!standings || standings.length === 0) return <p className="text-center text-muted-foreground p-8">جدول الترتيب غير متاح حاليًا.</p>;
    
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead className="w-1/2 text-right">الفريق</TableHead>
                    <TableHead className="text-center">لعب</TableHead>
                    <TableHead className="text-center">ف/ت/خ</TableHead>
                    <TableHead className="text-center">نقاط</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {standings.map((s) => {
                    const isRelevantTeam = s.team.id === fixture.teams.home.id || s.team.id === fixture.teams.away.id;
                    return (
                        <TableRow key={s.team.id} className={cn(isRelevantTeam && "bg-primary/10", "cursor-pointer")} onClick={() => navigate('TeamDetails', { teamId: s.team.id })}>
                            <TableCell className="font-bold">{s.rank}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2 justify-end">
                                    <span className="font-semibold truncate">{s.team.name}</span>
                                    <Avatar className="h-6 w-6"><AvatarImage src={s.team.logo} /></Avatar>
                                </div>
                            </TableCell>
                            <TableCell className="text-center">{s.all.played}</TableCell>
                            <TableCell className="text-center text-xs">{`${s.all.win}/${s.all.draw}/${s.all.lose}`}</TableCell>
                            <TableCell className="text-center font-bold">{s.points}</TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
};

const mergePlayerData = (baseLineups: LineupData[], detailedPlayers: { player: Player, statistics: any[] }[]): LineupData[] => {
    if (!detailedPlayers || detailedPlayers.length === 0 || !baseLineups || baseLineups.length === 0) {
        return baseLineups || [];
    }

    const playersMap = new Map<number, { player: Player, statistics: any[] }>();
    detailedPlayers.forEach(p => {
        if (p.player.id) {
            playersMap.set(p.player.id, p);
        }
    });

    const updatePlayerInList = (playerList: PlayerWithStats[]): PlayerWithStats[] => {
        if (!playerList) return [];
        return playerList.map(pWithStats => {
            if (!pWithStats || !pWithStats.player) return pWithStats;

            const lineupPlayer = pWithStats.player;
            if (lineupPlayer.id && playersMap.has(lineupPlayer.id)) {
                const detailedPlayerInfo = playersMap.get(lineupPlayer.id)!;
                const rating = detailedPlayerInfo.statistics?.[0]?.games?.rating;
                
                const mergedPlayer: PlayerType = {
                    ...lineupPlayer,
                    name: detailedPlayerInfo.player.name || lineupPlayer.name,
                    photo: detailedPlayerInfo.player.photo || lineupPlayer.photo,
                    rating: rating || lineupPlayer.rating,
                };
                return { ...pWithStats, player: mergedPlayer };
            }
            return pWithStats;
        });
    };

    return baseLineups.map(lineup => ({
        ...lineup,
        startXI: updatePlayerInList(lineup.startXI),
        substitutes: updatePlayerInList(lineup.substitutes)
    }));
};


export function MatchDetailScreen({ navigate, goBack, canGoBack, fixtureId, fixture: initialFixture }: ScreenProps & { fixtureId: number, fixture?: Fixture }) {
    const { isAdmin, db } = useAdmin();
    const { toast } = useToast();
    
    // State for raw data from API, separating data for each tab
    const [fixture, setFixture] = useState<Fixture | null>(initialFixture || null);
    const [lineups, setLineups] = useState<LineupData[] | null>(null);
    const [events, setEvents] = useState<MatchEvent[] | null>(null);
    const [statistics, setStatistics] = useState<MatchStatistics[] | null>(null);
    const [standings, setStandings] = useState<Standing[] | null>(null);
    
    const [activeTab, setActiveTab] = useState('lineups');
    const [loadingTabs, setLoadingTabs] = useState({
        details: false,
        odds: false,
        standings: false,
        events: false,
        lineups: false,
    });
    
    // State for custom data
    const [customNames, setCustomNames] = useState<{ [key: string]: Map<number, string> } | null>(null);
    const [customStatus, setCustomStatus] = useState<string | null>(null);
    const [renameItem, setRenameItem] = useState<{ type: RenameType, id: number, name: string, originalName?: string } | null>(null);

    // Initial fixture data fetch
    useEffect(() => {
        const fetchFixture = async () => {
            if (!fixture) { // Only fetch if not passed via props
                try {
                    const res = await fetch(`/api/football/fixtures?id=${fixtureId}`);
                    if (res.ok) {
                        const data = await res.json();
                        setFixture(data.response?.[0] || null);
                    }
                } catch (e) { console.error(e); }
            }
        };
        fetchFixture();
    }, [fixtureId, fixture]);


    const fetchTabData = useCallback(async (tab: string) => {
        if (!fixtureId) return;

        setLoadingTabs(prev => ({ ...prev, [tab]: true }));
        try {
            let res;
            switch(tab) {
                case 'lineups':
                     const [lineupsRes, playersRes] = await Promise.all([
                        fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
                        fetch(`/api/football/fixtures/players?fixture=${fixtureId}`),
                    ]);
                    if (lineupsRes.ok && playersRes.ok) {
                        const lineupsData = await lineupsRes.json();
                        const playersData = await playersRes.json();
                        const detailedPlayers = playersData.response ? playersData.response.flatMap((team: any) => team.players) : [];
                        const mergedLineups = mergePlayerData(lineupsData.response, detailedPlayers);
                        setLineups(mergedLineups.length > 0 ? mergedLineups : []);
                    }
                    break;
                case 'events':
                    res = await fetch(`/api/football/fixtures/events?fixture=${fixtureId}`);
                    if (res.ok) {
                        const data = await res.json();
                        setEvents(data.response || []);
                    }
                    break;
                case 'details':
                    res = await fetch(`/api/football/fixtures/statistics?fixture=${fixtureId}`);
                    if (res.ok) {
                        const data = await res.json();
                        setStatistics(data.response || []);
                    }
                    break;
                case 'standings':
                     if (fixture?.league?.id) {
                        res = await fetch(`/api/football/standings?league=${fixture.league.id}&season=${fixture.league.season || CURRENT_SEASON}`);
                        if (res.ok) {
                            const data = await res.json();
                            setStandings(data.response?.[0]?.league?.standings?.[0] || []);
                        }
                    } else {
                        setStandings([]);
                    }
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.error(`Failed to fetch ${tab}:`, error);
        } finally {
            setLoadingTabs(prev => ({ ...prev, [tab]: false }));
        }

    }, [fixtureId, fixture]);
    
    // Fetch data for the default tab
    useEffect(() => {
        if (fixture) {
             fetchTabData(activeTab);
        }
    }, [fixture, fetchTabData, activeTab]);

    const handleTabChange = (newTab: string) => {
        setActiveTab(newTab);
        // Fetch data only if it hasn't been fetched yet
        if (newTab === 'lineups' && lineups === null) fetchTabData(newTab);
        else if (newTab === 'events' && events === null) fetchTabData(newTab);
        else if (newTab === 'details' && statistics === null) fetchTabData(newTab);
        else if (newTab === 'standings' && standings === null) fetchTabData(newTab);
    };

    // Fetch all custom names once
    useEffect(() => {
        if (!db) {
            setCustomNames({});
            return;
        }
        const fetchCustomNames = async () => {
            try {
                const [teamsSnapshot, leaguesSnapshot, playersSnapshot, coachSnapshot] = await Promise.all([
                    getDocs(collection(db, 'teamCustomizations')),
                    getDocs(collection(db, 'leagueCustomizations')),
                    getDocs(collection(db, 'playerCustomizations')),
                    getDocs(collection(db, 'coachCustomizations')),
                ]);

                const names: { [key: string]: Map<number, string> } = { team: new Map(), league: new Map(), player: new Map(), coach: new Map() };
                teamsSnapshot.forEach(doc => names.team.set(Number(doc.id), doc.data().customName));
                leaguesSnapshot.forEach(doc => names.league.set(Number(doc.id), doc.data().customName));
                playersSnapshot.forEach(doc => names.player.set(Number(doc.id), doc.data().customName));
                coachSnapshot.forEach(doc => names.coach.set(Number(doc.id), doc.data().customName));
                setCustomNames(names);
            } catch {
                setCustomNames({});
            }
        };
        fetchCustomNames();
    }, [db]);


    // Listen for custom match status
    useEffect(() => {
        if (!db || !fixtureId || !isAdmin) return;
        const customStatusRef = doc(db, 'matchCustomizations', String(fixtureId));
        const unsub = onSnapshot(customStatusRef, (docSnap) => {
            setCustomStatus(docSnap.exists() ? docSnap.data().customStatus : null);
        }, (error) => {
            console.error("Error listening to custom status:", error);
        });
        return () => unsub();
    }, [db, fixtureId, isAdmin]);

    // Memoized function to apply custom names
    const getDisplayName = useCallback((type: 'team' | 'player' | 'league' | 'coach', id: number | undefined, defaultName: string) => {
      if (!id || !customNames) return defaultName;
      const firestoreMap = customNames[type];
      const customName = firestoreMap?.get(id);
      if (customName) return customName;

      if(type === 'team' || type === 'league' || type === 'player') {
          const key = `${type}s` as 'teams' | 'leagues' | 'players';
          const hardcodedName = hardcodedTranslations[key]?.[id];
          if(hardcodedName) return hardcodedName;
      }
      
      return defaultName;
    }, [customNames]);

    // Memoized processed data
    const processedFixture = useMemo(() => {
        if (!fixture) return null;
        return {
            ...fixture,
            league: { ...fixture.league, name: getDisplayName('league', fixture.league.id, fixture.league.name) },
            teams: {
                home: { ...fixture.teams.home, name: getDisplayName('team', fixture.teams.home.id, fixture.teams.home.name) },
                away: { ...fixture.teams.away, name: getDisplayName('team', fixture.teams.away.id, fixture.teams.away.name) },
            },
        };
    }, [fixture, getDisplayName]);

    const processedLineups = useMemo(() => {
        if (!lineups) return null;
        return lineups.map(lineup => ({
            ...lineup,
            team: { ...lineup.team, name: getDisplayName('team', lineup.team.id, lineup.team.name) },
            coach: { ...lineup.coach, name: getDisplayName('coach', lineup.coach.id, lineup.coach.name) },
            startXI: lineup.startXI.map(p => ({ ...p, player: { ...p.player, name: getDisplayName('player', p.player.id, p.player.name) } })),
            substitutes: lineup.substitutes.map(p => ({ ...p, player: { ...p.player, name: getDisplayName('player', p.player.id, p.player.name) } })),
        }));
    }, [lineups, getDisplayName]);

    const processedEvents = useMemo(() => {
        if (!events) return null;
        return events.map(event => ({
            ...event,
            player: { ...event.player, name: getDisplayName('player', event.player.id, event.player.name) },
            assist: { ...event.assist, name: getDisplayName('player', event.assist.id, event.assist.name || '') },
        }));
    }, [events, getDisplayName]);

    const processedStandings = useMemo(() => {
        if (!standings) return null;
        return standings.map(s => ({
            ...s,
            team: { ...s.team, name: getDisplayName('team', s.team.id, s.team.name) },
        }));
    }, [standings, getDisplayName]);


    const handleOpenRename = (type: RenameType, id: number, name: string, originalName?: string) => {
        setRenameItem({ type, id, name, originalName: originalName || name });
    };

    const handleSaveRename = (type: RenameType, id: string | number, newName: string) => {
        if (!renameItem || !db) return;

        const { originalName } = renameItem;
        const collectionName = `${type}Customizations`;
        const docRef = doc(db, collectionName, String(id));
        
        const data = { customName: newName };
        if(newName && newName !== originalName) {
            setDoc(docRef, data)
                .then(() => toast({ title: "نجاح", description: `تم تحديث الاسم.` }))
                .catch(serverError => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'create', requestResourceData: data })));
        } else {
             deleteDoc(docRef)
                .then(() => toast({ title: "نجاح", description: `تمت إزالة الاسم المخصص.` }))
                .catch(serverError => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' })));
        }
        setCustomNames(prev => {
            if (!prev) return null;
            const newMap = new Map(prev[type]);
            if (newName && newName !== originalName) {
                newMap.set(Number(id), newName);
            } else {
                newMap.delete(Number(id));
            }
            return {...prev, [type]: newMap};
        })
        setRenameItem(null);
    };

     const handleSaveStatus = (newName: string) => {
        if(!db) return;
        const docRef = doc(db, 'matchCustomizations', String(fixtureId));
        if(newName && newName.trim().length > 0) {
             setDoc(docRef, { customStatus: newName }, { merge: true })
             .catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'create', requestResourceData: { customStatus: newName } })));
        } else {
             deleteDoc(docRef)
             .catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' })));
        }
        setRenameItem(null);
    };


    if (!processedFixture) {
        return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title={'تفاصيل المباراة'} onBack={goBack} canGoBack={canGoBack} />
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            </div>
        );
    }
    
    const secondaryActions = (
        <div className="flex items-center gap-1">
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRenameItem({ type: 'status', id: fixtureId, name: customStatus || '', originalName: '' })}
            >
              <Pencil className="h-5 w-5" />
            </Button>
          )}
        </div>
    );

    return (
        <div className="flex h-full flex-col bg-background">
             <ScreenHeader 
                title={processedFixture.league.name} 
                onBack={goBack} 
                canGoBack={canGoBack} 
                actions={secondaryActions}
            />
            
            {renameItem && (
                <RenameDialog
                    isOpen={!!renameItem}
                    onOpenChange={(isOpen) => !isOpen && setRenameItem(null)}
                    item={renameItem}
                    onSave={(type, id, name) => type === 'status' ? handleSaveStatus(name) : handleSaveRename(type, id, name)}
                />
            )}

            <div className="flex-1 overflow-y-auto p-1">
                <MatchHeaderCard 
                    fixture={processedFixture} 
                    navigate={navigate}
                    customStatus={customStatus}
                />
                <Tabs defaultValue="lineups" value={activeTab} onValueChange={handleTabChange} className="w-full">
                    <TabsList className="grid w-full grid-cols-5 rounded-lg h-auto p-1 bg-card">
                        <TabsTrigger value="details">تفاصيل</TabsTrigger>
                        <TabsTrigger value="odds">احتمالات</TabsTrigger>
                        <TabsTrigger value="standings">الترتيب</TabsTrigger>
                        <TabsTrigger value="events">مُجريات</TabsTrigger>
                        <TabsTrigger value="lineups">التشكيل</TabsTrigger>
                    </TabsList>
                    <TabsContent value="details" className="mt-4"><DetailsTab fixture={processedFixture} statistics={statistics} loading={loadingTabs.details} /></TabsContent>
                    <TabsContent value="odds" className="mt-4"><OddsTab fixtureId={processedFixture.fixture.id} /></TabsContent>
                    <TabsContent value="standings" className="mt-4">
                        <StandingsTab standings={processedStandings} fixture={processedFixture} navigate={navigate} loading={loadingTabs.standings} />
                    </TabsContent>
                    <TabsContent value="events" className="mt-4"><TimelineTab events={processedEvents} homeTeam={processedFixture.teams.home} awayTeam={processedFixture.teams.away} /></TabsContent>
                    <TabsContent value="lineups" className="mt-4">
                        <LineupsTab 
                            lineups={processedLineups} 
                            events={processedEvents} 
                            navigate={navigate} 
                            isAdmin={isAdmin} 
                            onRename={(type, id, name, originalName) => handleOpenRename(type, id, name, originalName)}
                            homeTeamId={processedFixture.teams.home.id}
                            awayTeamId={processedFixture.teams.away.id}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

    

    
