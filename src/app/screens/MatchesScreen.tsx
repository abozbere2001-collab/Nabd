
"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { format, addDays, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth, useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { Loader2, Search, RadioTower, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CommentsButton } from '@/components/CommentsButton';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';
import type { Fixture as FixtureType, Favorites, MatchDetails } from '@/lib/types';


interface GroupedFixtures {
    [leagueName: string]: {
        league: FixtureType['league'];
        fixtures: FixtureType[];
    }
}

// Live Timer Component
const LiveMatchStatus = ({ fixture }: { fixture: FixtureType }) => {
    const { status, date } = fixture.fixture;
    const [elapsedTime, setElapsedTime] = useState(status.elapsed);

    useEffect(() => {
        setElapsedTime(status.elapsed);
        if (['1H', '2H', 'ET', 'P', 'BT'].includes(status.short) && status.elapsed !== null) {
            const interval = setInterval(() => {
                setElapsedTime(prev => (prev ? prev + 1 : 1));
            }, 60000);
            return () => clearInterval(interval);
        }
    }, [status.short, status.elapsed]);

    const isLive = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(status.short);
    const isFinished = ['FT', 'AET', 'PEN'].includes(status.short);

    if (isLive) {
        return (
            <>
                <div className="text-red-500 font-bold text-xs animate-pulse mb-1">
                    {elapsedTime ? `${elapsedTime}'` : status.long}
                </div>
                <div className="font-bold text-lg">{`${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0}`}</div>
                <div className="text-xs text-muted-foreground mt-1">{status.short === 'HT' ? 'استراحة' : 'مباشر'}</div>
            </>
        );
    }
    
    if (isFinished) {
         return (
            <>
                <div className="font-bold text-lg">{`${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0}`}</div>
                <div className="text-xs text-muted-foreground mt-1">انتهت</div>
            </>
        );
    }

    return (
        <>
            <div className="font-bold text-lg">{format(new Date(date), "HH:mm")}</div>
            <div className="text-xs text-muted-foreground mt-1">{status.long}</div>
        </>
    );
};

