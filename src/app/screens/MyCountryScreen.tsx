
"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { collection, getDocs, doc, query, orderBy, onSnapshot, deleteDoc, updateDoc, deleteField } from 'firebase/firestore';
import { useFirestore, useAdmin, useAuth } from '@/firebase/provider';
import type { Fixture, Standing, ManualTopScorer, PinnedMatch, Favorites, Team, TopScorer } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Button } from '@/components/ui/button';
import { Users, Search, Pin, Edit, Trash2, Loader2, Trophy } from 'lucide-react';
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';
import { FixtureItem } from '@/components/FixtureItem';
import { CURRENT_SEASON } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { hardcodedTranslations } from '@/lib/hardcoded-translations';
import { isMatchLive } from '@/lib/matchStatus';
import { getLocalFavorites, setLocalFavorites } from '@/lib/local-favorites';

const IRAQI_LEAGUE_ID = 542;

function PinnedMatchCard({ match, onManage, isAdmin }: { match: PinnedMatch, onManage: () => void, isAdmin: boolean}) {
    if (!match.isEnabled) return null;

    return (
        <Card className="mb-4 border-primary/50 border-2">
            <CardContent className="p-3 relative">
                <div className="flex items-center justify-center text-center mb-2">
                     <Pin className="h-4 w-4 text-primary mr-2" />
                    <p className="text-sm font-bold text-primary">مباراة مثبتة</p>
                </div>
                 <div className="flex-1 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2 flex-1 justify-end truncate">
                        <span className="font-semibold text-sm truncate">{match.homeTeamName}</span>
                        <Avatar className={'h-8 w-8'}><AvatarImage src={match.homeTeamLogo} alt={match.homeTeamName} /></Avatar>
                    </div>
                    <div className="flex flex-col items-center justify-center min-w-[90px] text-center">
                        <div className="font-bold text-lg">{match.matchTime}</div>
                        <div className="text-xs text-muted-foreground mt-1">{match.matchDate}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-1 truncate">
                        <Avatar className={'h-8 w-8'}><AvatarImage src={match.awayTeamLogo} alt={match.awayTeamName} /></Avatar>
                        <span className="font-semibold text-sm truncate">{match.awayTeamName}</span>
                    </div>
                 </div>
                 <p className="text-center text-xs text-muted-foreground mt-2">{match.competitionName}</p>
                 {isAdmin && (
                     <Button variant="ghost" size="sm" className="absolute top-1 left-1" onClick={onManage}>
                         <Edit className="h-4 w-4 mr-1"/>
                         تعديل
                     </Button>
                 )}
            </CardContent>
        </Card>
    );
}

