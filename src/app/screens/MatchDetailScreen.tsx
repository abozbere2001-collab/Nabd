
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';
import type { Fixture, Standing, Player as PlayerType, Team, Favorites } from '@/lib/types';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, setDoc, getDocs, collection, updateDoc, deleteField, getDoc } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { Star, Pencil, Goal, ArrowLeftRight, RectangleVertical, Copy, Heart } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { NoteDialog } from '@/components/NoteDialog';
import { Progress } from '@/components/ui/progress';
import Image from "next/image";


// --- TYPE DEFINITIONS ---
interface PlayerWithStats {
    player: PlayerType & { pos?: string; grid?: string; };
    statistics?: any[];
}
interface LineupData {
    team: Team;
    coach: any;
    formation: string;
    startXI: PlayerWithStats[];
    substitutes: PlayerWithStats[];
}
interface MatchEvent {
    time: { elapsed: number; extra: number | null };
    team: { id: number; name: string; logo: string };
    player: { id: number; name: string };
    assist: { id: number | null; name: string | null };
    type: 'Goal' | 'Card' | 'subst' | 'Var';
    detail: string;
    comments: string | null;
}
interface MatchData {
    lineups: LineupData[];
    events: MatchEvent[];
    stats: any[];
    standings: Standing[];
    loading: boolean;
    error: string | null;
}
type RenameType = 'team' | 'player' | 'coach';