// Fixture Item Component
const FixtureItem = React.memo(({ fixture, navigate, commentsEnabled }: { fixture: FixtureType, navigate: ScreenProps['navigate'], commentsEnabled?: boolean }) => {
    
    return (
      <div 
        key={fixture.fixture.id} 
        className="rounded-lg bg-card border p-3 text-sm transition-all duration-300"
      >
        <div 
          className="hover:bg-accent/50 cursor-pointer -m-3 p-3"
          onClick={() => navigate('UltimateMatchDetail', { fixtureId: fixture.fixture.id })}
        >
         <div 
            className="flex items-center justify-center text-xs text-muted-foreground mb-2 cursor-pointer hover:underline"
            onClick={(e) => {
                e.stopPropagation();
                navigate('CompetitionDetails', { leagueId: fixture.league.id, title: fixture.league.name, logo: fixture.league.logo });
            }}
          >
              <Avatar className="h-4 w-4 ml-2">
                  <AvatarImage src={fixture.league.logo} alt={fixture.league.name} />
                  <AvatarFallback>{fixture.league.name.substring(0,1)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{fixture.league.name}</span>
         </div>
         <div className="flex items-center justify-between gap-2">
             <div className="flex items-center gap-2 flex-1 justify-end truncate">
                 <span className="font-semibold truncate">{fixture.teams.home.name}</span>
                 <Avatar className="h-8 w-8">
                     <AvatarImage src={fixture.teams.home.logo} alt={fixture.teams.home.name} />
                     <AvatarFallback>{fixture.teams.home.name.substring(0, 2)}</AvatarFallback>
                 </Avatar>
             </div>
             <div className="flex flex-col items-center justify-center min-w-[80px] text-center">
                 <LiveMatchStatus fixture={fixture} />
             </div>
             <div className="flex items-center gap-2 flex-1 truncate">
                  <Avatar className="h-8 w-8">
                     <AvatarImage src={fixture.teams.away.logo} alt={fixture.teams.away.name} />
                     <AvatarFallback>{fixture.teams.away.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                 <span className="font-semibold truncate">{fixture.teams.away.name}</span>
             </div>
         </div>
         </div>
         <div className="mt-2 pt-2 border-t border-border/50">
            <CommentsButton matchId={fixture.fixture.id} navigate={navigate} commentsEnabled={commentsEnabled} />
         </div>
      </div>
    );
});
FixtureItem.displayName = 'FixtureItem';


// Fixtures List Component
const FixturesList = ({ 
    fixtures, 
    loading,
    activeTab, 
    showLiveOnly,
    hasAnyFavorites,
    favoritedLeagueIds,
    favoritedTeamIds,
    matchDetails,
    navigate,
}: { 
    fixtures: FixtureType[], 
    loading: boolean,
    activeTab: string, 
    showLiveOnly: boolean,
    hasAnyFavorites: boolean,
    favoritedLeagueIds: number[],
    favoritedTeamIds: number[],
    matchDetails: { [matchId: string]: MatchDetails },
    navigate: ScreenProps['navigate'],
}) => {
    
    const filteredFixtures = useMemo(() => {
        let fixturesToFilter = fixtures;

        if (showLiveOnly) {
            fixturesToFilter = fixturesToFilter.filter(f => ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(f.fixture.status.short));
        }

        if (activeTab === 'all-matches') {
            return fixturesToFilter;
        }
        if (activeTab === 'my-results'){
             return fixturesToFilter.filter(f => 
                favoritedTeamIds.includes(f.teams.home.id) ||
                favoritedTeamIds.includes(f.teams.away.id) ||
                favoritedLeagueIds.includes(f.league.id)
            );
        }
        return [];
    }, [fixtures, activeTab, favoritedTeamIds, favoritedLeagueIds, showLiveOnly]);

    const groupedFixtures = useMemo(() => {
        return filteredFixtures.reduce((acc, fixture) => {
            const leagueName = fixture.league.name;
            if (!acc[leagueName]) {
                acc[leagueName] = { league: fixture.league, fixtures: [] };
            }
            acc[leagueName].fixtures.push(fixture);
            return acc;
        }, {} as GroupedFixtures);
    }, [filteredFixtures]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (activeTab === 'my-results' && !hasAnyFavorites) {
        return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p className="font-bold text-lg">لم تقم بإضافة أي مفضلات</p>
                <p className="text-sm">أضف فرقا أو بطولات لترى مبارياتها هنا.</p>
            </div>
        );
    }
    
    const liveMatchesCount = fixtures.filter(f => ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(f.fixture.status.short)).length;

    if (showLiveOnly && liveMatchesCount === 0) {
        return (
             <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p>لا توجد مباريات مباشرة حاليًا.</p>
            </div>
        )
    }

    if (fixtures.length > 0 && filteredFixtures.length === 0 && activeTab === 'my-results') {
       return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p className="font-bold text-lg">لا توجد مباريات لمفضلاتك هذا اليوم</p>
            </div>
        );
    }

    if (Object.keys(groupedFixtures).length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p>لا توجد مباريات لهذا اليوم.</p>
            </div>
        );
    }

    const sortedLeagues = Object.keys(groupedFixtures).sort((a,b) => a.localeCompare(b));


    return (
        <div className="space-y-4">
            {sortedLeagues.map(leagueName => {
                const { league, fixtures } = groupedFixtures[leagueName];
                return (
                    <Accordion type="single" collapsible defaultValue="item-1" key={leagueName}>
                        <AccordionItem value="item-1">
                            <AccordionTrigger className="font-bold text-foreground">
                               {leagueName}
                            </AccordionTrigger>
                            <AccordionContent className="space-y-2">
                                {fixtures.map(f => <FixtureItem key={f.fixture.id} fixture={f} navigate={navigate} commentsEnabled={matchDetails[f.fixture.id]?.commentsEnabled} />)}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                )
            })}
        </div>
    );
};

// Date Scroller
const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