function OurLeagueTab({ 
    navigate, 
    fixtures, 
    standings, 
    topScorers, 
    loading, 
    isAdmin,
    ourLeague,
}: { 
    navigate: ScreenProps['navigate'],
    fixtures: Fixture[],
    standings: Standing[],
    topScorers: TopScorer[],
    loading: boolean,
    isAdmin: boolean,
    ourLeague: { id: number, name: string, logo: string } | null
}) {
    const listRef = useRef<HTMLDivElement>(null);
    const firstUpcomingMatchRef = useRef<HTMLDivElement>(null);

    const sortedFixtures = useMemo(() => {
        return [...fixtures].sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
    }, [fixtures]);

    useEffect(() => {
        if (!loading && firstUpcomingMatchRef.current && listRef.current) {
            setTimeout(() => {
                if (firstUpcomingMatchRef.current && listRef.current) {
                    const listTop = listRef.current.offsetTop;
                    const itemTop = firstUpcomingMatchRef.current.offsetTop;
                    listRef.current.scrollTop = itemTop - listTop;
                }
            }, 100);
        }
    }, [loading, sortedFixtures]);
    
    if (!ourLeague) {
         return (
            <div className="text-center text-muted-foreground py-10 px-4">
                <p className="text-lg font-semibold">اختر دوريك المفضل</p>
                <p>اذهب إلى "كل البطولات" واضغط على القلب ❤️ بجانب دوريك المفضل ليظهر هنا.</p>
                <Button className="mt-4" onClick={() => navigate('AllCompetitions')}>استكشف البطولات</Button>
            </div>
        );
    }

    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-card border mb-4">
             <Avatar className="h-10 w-10 p-1 border">
                <AvatarImage src={ourLeague.logo} className="object-contain" />
            </Avatar>
            <div>
                <p className="font-bold text-lg">{ourLeague.name}</p>
                <p className="text-sm text-muted-foreground">دورينا المفضل</p>
            </div>
        </div>

        <Tabs defaultValue="matches" className="w-full">
             <div className="sticky top-0 bg-background z-10 -mx-4 px-1">
                <div className="bg-card text-card-foreground rounded-b-lg border-x border-b shadow-md">
                    <TabsList className="grid w-full grid-cols-3 rounded-none h-11 p-0 flex-row-reverse bg-transparent">
                        <TabsTrigger value="scorers">الهدافين</TabsTrigger>
                        <TabsTrigger value="standings">الترتيب</TabsTrigger>
                        <TabsTrigger value="matches">المباريات</TabsTrigger>
                    </TabsList>
                </div>
            </div>
            <TabsContent value="matches" className="mt-0 -mx-4">
                <div ref={listRef} className="h-full overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : sortedFixtures.length > 0 ? (
                        sortedFixtures.map((fixture, index) => {
                            const isUpcoming = !isMatchLive(fixture.fixture.status) && !['FT', 'AET', 'PEN', 'PST'].includes(fixture.fixture.status.short);
                            const isFirstUpcoming = isUpcoming && !sortedFixtures.slice(0, index).some(f => !isMatchLive(f.fixture.status) && !['FT', 'AET', 'PEN', 'PST'].includes(f.fixture.status.short));
                            
                            return (
                                <div key={fixture.fixture.id} ref={isFirstUpcoming ? firstUpcomingMatchRef : null}>
                                    <FixtureItem fixture={fixture} navigate={navigate} />
                                </div>
                            );
                        })
                    ) : (
                        <p className="pt-8 text-center text-muted-foreground">لا توجد مباريات متاحة لهذا الموسم.</p>
                    )}
                </div>
            </TabsContent>
          <TabsContent value="standings" className="p-0 mt-0 -mx-4">
            {loading ? (
                 <div className="space-y-px p-4">
                    {Array.from({ length: 18 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
            ) : standings.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-center">نقاط</TableHead>
                            <TableHead className="text-center">خ</TableHead>
                            <TableHead className="text-center">ت</TableHead>
                            <TableHead className="text-center">ف</TableHead>
                            <TableHead className="text-center">لعب</TableHead>
                            <TableHead className="w-1/2 text-right">الفريق</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {standings.map((s) => (
                            <TableRow key={`${s.rank}-${s.team.id}`} className="cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: s.team.id})}>
                                <TableCell className="text-center font-bold">{s.points}</TableCell>
                                <TableCell className="text-center">{s.all.lose}</TableCell>
                                <TableCell className="text-center">{s.all.draw}</TableCell>
                                <TableCell className="text-center">{s.all.win}</TableCell>
                                <TableCell className="text-center">{s.all.played}</TableCell>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2 justify-end">
                                        <span className="truncate">{s.team.name}</span>
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={s.team.logo} alt={s.team.name} />
                                            <AvatarFallback>{s.team.name.substring(0,1)}</AvatarFallback>
                                        </Avatar>
                                        <span>{s.rank}</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ): <p className="pt-4 text-center text-muted-foreground">جدول الترتيب غير متاح حاليًا.</p>}
          </TabsContent>
           <TabsContent value="scorers" className="p-0 mt-0 -mx-4">
            {isAdmin && ourLeague?.id === IRAQI_LEAGUE_ID && (
                <div className="p-4">
                    <Button className="w-full" onClick={() => navigate('ManageTopScorers')}>
                        <Users className="ml-2 h-4 w-4" />
                        إدارة الهدافين
                    </Button>
                </div>
            )}
            {loading ? (
                <div className="space-y-px p-4">
                    {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
            ) : topScorers.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                             <TableHead className="text-center">الأهداف</TableHead>
                             <TableHead className="text-right">الفريق</TableHead>
                             <TableHead className="flex-1 text-right">اللاعب</TableHead>
                             <TableHead className="text-right w-8">#</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {topScorers.map((scorer, index) => (
                            <TableRow key={scorer.player.id}>
                                <TableCell className="text-center font-bold text-lg">{scorer.statistics[0]?.goals.total || 0}</TableCell>
                                <TableCell>
                                     <p className="text-xs text-muted-foreground text-right">{scorer.statistics[0]?.team.name}</p>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3 justify-end">
                                        <p className="font-semibold">{scorer.player.name}</p>
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={scorer.player.photo} />
                                            <AvatarFallback>{scorer.player.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    </div>
                                </TableCell>
                                <TableCell className="font-bold">{index + 1}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : <p className="pt-4 text-center text-muted-foreground">قائمة الهدافين غير متاحة حاليًا.</p>}
          </TabsContent>
        </Tabs>
      </div>
    );
}

function OurBallTab({ navigate }: { navigate: ScreenProps['navigate'] }) {
    const { user } = useAuth();
    const { db } = useFirestore();
    const { toast } = useToast();
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [customTeamNames, setCustomTeamNames] = useState<Map<number, string>>(new Map());

    const fetchCustomNames = useCallback(async () => {
        if (!db) return new Map();
        try {
            const snapshot = await getDocs(collection(db, 'teamCustomizations'));
            const names = new Map<number, string>();
            snapshot.forEach(doc => names.set(Number(doc.id), doc.data().customName));
            return names;
        } catch (error) {
            console.warn("Could not fetch custom names", error);
            return new Map();
        }
    }, [db]);


    useEffect(() => {
        let unsubscribe: (() => void) | null = null;
        
        const setupListener = async () => {
            setLoading(true);
            const names = await fetchCustomNames();
            setCustomTeamNames(names);

            if (user && db) {
                const favsRef = doc(db, 'users', user.uid, 'favorites', 'data');
                unsubscribe = onSnapshot(favsRef, (snapshot) => {
                    if (snapshot.exists()) {
                        const favs = snapshot.data() as Favorites;
                        setTeams(Object.values(favs.ourBallTeams || {}));
                    } else {
                        setTeams([]);
                    }
                    setLoading(false);
                }, (error) => {
                    const permissionError = new FirestorePermissionError({ path: favsRef.path, operation: 'get' });
                    errorEmitter.emit('permission-error', permissionError);
                    setLoading(false);
                });
            } else {
                setTeams(Object.values(getLocalFavorites().ourBallTeams || {}));
                setLoading(false);
            }
        };

        setupListener();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user, db, fetchCustomNames]);

    const handleDelete = (teamId: number) => {
        if (deletingId) return;
        setDeletingId(teamId);

        if (user && db) {
            const docRef = doc(db, 'users', user.uid, 'favorites', 'data');
            updateDoc(docRef, { [`ourBallTeams.${teamId}`]: deleteField() })
                .catch(error => {
                    const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update' });
                    errorEmitter.emit('permission-error', permissionError);
                    toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف الفريق.' });
                })
                .finally(() => {
                    setDeletingId(null);
                });
        } else {
            const currentFavorites = getLocalFavorites();
            if (currentFavorites.ourBallTeams) {
                delete currentFavorites.ourBallTeams[teamId];
                setLocalFavorites(currentFavorites);
                setTeams(Object.values(currentFavorites.ourBallTeams));
            }
            setDeletingId(null);
        }
    };
    
    if (loading) {
        return (
             <div className="space-y-4 pt-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
        )
    }

    if (teams.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-10 px-4">
                <p className="text-lg font-semibold">قسم "كرتنا" فارغ</p>
                <p>أضف فرقك ومنتخباتك المفضلة هنا بالضغط على زر القلب ❤️ في صفحة "كل البطولات".</p>
                <Button className="mt-4" onClick={() => navigate('AllCompetitions')}>استكشف البطولات</Button>
            </div>
        );
    }

    return (
        <div className="space-y-3 pt-4">
            {teams.map(team => {
                const displayName = customTeamNames.get(team.id) || hardcodedTranslations.teams[team.id] || team.name;
                return (
                    <div key={team.id} className="p-3 rounded-lg border bg-card flex items-center gap-3 h-16">
                        <div onClick={() => navigate('TeamDetails', { teamId: team.id })} className="flex-1 flex items-center gap-3 cursor-pointer">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={team.logo} alt={displayName} />
                                <AvatarFallback>{displayName.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold">{displayName}</p>
                            </div>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={deletingId === team.id} onClick={(e) => e.stopPropagation()}>
                                    {deletingId === team.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        سيتم حذف فريق "{displayName}" من قائمة "كرتنا".
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(team.id)} className="bg-destructive hover:bg-destructive/90">
                                        حذف
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                );
            })}
        </div>
    );
}

export function MyCountryScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const [loading, setLoading] = useState(true);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
  const { isAdmin, user } = useAdmin();
  const { db } = useFirestore();
  const [pinnedMatches, setPinnedMatches] = useState<PinnedMatch[]>([]);
  const [loadingPinnedMatches, setLoadingPinnedMatches] = useState(true);
  
  const [ourLeague, setOurLeague] = useState<{ id: number, name: string, logo: string } | null>(null);
  const [customNames, setCustomNames] = useState<Map<string, string>>(new Map());

  const getLeagueDisplayName = useCallback((id: number, defaultName: string) => {
    return customNames.get(String(id)) || hardcodedTranslations.leagues[id] || defaultName;
  }, [customNames]);

  useEffect(() => {
    if (!db) return;
    const leagueNamesRef = collection(db, 'leagueCustomizations');
    const unsub = onSnapshot(leagueNamesRef, (snapshot) => {
        const names = new Map<string, string>();
        snapshot.forEach(doc => names.set(doc.id, doc.data().customName));
        setCustomNames(names);
    });
    return () => unsub();
  }, [db]);


  useEffect(() => {
    if (!db) {
        setLoadingPinnedMatches(false);
        return;
    };
    
    setLoadingPinnedMatches(true);
    const pinnedMatchesRef = collection(db, 'pinnedIraqiMatches');
    const q = query(pinnedMatchesRef);
    const unsub = onSnapshot(q, (snapshot) => {
        const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PinnedMatch));
        setPinnedMatches(matches);
        setLoadingPinnedMatches(false);
    }, (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: pinnedMatchesRef.path,
            operation: 'list'
        });
        errorEmitter.emit('permission-error', permissionError);
        setPinnedMatches([]);
        setLoadingPinnedMatches(false);
    });

    return () => unsub();
  }, [db]);

  const fetchLeagueData = useCallback(async (leagueId: number) => {
    setLoading(true);
    setFixtures([]);
    setStandings([]);
    setTopScorers([]);

    try {
      const [fixturesRes, standingsRes, scorersRes] = await Promise.all([
        fetch(`/api/football/fixtures?league=${leagueId}&season=${CURRENT_SEASON}`),
        fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`),
        leagueId === IRAQI_LEAGUE_ID ? Promise.resolve(null) : fetch(`/api/football/players/topscorers?league=${leagueId}&season=${CURRENT_SEASON}`),
      ]);

      const fixturesData = await fixturesRes.json();
      const standingsData = await standingsRes.json();
      
      const translatedFixtures = (fixturesData.response || []).map((fixture: Fixture) => ({
          ...fixture,
          teams: {
            home: { ...fixture.teams.home, name: hardcodedTranslations.teams[fixture.teams.home.id] || fixture.teams.home.name },
            away: { ...fixture.teams.away, name: hardcodedTranslations.teams[fixture.teams.away.id] || fixture.teams.away.name },
          }
      }));
      
      const translatedStandings = (standingsData.response?.[0]?.league?.standings?.[0] || []).map((s: Standing) => ({
        ...s,
        team: { ...s.team, name: hardcodedTranslations.teams[s.team.id] || s.team.name }
      }));

      setFixtures(translatedFixtures);
      setStandings(translatedStandings);

      if (scorersRes) {
        const scorersData = await scorersRes.json();
        const translatedScorers = (scorersData.response || []).map((scorer: TopScorer) => ({
            ...scorer,
            player: { ...scorer.player, name: hardcodedTranslations.players[scorer.player.id] || scorer.player.name },
            statistics: scorer.statistics.map(stat => ({...stat, team: { ...stat.team, name: hardcodedTranslations.teams[stat.team.id] || stat.team.name }}))
        }));
        setTopScorers(translatedScorers);
      }

    } catch (error) {
      console.error("Failed to fetch league details:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubFavorites: (() => void) | undefined;
    const setup = (favs: Partial<Favorites>) => {
        const ourLeagueId = favs?.ourLeagueId;
        const leagueInfo = favs.leagues?.[ourLeagueId || IRAQI_LEAGUE_ID];
        
        if (ourLeagueId && leagueInfo) {
             const displayName = getLeagueDisplayName(ourLeagueId, leagueInfo.name);
             setOurLeague({ id: ourLeagueId, name: displayName, logo: leagueInfo.logo });
             fetchLeagueData(ourLeagueId);
        } else {
             // Default to Iraqi League if nothing is selected
             setOurLeague({ id: IRAQI_LEAGUE_ID, name: getLeagueDisplayName(IRAQI_LEAGUE_ID, "دوري نجوم العراق"), logo: "https://media.api-sports.io/football/leagues/542.png"});
             fetchLeagueData(IRAQI_LEAGUE_ID);
        }
    };

    if (user && db) {
        const favsRef = doc(db, 'users', user.uid, 'favorites', 'data');
        unsubFavorites = onSnapshot(favsRef, (doc) => {
            const favs = (doc.data() as Favorites) || {};
            setup(favs);
        });
    } else {
        const localFavs = getLocalFavorites();
        setup(localFavs);
    }

    return () => {
        if (unsubFavorites) unsubFavorites();
    };
  }, [user, db, fetchLeagueData, getLeagueDisplayName]);


  useEffect(() => {
      if (db && ourLeague?.id === IRAQI_LEAGUE_ID) {
          const scorersRef = collection(db, 'iraqiLeagueTopScorers');
          const q = query(scorersRef, orderBy('rank', 'asc'));
          const unsubscribe = onSnapshot(q, (snapshot) => {
              const fetchedScorers = snapshot.docs.map((doc) => doc.data() as ManualTopScorer);
              // The API for manual scorers has a different structure. We need to adapt it.
              // For simplicity, we assume the API for scorers will be dynamic now.
          }, (error) => {
              const permissionError = new FirestorePermissionError({ path: 'iraqiLeagueTopScorers', operation: 'list' });
              errorEmitter.emit('permission-error', permissionError);
          });
           return () => unsubscribe();
      }
  }, [db, ourLeague]);
  
  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader 
        title={"بلدي"} 
        onBack={goBack} 
        canGoBack={canGoBack} 
        actions={
          <div className="flex items-center gap-1">
              <SearchSheet navigate={navigate}>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Search className="h-5 w-5" />
                  </Button>
              </SearchSheet>
              <ProfileButton/>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto px-4">
        {loadingPinnedMatches ? (
            <Skeleton className="h-28 w-full mb-4" />
        ) : (
          <>
            {pinnedMatches.map(match => (
              <PinnedMatchCard 
                key={match.id} 
                match={match} 
                onManage={() => navigate('ManagePinnedMatch', { matchId: match.id })} 
                isAdmin={isAdmin} 
              />
            ))}
            {isAdmin && pinnedMatches.filter(m => m.isEnabled).length === 0 && (
                <Button className="w-full my-2" onClick={() => navigate('ManagePinnedMatch', { matchId: null })}>
                    <Pin className="ml-2 h-4 w-4" />
                    إضافة مباراة للتثبيت
                </Button>
            )}
          </>
        )}

        <Tabs defaultValue="our-league" className="w-full">
           <div className="sticky top-0 bg-background z-10 px-1 pt-1 -mx-4">
                <div className="bg-card text-card-foreground rounded-b-lg border-x border-b shadow-md">
                    <TabsList className="grid w-full grid-cols-2 flex-row-reverse h-11 bg-transparent p-0">
                      <TabsTrigger value="our-ball">كرتنا</TabsTrigger>
                      <TabsTrigger value="our-league">دورينا</TabsTrigger>
                    </TabsList>
                </div>
            </div>
          <TabsContent value="our-league" className="pt-4">
            <OurLeagueTab 
                navigate={navigate} 
                fixtures={fixtures}
                standings={standings}
                topScorers={topScorers}
                loading={loading}
                isAdmin={isAdmin}
                ourLeague={ourLeague}
            />
          </TabsContent>
          <TabsContent value="our-ball" className="pt-0">
             <OurBallTab navigate={navigate} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

    