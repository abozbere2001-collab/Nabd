

"use client";

import React, { useEffect, useState } from 'react';
import type { ScreenProps } from '@/app/page';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, Pencil, Shirt, Users, Trophy, BarChart2, Heart, Copy } from 'lucide-react';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, setDoc, updateDoc, deleteField, getDoc, getDocs, collection } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { NoteDialog } from '@/components/NoteDialog';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Fixture, Standing, TopScorer, Favorites } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';


// --- TYPE DEFINITIONS ---
interface TeamInfo {
    team: { id: number; name: string; logo: string; country: string; founded: number; type: string; };
    venue: { name: string; city: string; capacity: number; image: string; };
}
interface Player {
    id: number;
    name: string;
    age: number;
    number: number | null;
    position: string;
    photo: string;
}
interface PlayerInfoFromApi {
    player: Player;
    statistics: any[];
}
type RenameType = 'team' | 'player';

const CURRENT_SEASON = new Date().getFullYear();

// --- HOOKS ---
function useTeamData(teamId?: number) {  
  const [data, setData] = useState<{
    teamInfo: TeamInfo | null;
    players: PlayerInfoFromApi[] | null;
    fixtures: Fixture[] | null;
    standings: Standing[] | null;
    scorers: TopScorer[] | null;
    leagueId: number | null;
  }>({ teamInfo: null, players: null, fixtures: null, standings: null, scorers: null, leagueId: null });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    };

    const fetchData = async () => {
      setLoading(true);
      try {
        const teamRes = await fetch(`/api/football/teams?id=${teamId}`);
        if (!teamRes.ok) throw new Error('Failed to fetch team data');
        const teamData = await teamRes.json();
        const teamInfo: TeamInfo | null = teamData.response?.[0] || null;

        const seasonForData = teamInfo?.team.type === 'National' ? CURRENT_SEASON - 1 : CURRENT_SEASON;
        
        // Fetch players for the current season
        const playersRes = await fetch(`/api/football/players?team=${teamId}&season=${seasonForData}`);
        if (!playersRes.ok) throw new Error('Failed to fetch players data');
        const playersData = await playersRes.json();
        const allPlayers: PlayerInfoFromApi[] = playersData.response || [];
        
        // Fetch fixtures for the current season only for performance
        const fixturesRes = await fetch(`/api/football/fixtures?team=${teamId}&season=${seasonForData}`);
        if (!fixturesRes.ok) throw new Error('Failed to fetch fixtures data');
        const fixturesData = await fixturesRes.json();
        const fixtures: Fixture[] = fixturesData.response || [];
        
        let leagueIdForStandings = null;
        if (fixtures.length > 0) {
            const primaryLeague = fixtures.find(f => f.league.name.toLowerCase().includes('league')) || fixtures[0];
            leagueIdForStandings = primaryLeague.league.id;
        }

        let standingsData = { response: [] };
        let scorersData = { response: [] };
        if (leagueIdForStandings) {
            const seasonForStandings = teamInfo?.team.type === 'National' ? new Date(fixtures[0].fixture.date).getFullYear() : seasonForData;
            const [standingsRes, scorersRes] = await Promise.all([
                 fetch(`/api/football/standings?league=${leagueIdForStandings}&season=${seasonForStandings}`),
                 fetch(`/api/football/players/topscorers?league=${leagueIdForStandings}&season=${seasonForStandings}`)
            ]);
            if (!standingsRes.ok) throw new Error('Failed to fetch standings');
            if (!scorersRes.ok) throw new Error('Failed to fetch top scorers');

            standingsData = await standingsRes.json();
            scorersData = await scorersRes.json();
        }
        
        setData({
          teamInfo: teamInfo,
          players: allPlayers,
          fixtures: fixtures,
          standings: standingsData.response?.[0]?.league?.standings?.[0] || [],
          scorers: scorersData.response || [],
          leagueId: leagueIdForStandings,
        });

      } catch (error) {
        console.error("Error in useTeamData:", error);
        toast({
            variant: "destructive",
            title: "خطأ في الشبكة",
            description: "فشل في جلب بيانات الفريق. يرجى التحقق من اتصالك بالإنترنت.",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [teamId, toast]);

  return { ...data, loading };
}


// --- MAIN SCREEN COMPONENT ---
export function TeamDetailScreen({ navigate, goBack, canGoBack, teamId, headerActions }: ScreenProps & { teamId: number; headerActions?: React.ReactNode }) {
  const { teamInfo, players, fixtures, standings, scorers, loading } = useTeamData(teamId);
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const { db } = useFirestore();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<Favorites>({ userId: user?.uid || '' });
  const [renameItem, setRenameItem] = useState<{ id: number; name: string; type: RenameType } | null>(null);
  const [isRenameOpen, setRenameOpen] = useState(false);
  const [noteTeam, setNoteTeam] = useState<{id: number, name: string, logo: string} | null>(null);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [displayTitle, setDisplayTitle] = useState(teamInfo?.team.name || "الفريق");
  const [customPlayerNames, setCustomPlayerNames] = useState<Map<number, string>>(new Map());


  const fetchCustomNames = React.useCallback(async () => {
    if (!db) return;
    const teamDocRef = doc(db, "teamCustomizations", String(teamId));
    const playersColRef = collection(db, 'playerCustomizations');

    try {
        const teamDocSnap = await getDoc(teamDocRef);
        if (teamDocSnap.exists()) {
            setDisplayTitle(teamDocSnap.data().customName);
        } else if (teamInfo?.team.name) {
            setDisplayTitle(teamInfo.team.name);
        }

        const playersSnapshot = await getDocs(playersColRef);
        const playerNames = new Map<number, string>();
        playersSnapshot.forEach(doc => playerNames.set(Number(doc.id), doc.data().customName));
        setCustomPlayerNames(playerNames);
    } catch (error) {
        const permissionError = new FirestorePermissionError({
          path: `teamCustomizations/${teamId} or playerCustomizations`,
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
    }
}, [db, teamId, teamInfo?.team.name]);


  const handleCopy = (url: string | null) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast({ title: "تم نسخ الرابط", description: url });
  };


  useEffect(() => {
    fetchCustomNames();
  }, [fetchCustomNames]);


  useEffect(() => {
    if (!user || !db) return;
    const docRef = doc(db, 'favorites', user.uid);
    const unsub = onSnapshot(docRef, (doc) => {
        setFavorites(doc.data() as Favorites || { userId: user.uid });
    }, (error) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'get' });
        errorEmitter.emit('permission-error', permissionError);
    });
    return () => unsub();
  }, [user, db]);

  const handleOpenRename = (type: RenameType, id: number, name: string) => {
    setRenameItem({ id, name, type });
    setRenameOpen(true);
  };

  const handleSaveRename = async (newName: string) => {
    if (!renameItem || !db) return;
    const { id, type } = renameItem;
    const collectionName = type === 'player' ? 'playerCustomizations' : 'teamCustomizations';
    const docRef = doc(db, collectionName, String(id));
    const data = { customName: newName };
    setDoc(docRef, data)
        .then(() => fetchCustomNames())
        .catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'create',
                requestResourceData: data,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  };

  const handleFavorite = async (type: 'team' | 'player', item: any) => {
    if (!user || !db) return;
    const favRef = doc(db, 'favorites', user.uid);
    const itemPath = type === 'team' ? 'teams' : 'players';
    const fieldPath = `${itemPath}.${item.id}`;
    const isFavorited = !!favorites?.[itemPath]?.[item.id];
    
    let favoriteData: any = { userId: user.uid };
    if (type === 'team') {
       favoriteData.teams = { [item.id]: { teamId: item.id, name: item.name, logo: item.logo }};
    } else {
       favoriteData.players = { [item.id]: { playerId: item.id, name: item.name, photo: item.photo }};
    }

    const operation = isFavorited
        ? updateDoc(favRef, { [fieldPath]: deleteField() })
        : setDoc(favRef, favoriteData, { merge: true });

    operation.catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: favRef.path,
            operation: 'update',
            requestResourceData: favoriteData,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  };
  
  const handleOpenNote = (team: {id: number, name: string, logo: string}) => {
    setNoteTeam(team);
    setIsNoteOpen(true);
  }

  const handleSaveNote = async (note: string) => {
    if (!noteTeam || !db) return;
    const docRef = doc(db, "adminFavorites", String(noteTeam.id));
    const data = {
      teamId: noteTeam.id,
      name: noteTeam.name,
      logo: noteTeam.logo,
      note: note
    };
    setDoc(docRef, data).catch(serverError => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'create',
          requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  }
  
  const getPlayerDisplayName = (id: number, defaultName: string) => {
    return customPlayerNames.get(id) || defaultName;
  }

  const isTeamFavorited = !!favorites?.teams?.[teamId];

  const secondaryActions = teamInfo && (
    <div className="flex items-center gap-1">
      {isAdmin && (
        <>
          <Button variant="ghost" size="icon" onClick={() => handleOpenNote(teamInfo.team)}>
            <Heart className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleOpenRename('team', teamId, displayTitle)}>
            <Pencil className="h-5 w-5" />
          </Button>
        </>
      )}
        <Button variant="ghost" size="icon" onClick={() => handleFavorite('team', teamInfo.team)}>
            <Star className={cn("h-5 w-5 opacity-80", isTeamFavorited ? "text-yellow-400 fill-current" : "text-muted-foreground")} />
        </Button>
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title={displayTitle} onBack={goBack} canGoBack={canGoBack} actions={headerActions} secondaryActions={secondaryActions} />
      {renameItem && <RenameDialog isOpen={isRenameOpen} onOpenChange={setRenameOpen} currentName={renameItem.name} onSave={handleSaveRename} itemType={renameItem.type === 'team' ? 'الفريق' : 'اللاعب'} />}
      {noteTeam && <NoteDialog
        isOpen={isNoteOpen}
        onOpenChange={setIsNoteOpen}
        onSave={handleSaveNote}
        teamName={noteTeam.name}
      />}
      
      {loading ? <div className="p-4 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div> : teamInfo ? (
        <div className="flex-1 overflow-y-auto">
            <Tabs defaultValue="details" className="w-full">
                 <div className="bg-card sticky top-0 z-10 border-b">
                    <div className="p-4 flex items-center gap-4">
                        <div className="relative">
                            <Avatar className="h-20 w-20 border">
                                <AvatarImage src={teamInfo.team.logo} />
                                <AvatarFallback>{teamInfo.team.name.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            {isAdmin && <Button variant="ghost" size="icon" className="absolute -top-2 -left-2 h-6 w-6" onClick={(e) => { e.stopPropagation(); handleCopy(teamInfo.team.logo); }}><Copy className="h-3 w-3 text-muted-foreground" /></Button>}
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold">{displayTitle}</h2>
                            <p className="text-sm text-muted-foreground">{teamInfo.team.country} - تأسس {teamInfo.team.founded}</p>
                            <p className="text-sm text-muted-foreground">{teamInfo.venue.name} ({teamInfo.venue.city})</p>
                        </div>
                    </div>
                    <TabsList className="grid w-full grid-cols-2 h-auto p-0 rounded-none">
                        <TabsTrigger value="players" className='data-[state=active]:rounded-none'>اللاعبون</TabsTrigger>
                        <TabsTrigger value="details" className='data-[state=active]:rounded-none'>التفاصيل</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="players" className="p-4">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {players?.map(({ player }) => (
                         <div key={player.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                            <div className="relative">
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={player.photo} alt={player.name} />
                                    <AvatarFallback>{player.name.substring(0, 1)}</AvatarFallback>
                                </Avatar>
                                {isAdmin && <Button variant="ghost" size="icon" className="absolute -top-2 -left-2 h-6 w-6" onClick={(e) => { e.stopPropagation(); handleCopy(player.photo); }}><Copy className="h-3 w-3 text-muted-foreground" /></Button>}
                            </div>
                            <div className="flex-1">
                                <p className="font-bold">{getPlayerDisplayName(player.id, player.name)}</p>
                                <p className="text-sm text-muted-foreground">
                                    {player.position}
                                    {isAdmin && <span className="text-xs text-muted-foreground/70 ml-2">(ID: {player.id})</span>}
                                </p>
                            </div>
                            <div className='flex items-center opacity-80'>
                                <Button variant="ghost" size="icon" onClick={() => handleFavorite('player', player)}>
                                    <Star className={cn("h-5 w-5", favorites?.players?.[player.id] ? "text-yellow-400 fill-current" : "text-muted-foreground/60")} />
                                </Button>
                                {isAdmin && <Button variant="ghost" size="icon" onClick={() => handleOpenRename('player', player.id, getPlayerDisplayName(player.id, player.name))}>
                                    <Pencil className="h-5 w-5 text-muted-foreground" />
                                </Button>}
                            </div>
                         </div>
                     ))}
                   </div>
                </TabsContent>
                <TabsContent value="details" className="p-0">
                     <Tabs defaultValue="scorers" className="w-full">
                         <div className="bg-card sticky top-[152px] z-10 border-b">
                            <TabsList className="grid w-full grid-cols-3 h-auto p-0 rounded-none flex-row-reverse">
                                <TabsTrigger value="matches" className='data-[state=active]:rounded-none'><Shirt className="w-4 h-4 ml-1"/>المباريات</TabsTrigger>
                                <TabsTrigger value="standings" className='data-[state=active]:rounded-none'><Trophy className="w-4 h-4 ml-1"/>الترتيب</TabsTrigger>
                                <TabsTrigger value="scorers" className='data-[state=active]:rounded-none'><BarChart2 className="w-4 h-4 ml-1"/>الإحصائيات</TabsTrigger>
                            </TabsList>
                         </div>
                         <TabsContent value="matches" className="p-4">
                             {fixtures && fixtures.length > 0 ? (
                                <div className="space-y-2">
                                {fixtures.map((fixture) => (
                                    <div key={fixture.fixture.id} className="rounded-lg border bg-card p-3 text-sm cursor-pointer" onClick={() => navigate('MatchDetails', { fixtureId: fixture.fixture.id, fixture })}>
                                        <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
                                            <span>{format(new Date(fixture.fixture.date), 'EEE, d MMM yyyy')}</span>
                                            <span>{fixture.fixture.status.short}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 flex-1 justify-end truncate">
                                                <span className="font-semibold truncate">{fixture.teams.home.name}</span>
                                                <Avatar className="h-6 w-6"><AvatarImage src={fixture.teams.home.logo} /></Avatar>
                                            </div>
                                            <div className="font-bold text-base px-2 bg-muted rounded-md">{fixture.goals.home ?? ''} - {fixture.goals.away ?? ''}</div>
                                            <div className="flex items-center gap-2 flex-1 truncate">
                                                <Avatar className="h-6 w-6"><AvatarImage src={fixture.teams.away.logo} /></Avatar>
                                                <span className="font-semibold truncate">{fixture.teams.away.name}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                </div>
                             ) : <p className="text-center py-8 text-muted-foreground">لا توجد مباريات متاحة.</p>}
                         </TabsContent>
                         <TabsContent value="standings" className="p-0">
                            {standings && standings.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="text-center">ن</TableHead><TableHead className="text-center">خ</TableHead><TableHead className="text-center">ت</TableHead><TableHead className="text-center">ف</TableHead><TableHead className="text-center">ل</TableHead><TableHead className="w-1/2 text-right">الفريق</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                    {standings.map((s) => (
                                        <TableRow key={s.team.id} className={cn("cursor-pointer", s.team.id === teamId ? 'bg-primary/10' : '')} onClick={() => navigate('TeamDetails', {teamId: s.team.id})}>
                                            <TableCell className="text-center font-bold">{s.points}</TableCell>
                                            <TableCell className="text-center">{s.all.lose}</TableCell>
                                            <TableCell className="text-center">{s.all.draw}</TableCell>
                                            <TableCell className="text-center">{s.all.win}</TableCell>
                                            <TableCell className="text-center">{s.all.played}</TableCell>
                                            <TableCell className="font-medium"><div className="flex items-center gap-2 justify-end">
                                                <span className="truncate">{s.team.name}</span>
                                                <Avatar className="h-6 w-6"><AvatarImage src={s.team.logo} /></Avatar>
                                                <span>{s.rank}</span>
                                            </div></TableCell>
                                        </TableRow>
                                    ))}
                                    </TableBody>
                                </Table>
                            ) : <p className="text-center py-8 text-muted-foreground">الترتيب غير متاح حاليًا.</p>}
                         </TabsContent>
                         <TabsContent value="scorers" className="p-0">
                             {scorers && scorers.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="text-center">صناعة</TableHead>
                                        <TableHead className="text-center">الأهداف</TableHead>
                                        <TableHead className="text-right">اللاعب</TableHead>
                                        </TableRow></TableHeader>
                                    <TableBody>
                                    {scorers.filter(scorer => scorer.statistics[0].team.id === teamId).map(({ player, statistics }) => (
                                        <TableRow key={player.id}>
                                            <TableCell className="text-center font-bold text-lg">{statistics[0]?.goals.assists || 0}</TableCell>
                                            <TableCell className="text-center font-bold text-lg">{statistics[0]?.goals.total || 0}</TableCell>
                                            <TableCell><div className="flex items-center gap-3 justify-end"><p className="font-semibold">{player.name}</p><Avatar className="h-10 w-10"><AvatarImage src={player.photo} /></Avatar></div></TableCell>
                                        </TableRow>
                                    ))}
                                    </TableBody>
                                </Table>
                             ) : <p className="text-center py-8 text-muted-foreground">لا توجد إحصائيات هدافين متاحة.</p>}
                         </TabsContent>
                     </Tabs>
                </TabsContent>
            </Tabs>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
           فشل تحميل بيانات الفريق.
        </div>
      )}
    </div>
  );
}
