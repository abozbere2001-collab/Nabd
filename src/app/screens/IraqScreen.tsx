
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { collection, getDocs, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useFirestore, useAdmin } from '@/firebase/provider';
import type { Fixture, Standing, AdminFavorite, ManualTopScorer, PinnedMatch } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Button } from '@/components/ui/button';
import { Users, Search, Pin, Edit } from 'lucide-react';
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';
import { FixtureItem } from '@/components/FixtureItem';
import { CURRENT_SEASON } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/components/LanguageProvider';

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
    isAdmin 
}: { 
    navigate: ScreenProps['navigate'],
    fixtures: Fixture[],
    standings: Standing[],
    topScorers: ManualTopScorer[],
    loading: boolean,
    isAdmin: boolean
}) {
    const { t } = useTranslation();
    return (
        <Tabs defaultValue="matches" className="w-full">
            <div className="sticky top-0 bg-background z-10 border-b -mx-4 px-4">
                <TabsList className="grid w-full grid-cols-3 rounded-none h-auto p-0 border-t flex-row-reverse">
                    <TabsTrigger value="scorers" className='rounded-none data-[state=active]:rounded-md'>{t('top_scorers')}</TabsTrigger>
                    <TabsTrigger value="standings" className='rounded-none data-[state=active]:rounded-md'>{t('standings')}</TabsTrigger>
                    <TabsTrigger value="matches" className='rounded-none data-[state=active]:rounded-md'>{t('matches')}</TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="matches" className="p-4 mt-0 -mx-4">
             {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
            ) : fixtures.length > 0 ? (
                <div className="space-y-3">
                    {fixtures.map((fixture) => (
                        <FixtureItem key={fixture.fixture.id} fixture={fixture} navigate={navigate} />
                    ))}
                </div>
            ) : <p className="pt-4 text-center text-muted-foreground">لا توجد مباريات متاحة لهذا الموسم.</p>}
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
                            <TableRow key={`${s.rank}-${s.team.id}`} className="cursor-pointer" onClick={() => navigate('AdminFavoriteTeamDetails', { teamId: s.team.id, teamName: s.team.name })}>
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
            {isAdmin && (
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
                             <TableHead className="text-right">اللاعب</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {topScorers.map((scorer) => (
                            <TableRow key={scorer.rank}>
                                <TableCell className="text-center font-bold text-lg">{scorer.goals}</TableCell>
                                <TableCell>
                                     <p className="text-xs text-muted-foreground text-right">{scorer.teamName}</p>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3 justify-end">
                                        <p className="font-semibold">{scorer.playerName}</p>
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={scorer.playerPhoto} />
                                            <AvatarFallback>{scorer.playerName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : <p className="pt-4 text-center text-muted-foreground">قائمة الهدافين غير متاحة حاليًا.</p>}
          </TabsContent>
        </Tabs>
    );
}

function OurBallTab({ navigate }: { navigate: ScreenProps['navigate'] }) {
    const [teams, setTeams] = useState<AdminFavorite[]>([]);
    const [loading, setLoading] = useState(true);
    const { db } = useFirestore();

    useEffect(() => {
        if (!db) return;
        const fetchAdminFavorites = async () => {
            setLoading(true);
            const favsRef = collection(db, 'adminFavorites');
            try {
                const snapshot = await getDocs(favsRef);
                const fetchedTeams: AdminFavorite[] = [];
                snapshot.forEach((doc) => {
                    fetchedTeams.push(doc.data() as AdminFavorite);
                });
                setTeams(fetchedTeams);
            } catch (error) {
                const permissionError = new FirestorePermissionError({ path: favsRef.path, operation: 'list' });
                errorEmitter.emit('permission-error', permissionError);
            } finally {
                setLoading(false);
            }
        };
        fetchAdminFavorites();
    }, [db]);

    if (loading) {
        return (
             <div className="space-y-4 pt-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
        )
    }

    if (teams.length === 0) {
        return <p className="pt-4 text-center text-muted-foreground">لم يتم إضافة فرق خاصة من قبل المدير بعد.</p>
    }

    return (
        <div className="space-y-3 pt-4">
            {teams.map(team => (
                <div key={team.teamId} onClick={() => navigate('AdminFavoriteTeamDetails', { teamId: team.teamId, teamName: team.name })} className="p-3 rounded-lg border bg-card cursor-pointer">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={team.logo} alt={team.name} />
                            <AvatarFallback>{team.name.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-bold">{team.name}</p>
                            <p className="text-xs text-muted-foreground">{team.note}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export function IraqScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const [loading, setLoading] = useState(true);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [topScorers, setTopScorers] = useState<ManualTopScorer[]>([]);
  const { isAdmin } = useAdmin();
  const { db } = useFirestore();
  const { t } = useTranslation();
  const [pinnedMatches, setPinnedMatches] = useState<PinnedMatch[]>([]);
  const [loadingPinnedMatches, setLoadingPinnedMatches] = useState(true);


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


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [fixturesRes, standingsRes] = await Promise.all([
        fetch(`/api/football/fixtures?league=${IRAQI_LEAGUE_ID}&season=${CURRENT_SEASON}`),
        fetch(`/api/football/standings?league=${IRAQI_LEAGUE_ID}&season=${CURRENT_SEASON}`),
      ]);

      const fixturesData = await fixturesRes.json();
      const standingsData = await standingsRes.json();
      
      setFixtures(fixturesData.response || []);
      setStandings(standingsData.response?.[0]?.league?.standings?.[0] || []);

    } catch (error) {
      console.error("Failed to fetch Iraqi league details:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  useEffect(() => {
      if (db) {
          const scorersRef = collection(db, 'iraqiLeagueTopScorers');
          const q = query(scorersRef, orderBy('goals', 'desc'));
          const unsubscribe = onSnapshot(q, (snapshot) => {
              const fetchedScorers = snapshot.docs.map((doc) => doc.data() as Omit<ManualTopScorer, 'rank'>);

              fetchedScorers.sort((a, b) => {
                  if (a.goals !== b.goals) {
                      return 0;
                  }
                  return a.playerName.localeCompare(b.playerName);
              });
              
              const rankedScorers = fetchedScorers.map((scorer, index) => ({
                ...scorer,
                rank: index + 1
              }));

              setTopScorers(rankedScorers);
          }, (error) => {
              const permissionError = new FirestorePermissionError({ path: 'iraqiLeagueTopScorers', operation: 'list' });
              errorEmitter.emit('permission-error', permissionError);
          });
           return () => unsubscribe();
      }
  }, [db]);
  
  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader 
        title={t('iraq')} 
        onBack={goBack} 
        canGoBack={canGoBack} 
        actions={
          <div className="flex items-center gap-1">
              <SearchSheet navigate={navigate}>
                  <Button variant="ghost" size="icon">
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
            {isAdmin && (
                <Button className="w-full my-2" onClick={() => navigate('ManagePinnedMatch', { matchId: null })}>
                    <Pin className="ml-2 h-4 w-4" />
                    إضافة مباراة للتثبيت
                </Button>
            )}
          </>
        )}

        <Tabs defaultValue="our-league" className="w-full">
          <div className="sticky top-0 bg-background z-10">
            <TabsList className="grid w-full grid-cols-2 flex-row-reverse">
              <TabsTrigger value="our-ball">{t('our_ball')}</TabsTrigger>
              <TabsTrigger value="our-league">{t('our_league')}</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="our-league" className="pt-0">
            <OurLeagueTab 
                navigate={navigate} 
                fixtures={fixtures}
                standings={standings}
                topScorers={topScorers}
                loading={loading}
                isAdmin={isAdmin}
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