const getDayLabel = (date: Date) => {
    if (isToday(date)) return "اليوم";
    if (isYesterday(date)) return "الأمس";
    if (isTomorrow(date)) return "غداً";
    return format(date, "EEE", { locale: ar });
};

const DateScroller = ({ selectedDateKey, onDateSelect }: {selectedDateKey: string, onDateSelect: (dateKey: string) => void}) => {
    const dates = useMemo(() => {
        const today = new Date();
        const days = [];
        for (let i = -365; i <= 365; i++) {
            days.push(addDays(today, i));
        }
        return days;
    }, []);
    
    const scrollerRef = useRef<HTMLDivElement>(null);
    const selectedButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const scroller = scrollerRef.current;
        const selectedButton = selectedButtonRef.current;

        if (scroller && selectedButton) {
            const scrollerRect = scroller.getBoundingClientRect();
            const selectedRect = selectedButton.getBoundingClientRect();
            
            const scrollOffset = selectedRect.left - scrollerRect.left - (scrollerRect.width / 2) + (selectedRect.width / 2);
            
            scroller.scrollTo({ left: scroller.scrollLeft + scrollOffset, behavior: 'smooth' });
        }
    }, [selectedDateKey]);

    return (
        <div ref={scrollerRef} className="flex flex-row overflow-x-auto pb-2 px-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {dates.map(date => {
                const dateKey = formatDateKey(date);
                const isSelected = dateKey === selectedDateKey;
                return (
                     <button
                        key={dateKey}
                        ref={isSelected ? selectedButtonRef : null}
                        className={cn(
                            "relative flex flex-col items-center justify-center h-auto py-1 px-2.5 min-w-[48px] rounded-lg transition-colors mr-2",
                            "text-foreground/80 hover:text-primary",
                            isSelected && "text-primary"
                        )}
                        onClick={() => onDateSelect(dateKey)}
                        data-state={isSelected ? 'active' : 'inactive'}
                    >
                        <span className="text-xs font-normal">{getDayLabel(date)}</span>
                        <span className="font-bold text-sm">{format(date, 'd')}</span>
                        <span className={cn(
                            "absolute bottom-0 h-0.5 w-4 rounded-full bg-primary transition-transform scale-x-0",
                            isSelected && "scale-x-100"
                        )} />
                    </button>
                )
            })}
        </div>
    );
}

type TabName = 'all-matches' | 'my-results' | 'predictions';
type Cache<T> = { [date: string]: T };