// --- HOOKS ---
function useMatchData(fixture?: Fixture): MatchData {
    const { toast } = useToast();
    const [data, setData] = useState<MatchData>({
        lineups: [], events: [], stats: [], standings: [], loading: true, error: null,
    });
    
    const CURRENT_SEASON = useMemo(() => {
        if (!fixture) return new Date().getFullYear();
        if (fixture.league && fixture.league.round) {
            const seasonYearMatch = fixture.league.round.match(/(\d{4})/);
            if (seasonYearMatch) {
              const year = parseInt(seasonYearMatch[0], 10);
              // Handle cases like "2023-2024", we want the starting year
              return year;
            }
        }
        // Fallback to fixture year if round doesn't have a year
        return new Date(fixture.fixture.date).getFullYear();
    }, [fixture]);


    useEffect(() => {
        if (!fixture) {
            setData(prev => ({ ...prev, loading: false, error: "No fixture data provided" }));
            return;
        }

        const fetchData = async () => {
            setData(prev => ({ ...prev, loading: true, error: null }));
            const fixtureId = fixture.fixture.id;
            const leagueId = fixture.league.id;

            try {
                const [lineupsRes, eventsRes, statsRes, standingsRes] = await Promise.allSettled([
                    fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
                    fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
                    fetch(`/api/football/statistics?fixture=${fixtureId}`),
                    fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`),
                ]);

                const parseResult = async (res: PromiseSettledResult<Response>) => {
                    if (res.status === 'fulfilled' && res.value.ok) {
                        try {
                            const json = await res.value.json();
                            return json.response || [];
                        } catch (e) { return []; }
                    }
                    return [];
                };

                let fetchedLineups: LineupData[] = await parseResult(lineupsRes);
                const fetchedEvents: MatchEvent[] = await parseResult(eventsRes);
                const fetchedStats: any[] = await parseResult(statsRes);
                const fetchedStandings: Standing[] = (await parseResult(standingsRes))[0]?.league?.standings[0] || [];
                
                if (fetchedLineups.length > 0) {
                     for (let i = 0; i < fetchedLineups.length; i++) {
                        const lineup = fetchedLineups[i];
                        if (!lineup.team?.id) continue;
                        
                        const teamPlayersRes = await fetch(`/api/football/players?team=${lineup.team.id}&season=${CURRENT_SEASON}`);
                        if (teamPlayersRes.ok) {
                            const teamPlayersData = await teamPlayersRes.json();
                            const teamPlayersList: PlayerWithStats[] = teamPlayersData.response || [];
                            const photoMap = new Map<number, string>();
                            teamPlayersList.forEach(p => { if (p.player.photo) photoMap.set(p.player.id, p.player.photo); });

                            const updatePhotos = (playerList: PlayerWithStats[]) => {
                                if (!playerList) return;
                                playerList.forEach(p => {
                                    if (p.player && !p.player.photo && photoMap.has(p.player.id)) {
                                        p.player.photo = photoMap.get(p.player.id)!;
                                    }
                                });
                            };

                            updatePhotos(lineup.startXI);
                            updatePhotos(lineup.substitutes);
                        }
                    }
                }
                
                setData({
                    lineups: fetchedLineups,
                    events: fetchedEvents.sort((a, b) => a.time.elapsed - b.time.elapsed),
                    stats: fetchedStats,
                    standings: fetchedStandings,
                    loading: false,
                    error: null,
                });

            } catch (error: any) {
                console.error("❌ Match data fetch error:", error);
                toast({
                    variant: "destructive",
                    title: "خطأ في الشبكة",
                    description: "فشل في جلب بيانات المباراة. يرجى التحقق من اتصالك بالإنترنت.",
                });
                setData({
                    lineups: [], events: [], stats: [], standings: [], loading: false,
                    error: error.message || "Unknown error",
                });
            }
        };

        fetchData();
    }, [fixture, toast, CURRENT_SEASON]);

    return data;
}

// --- CHILD COMPONENTS ---

function LineupField({ lineup }) {
  if (!lineup || !lineup.startXI) {
    return (
      <div className="text-center text-gray-400 py-10">
        لا توجد تشكيلة متاحة حاليًا.
      </div>
    );
  }

  // عكس الترتيب العمودي: الهجوم -> الوسط -> الدفاع -> الحارس
  const grouped = {
    attackers: lineup.startXI.filter((p) => p.player.pos === "F"),
    midfielders: lineup.startXI.filter((p) => p.player.pos === "M"),
    defenders: lineup.startXI.filter((p) => p.player.pos === "D"),
    goalkeepers: lineup.startXI.filter((p) => p.player.pos === "G"),
  };

  // دالة لجلب صورة اللاعب من API Football
  const getPlayerImage = (player) =>
    player.player.photo ||
    `https://media.api-sports.io/football/players/${player.player.id}.png`;

  // ترتيب الخطوط من الأعلى للأسفل
  const lines = [
    { label: "الهجوم", players: grouped.attackers },
    { label: "الوسط", players: grouped.midfielders },
    { label: "الدفاع", players: grouped.defenders },
    { label: "الحارس", players: grouped.goalkeepers },
  ];

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative w-full max-w-3xl aspect-[2/3] bg-green-700 rounded-2xl overflow-hidden shadow-xl border-4 border-green-900">
        {/* خلفية الملعب */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.15)_1px,_transparent_1px)] bg-[length:30px_30px]" />

        {/* رسم الخطوط من الأعلى إلى الأسفل */}
        <div className="absolute inset-0 flex flex-col justify-between py-6">
          {lines.map((line, index) => (
            <div
              key={index}
              className="flex justify-center gap-4 flex-wrap px-4"
            >
              {line.players.map((p, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center text-center space-y-1 w-[65px]"
                >
                  <div className="relative w-14 h-14 rounded-full border-2 border-white overflow-hidden shadow-md bg-green-900">
                    <Image
                      src={getPlayerImage(p)}
                      alt={p.player.name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                  <span className="text-xs text-white font-semibold leading-tight">
                    {p.player.name.split(" ")[0]}
                  </span>
                  <span className="text-[10px] text-gray-300">
                    {p.player.pos}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* المدرب */}
      {lineup.coach && (
        <div className="mt-4 text-center">
          <div className="text-gray-200 text-sm">المدرب</div>
          <div className="text-white font-bold">{lineup.coach.name}</div>
        </div>
      )}

      {/* قائمة البدلاء */}
      {lineup.substitutes?.length > 0 && (
        <Card className="w-full max-w-3xl mt-6 bg-green-900/70 border-green-800 p-4">
          <h3 className="text-white text-center mb-3 font-semibold">
            البدلاء
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 justify-items-center">
            {lineup.substitutes.map((sub, i) => (
              <div key={i} className="flex flex-col items-center space-y-1">
                <div className="relative w-12 h-12 rounded-full overflow-hidden border border-white">
                  <Image
                    src={getPlayerImage(sub)}
                    alt={sub.player.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
                <span className="text-[11px] text-white text-center leading-tight">
                  {sub.player.name.split(" ")[0]}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}


const EventIcon = ({ event }: { event: MatchEvent }) => {
    if (event.type === 'Goal') {
        return <Goal className="h-5 w-5 text-foreground" />;
    }
    if (event.type === 'Card' && event.detail === 'Yellow Card') {
        return <RectangleVertical className="h-5 w-5 text-yellow-400 fill-current" />;
    }
    if (event.type === 'Card' && (event.detail === 'Red Card' || event.detail === 'Second Yellow card')) {
        return <RectangleVertical className="h-5 w-5 text-red-500 fill-current" />;
    }
    if (event.type === 'subst') {
        return <ArrowLeftRight className="h-4 w-4 text-blue-400" />;
    }
    return null;
};

const STATS_TRANSLATIONS: { [key: string]: string } = {
    "Shots on Goal": "تسديدات على المرمى", "Shots off Goal": "تسديدات خارج المرمى", "Total Shots": "إجمالي التسديدات",
    "Blocked Shots": "تسديدات تم صدها", "Shots insidebox": "تسديدات من الداخل", "Shots outsidebox": "تسديدات من الخارج",
    "Fouls": "أخطاء", "Corner Kicks": "ركلات ركنية", "Offsides": "تسلل", "Ball Possession": "الاستحواذ",
    "Yellow Cards": "بطاقات صفراء", "Red Cards": "بطاقات حمراء", "Goalkeeper Saves": "تصديات الحارس",
    "Total passes": "إجمالي التمريرات", "Passes accurate": "تمريرات صحيحة", "Passes %": "دقة التمرير",
};

const EventsView = ({ events, homeTeamId, getPlayerName }: { events: MatchEvent[], homeTeamId: number, getPlayerName: (id: number, defaultName: string) => string }) => {
    const [filter, setFilter] = useState<'highlights' | 'all'>('all');
    
    const filteredEvents = useMemo(() => {
        if (filter === 'highlights') {
            return events.filter(e => e.type === 'Goal');
        }
        return events;
    }, [events, filter]);

    if (!events || events.length === 0) {
        return <div className="text-muted-foreground text-center py-4">لا توجد أحداث متاحة لعرضها.</div>
    }

    return (
        <Card>
            <CardContent className="p-4">
                 <Tabs value={filter} onValueChange={(value) => setFilter(value as any)} className="w-full mb-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="all">كل الأحداث</TabsTrigger>
                        <TabsTrigger value="highlights">الأبرز</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="relative flex flex-col items-center">
                    <div className="absolute top-0 bottom-0 w-px bg-border/50"></div>
                    {filteredEvents.map((event, index) => {
                        const isHomeEvent = event.team.id === homeTeamId;
                        return (
                            <div key={index} className="relative flex w-full justify-center items-center my-3">
                                {isHomeEvent ? (
                                    <>
                                        <div className="w-1/2 p-2 text-sm text-right pr-12">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="flex-1">
                                                    <p className="font-bold">{getPlayerName(event.player.id, event.player.name)}</p>
                                                    {event.assist.name && <p className="text-xs text-muted-foreground">صناعة: {getPlayerName(event.assist.id!, event.assist.name)}</p>}
                                                </div>
                                                <EventIcon event={event} />
                                            </div>
                                        </div>
                                        <div className="absolute left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-card border flex items-center justify-center text-xs font-bold z-10">
                                            {event.time.elapsed}{event.time.extra ? `+${event.time.extra}` : ''}'
                                        </div>
                                        <div className="w-1/2 p-2"></div>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-1/2 p-2"></div>
                                        <div className="absolute left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-card border flex items-center justify-center text-xs font-bold z-10">
                                            {event.time.elapsed}{event.time.extra ? `+${event.time.extra}` : ''}'
                                        </div>
                                        <div className="w-1/2 p-2 text-sm text-left pl-12">
                                            <div className="flex items-center justify-start gap-2">
                                                <EventIcon event={event} />
                                                <div className="flex-1">
                                                    <p className="font-bold">{getPlayerName(event.player.id, event.player.name)}</p>
                                                    {event.assist.name && <p className="text-xs text-muted-foreground">صناعة: {getPlayerName(event.assist.id!, event.assist.name)}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    )
}

const StatsView = ({ stats, fixture }: { stats: any[], fixture: Fixture }) => {
    if (stats.length < 2) return <p className="text-muted-foreground text-center py-4">الإحصائيات غير متاحة</p>;

    const homeStats = stats.find(s => s.team.id === fixture.teams.home.id)?.statistics || [];
    const awayStats = stats.find(s => s.team.id === fixture.teams.away.id)?.statistics || [];

    const combinedStats = homeStats.map((stat: any) => {
        const awayStat = awayStats.find((s: any) => s.type === stat.type);
        return {
            type: stat.type,
            homeValue: stat.value,
            awayValue: awayStat ? awayStat.value : null
        };
    }).filter((s: any) => STATS_TRANSLATIONS[s.type]); // Filter only for stats we can translate

    return (
        <Card>
            <CardContent className="p-4 space-y-3">
                {combinedStats.map((stat, index) => {
                    const homeVal = typeof stat.homeValue === 'string' ? parseInt(stat.homeValue.replace('%', '')) : (stat.homeValue || 0);
                    const awayVal = typeof stat.awayValue === 'string' ? parseInt(stat.awayValue.replace('%', '')) : (stat.awayValue || 0);
                    const total = homeVal + awayVal;
                    const homePercentage = total > 0 ? (homeVal / total) * 100 : 50;

                    return (
                        <div key={index} className="space-y-1">
                             <div className="flex justify-between items-center text-sm font-bold">
                                <span>{stat.homeValue ?? 0}</span>
                                <span className="text-muted-foreground text-xs">{STATS_TRANSLATIONS[stat.type] || stat.type}</span>
                                <span>{stat.awayValue ?? 0}</span>
                            </div>
                            <Progress value={homePercentage} className="h-2 [&>div]:bg-primary" />
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    );
};


// --- MAIN SCREEN COMPONENT ---
export function MatchDetailScreen({ navigate, goBack, canGoBack, fixture, headerActions }: ScreenProps & { fixtureId: number; fixture: Fixture, headerActions?: React.ReactNode }) {
    const { lineups, events, stats, loading, error } = useMatchData(fixture);
    const [activeLineup, setActiveLineup] = useState<'home' | 'away'>('home');
    const { isAdmin } = useAdmin();
    const { db } = useFirestore();
    const [renameItem, setRenameItem] = useState<{ id: number; name: string; type: RenameType } | null>(null);
    const [isRenameOpen, setRenameOpen] = useState(false);
    const [customPlayerNames, setCustomPlayerNames] = useState<Map<number, string>>(new Map());

    const fetchCustomNames = useCallback(async () => {
        if (!db) return;
        const playersColRef = collection(db, 'playerCustomizations');
        try {
            const playersSnapshot = await getDocs(playersColRef);
            const playerNames = new Map<number, string>();
            playersSnapshot.forEach(doc => playerNames.set(Number(doc.id), doc.data().customName));
            setCustomPlayerNames(playerNames);
        } catch (error) {
             const permissionError = new FirestorePermissionError({ path: 'playerCustomizations', operation: 'list' });
             errorEmitter.emit('permission-error', permissionError);
        }
    }, [db]);

    useEffect(() => { fetchCustomNames(); }, [fetchCustomNames]);
    
    const getPlayerName = useCallback((id: number, defaultName: string) => {
        return customPlayerNames.get(id) || defaultName;
    }, [customPlayerNames]);

    const handleOpenRename = (type: RenameType, id: number, name: string) => {
        setRenameItem({ id, name, type });
        setRenameOpen(true);
    };

    const handleSaveRename = async (newName: string) => {
        if (!renameItem || !db) return;
        const collectionName = `${renameItem.type}Customizations`;
        const docRef = doc(db, collectionName, String(renameItem.id));
        await setDoc(docRef, { customName: newName });
        fetchCustomNames();
    };

    if (loading && lineups.length === 0) {
        return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title="تفاصيل المباراة" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
                <div className="flex-1 p-4 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-96 w-full" /></div>
            </div>
        );
    }
     if (error) {
        return <div className="flex h-full flex-col bg-background"><ScreenHeader title="خطأ" onBack={goBack} canGoBack={canGoBack} /><div className="text-center text-red-500 py-10">حدث خطأ: {error}</div></div>
    }
    
    const homeLineup = lineups.find(l => l.team.id === fixture.teams.home.id);
    const awayLineup = lineups.find(l => l.team.id === fixture.teams.away.id);
    const lineupToShow = activeLineup === 'home' ? homeLineup : awayLineup;
    
    return (
        <div className="flex h-full flex-col bg-background">
            {renameItem && <RenameDialog isOpen={isRenameOpen} onOpenChange={setRenameOpen} currentName={renameItem.name} onSave={handleSaveRename} itemType={renameItem.type === 'player' ? 'اللاعب' : 'الفريق'} />}
            <ScreenHeader title={fixture.league.name} onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className="p-4 flex-1 overflow-y-auto">
                 <div className="text-center mb-4">
                    <div className="flex justify-around items-center">
                        <div className="flex flex-col items-center gap-2 w-1/3">
                            <Avatar className="h-16 w-16"><AvatarImage src={fixture.teams.home.logo} /></Avatar>
                            <h2 className="text-lg font-bold">{fixture.teams.home.name}</h2>
                        </div>
                        <div className="text-4xl font-bold">
                            {fixture.goals.home ?? '-'} - {fixture.goals.away ?? '-'}
                        </div>
                         <div className="flex flex-col items-center gap-2 w-1/3">
                            <Avatar className="h-16 w-16"><AvatarImage src={fixture.teams.away.logo} /></Avatar>
                            <h2 className="text-lg font-bold">{fixture.teams.away.name}</h2>
                        </div>
                    </div>
                     <p className="text-muted-foreground text-sm mt-2">{fixture.fixture.status.long}</p>
                 </div>
                 
                <Tabs defaultValue="lineups">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="lineups">التشكيلة</TabsTrigger>
                        <TabsTrigger value="details">تفاصيل</TabsTrigger>
                    </TabsList>
                    <TabsContent value="lineups" className="mt-4">
                        <div className="flex justify-center gap-4 mb-4">
                             <Button onClick={() => setActiveLineup('home')} variant={activeLineup === 'home' ? 'default' : 'outline'}>{fixture.teams.home.name}</Button>
                             <Button onClick={() => setActiveLineup('away')} variant={activeLineup === 'away' ? 'default' : 'outline'}>{fixture.teams.away.name}</Button>
                        </div>
                        <LineupField 
                            lineup={lineupToShow}
                        />
                    </TabsContent>
                    <TabsContent value="details" className="mt-4 space-y-4">
                       <EventsView events={events} homeTeamId={fixture.teams.home.id} getPlayerName={getPlayerName} />
                       <StatsView stats={stats} fixture={fixture} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