// Main Screen Component
export function MatchesScreen({ navigate, goBack, canGoBack, isVisible }: ScreenProps & { isVisible: boolean }) {
  const { user } = useAuth();
  const { db } = useFirestore();
  const [favorites, setFavorites] = useState<Favorites>({userId: ''});
  const [activeTab, setActiveTab] = useState<TabName>('my-results');

  const [selectedDateKey, setSelectedDateKey] = useState(formatDateKey(new Date()));

  const [fixturesCache, setFixturesCache] = useState<Cache<FixtureType[]>>({});
  const [loadingFixtures, setLoadingFixtures] = useState(true);
  
  const [showLiveOnly, setShowLiveOnly] = useState(false);

  const [matchDetails, setMatchDetails] = useState<{ [matchId: string]: MatchDetails }>({});
  
  useEffect(() => {
    if (!user || !db) {
        setFavorites({userId: ''});
        return;
    }
    const docRef = doc(db, 'favorites', user.uid);
    const unsubscribe = onSnapshot(docRef, (doc) => {
        setFavorites(doc.data() as Favorites || {userId: user.uid});
    }, (error) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
    });

    return () => unsubscribe();
  }, [user, db]);
  
  useEffect(() => {
      if (!db) return;
      const matchesColRef = collection(db, 'matches');
      const unsubscribe = onSnapshot(matchesColRef, (snapshot) => {
          const details: { [matchId: string]: MatchDetails } = {};
          snapshot.forEach(doc => {
              details[doc.id] = doc.data() as MatchDetails;
          });
          setMatchDetails(prevDetails => ({ ...prevDetails, ...details }));
      }, (error) => {
          const permissionError = new FirestorePermissionError({ path: 'matches', operation: 'list' });
          errorEmitter.emit('permission-error', permissionError);
      });
      return () => unsubscribe();
  }, [db]);


  const fetchFixturesForDate = useCallback(async (dateKey: string) => {
    if (fixturesCache[dateKey]) {
      setLoadingFixtures(false);
      return;
    }
    setLoadingFixtures(true);
    const url = `/api/football/fixtures?date=${dateKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch fixtures');
        const data = await response.json();
        const fixtures = data.response || [];
        setFixturesCache(prev => ({ ...prev, [dateKey]: fixtures }));
    } catch (error) {
        console.error(`Failed to fetch fixtures for ${dateKey}:`, error);
        setFixturesCache(prev => ({ ...prev, [dateKey]: [] }));
    } finally {
        setLoadingFixtures(false);
    }
  }, [fixturesCache]);

  
  useEffect(() => {
    fetchFixturesForDate(selectedDateKey);
  }, [selectedDateKey, fetchFixturesForDate]);


  const handleDateChange = (dateKey: string) => {
      setSelectedDateKey(dateKey);
  };
  
  const handleTabChange = (value: string) => {
    const tabValue = value as TabName;
    setActiveTab(tabValue);
  };


  const favoritedTeamIds = useMemo(() => favorites?.teams ? Object.keys(favorites.teams).map(Number) : [], [favorites.teams]);
  const favoritedLeagueIds = useMemo(() => favorites?.leagues ? Object.keys(favorites.leagues).map(Number) : [], [favorites.leagues]);
  const hasAnyFavorites = favoritedLeagueIds.length > 0 || favoritedTeamIds.length > 0;
    
  const currentFixtures = fixturesCache[selectedDateKey] || [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
        <ScreenHeader 
            title="" 
            canGoBack={false}
            onBack={() => {}} 
            actions={
              <div className="flex items-center gap-2">
                  <SearchSheet navigate={navigate}>
                      <Button variant="ghost" size="icon">
                          <Search className="h-5 w-5" />
                      </Button>
                  </SearchSheet>
                  <Switch
                    id="live-only-switch"
                    checked={showLiveOnly}
                    onCheckedChange={setShowLiveOnly}
                  />
                  <ProfileButton />
              </div>
            }
        />
        <div className="flex flex-col border-b bg-background">
             <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
               <TabsList className="grid w-full grid-cols-3 h-auto p-0 rounded-none bg-transparent">
                   <TabsTrigger value="predictions" className='text-xs sm:text-sm'>التوقعات</TabsTrigger>
                   <TabsTrigger value="all-matches" className='text-xs sm:text-sm'>كل المباريات</TabsTrigger>
                   <TabsTrigger value="my-results" className='text-xs sm:text-sm'>نتائجي</TabsTrigger>
               </TabsList>
                <TabsContent value="my-results" className="mt-0">
                     <div className="py-2">
                        <DateScroller selectedDateKey={selectedDateKey} onDateSelect={handleDateChange} />
                    </div>
                </TabsContent>
                <TabsContent value="all-matches" className="mt-0">
                     <div className="py-2">
                        <DateScroller selectedDateKey={selectedDateKey} onDateSelect={handleDateChange} />
                    </div>
                </TabsContent>
                <TabsContent value="predictions" className="mt-0">
                    {/* Date scroller for predictions can be different if needed */}
                </TabsContent>
             </Tabs>

        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeTab === 'predictions' ? (
                <GlobalPredictionsScreen navigate={navigate} goBack={goBack} canGoBack={canGoBack} />
            ) : (
                <FixturesList 
                    fixtures={currentFixtures}
                    loading={loadingFixtures}
                    activeTab={activeTab}
                    showLiveOnly={showLiveOnly} 
                    favoritedLeagueIds={favoritedLeagueIds}
                    favoritedTeamIds={favoritedTeamIds}
                    hasAnyFavorites={hasAnyFavorites}
                    matchDetails={matchDetails}
                    navigate={navigate}
                />
            )}
        </div>
    </div>
  );
}
