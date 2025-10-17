
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from '@/components/ui/button';
import { Search, Star, Pencil, Loader2, Heart } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDebounce } from '@/hooks/use-debounce';
import type { ScreenProps } from '@/app/page';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc, updateDoc, deleteField, collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { NoteDialog } from '@/components/NoteDialog';
import { cn } from '@/lib/utils';
import type { Favorites } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { POPULAR_TEAMS, POPULAR_LEAGUES } from '@/lib/popular-data';

interface TeamResult {
  team: { id: number; name: string; logo: string; national?: boolean; };
  venue?: any;
}
interface LeagueResult {
  league: { id: number; name: string; logo: string; };
  country?: any;
}

type Item = TeamResult['team'] | LeagueResult['league'];
type ItemType = 'teams' | 'leagues';

type SearchResult = (TeamResult & { type: 'team' }) | (LeagueResult & { type: 'league' });

type RenameType = 'league' | 'team';

const normalizeArabic = (text: string) => {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u0652]/g, "") // Remove harakat
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};


const ItemRow = ({ item, itemType, isFavorited, onFavoriteToggle, onResultClick, onRename, onAddNote, isAdmin }: { item: Item, itemType: ItemType, isFavorited: boolean, onFavoriteToggle: (item: Item) => void, onResultClick: () => void, onRename: () => void, onAddNote: () => void, isAdmin: boolean }) => {
  return (
    <div className="flex items-center gap-2 p-1.5 border-b last:border-b-0 hover:bg-accent/50 rounded-md">
       <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={onResultClick}>
            <Avatar className={cn('h-7 w-7', itemType === 'leagues' && 'p-0.5')}>
                <AvatarImage src={item.logo} alt={item.name} className={itemType === 'leagues' ? 'object-contain' : 'object-cover'} />
                <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 font-semibold truncate text-sm">{item.name}</div>
        </div>
      {isAdmin && itemType === 'teams' && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onAddNote}>
            <Heart className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
      {isAdmin && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRename}>
            <Pencil className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onFavoriteToggle(item)}>
        <Star className={cn("h-5 w-5 text-muted-foreground/60", isFavorited && "fill-current text-yellow-400")} />
      </Button>
    </div>
  );
}


export function SearchSheet({ children, navigate, initialItemType }: { children: React.ReactNode, navigate: ScreenProps['navigate'], initialItemType?: ItemType }) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const [showAllPopular, setShowAllPopular] = useState(false);
  const [itemType, setItemType] = useState<ItemType>(initialItemType || 'teams');

  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const { db } = useFirestore();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<Favorites>({ userId: '' });
  const [customNames, setCustomNames] = useState<{leagues: Map<number, string>, teams: Map<number, string>}>({leagues: new Map(), teams: new Map()});
  
  const [renameItem, setRenameItem] = useState<{ id: string | number, name: string, type: RenameType } | null>(null);
  const [isRenameOpen, setRenameOpen] = useState(false);
  
  const [noteTeam, setNoteTeam] = useState<{id: number, name: string, logo: string} | null>(null);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  
  useEffect(() => {
    if(initialItemType) {
        setItemType(initialItemType);
    }
  }, [initialItemType])


  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSearchTerm('');
      setSearchResults([]);
      setShowAllPopular(false);
      if (initialItemType) {
        setItemType(initialItemType);
      }
    }
  };

  const fetchFavorites = useCallback(async () => {
    if (!user || !db) return;
    const docRef = doc(db, 'users', user.uid, 'favorites', 'data');
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setFavorites(docSnap.data() as Favorites);
      }
    } catch (error) {
      const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'get' });
      errorEmitter.emit('permission-error', permissionError);
    }
  }, [user, db]);

  const fetchAllCustomNames = useCallback(async () => {
    if (!db) return;
    try {
        const [leaguesSnapshot, teamsSnapshot] = await Promise.all([
            getDocs(collection(db, 'leagueCustomizations')),
            getDocs(collection(db, 'teamCustomizations'))
        ]);
        
        const leagueNames = new Map<number, string>();
        leaguesSnapshot?.forEach(doc => leagueNames.set(Number(doc.id), doc.data().customName));
        
        const teamNames = new Map<number, string>();
        teamsSnapshot?.forEach(doc => teamNames.set(Number(doc.id), doc.data().customName));
        
        setCustomNames({ leagues: leagueNames, teams: teamNames });
    } catch(error) {
         console.warn("Could not fetch custom names, this is expected for non-admins", error);
    }
  }, [db]);

  const getDisplayName = useCallback((type: 'team' | 'league', id: number, defaultName: string) => {
      const key = `${type}s` as 'teams' | 'leagues';
      return customNames[key]?.get(id) || defaultName;
  }, [customNames]);

  useEffect(() => {
    if (isOpen) {
      fetchFavorites();
      fetchAllCustomNames();
    }
  }, [isOpen, fetchFavorites, fetchAllCustomNames]);

  const handleSearch = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || trimmedQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    const resultsMap = new Map<string, SearchResult>();

    try {
        // 1. Client-side search for custom names (Arabic search)
        const normalizedQuery = normalizeArabic(trimmedQuery);
        const matchedTeamIds: string[] = [];
        customNames.teams.forEach((name, id) => {
            if (normalizeArabic(name).includes(normalizedQuery)) {
                matchedTeamIds.push(String(id));
            }
        });
        
        const matchedLeagueIds: string[] = [];
        customNames.leagues.forEach((name, id) => {
            if (normalizeArabic(name).includes(normalizedQuery)) {
                matchedLeagueIds.push(String(id));
            }
        });
        
        const fetchAndSet = async (id: string, type: 'team' | 'league') => {
          if (!resultsMap.has(`${type}-${id}`)) {
            const endpoint = type === 'team' ? 'teams' : 'leagues';
            const res = await fetch(`/api/football/${endpoint}?id=${id}`);
            if (res.ok) {
                const data = await res.json();
                if (data.response?.[0]) resultsMap.set(`${type}-${id}`, { ...data.response[0], type });
            }
          }
        };

        const customNamePromises = [
          ...matchedTeamIds.map(id => fetchAndSet(id, 'team')),
          ...matchedLeagueIds.map(id => fetchAndSet(id, 'league'))
        ];
        
        // 2. Search external API with original query (English search)
        const apiSearchPromises = [
          fetch(`/api/football/teams?search=${trimmedQuery}`).then(res => res.json()),
          fetch(`/api/football/leagues?search=${trimmedQuery}`).then(res => res.json())
        ];

        const [[teamsData, leaguesData], ..._] = await Promise.all([
          Promise.all(apiSearchPromises),
          Promise.all(customNamePromises)
        ]);

        if (teamsData.response) {
            teamsData.response.forEach((r: TeamResult) => {
                if (!resultsMap.has(`team-${r.team.id}`)) {
                    resultsMap.set(`team-${r.team.id}`, { ...r, type: 'team' });
                }
            });
        }
        if (leaguesData.response) {
            leaguesData.response.forEach((r: LeagueResult) => {
                 if (!resultsMap.has(`league-${r.league.id}`)) {
                    resultsMap.set(`league-${r.league.id}`, { ...r, type: 'league' });
                 }
            });
        }
      
      setSearchResults(Array.from(resultsMap.values()));
    } catch (error) {
      console.error("API Search Error: ", error);
      toast({variant: 'destructive', title: 'خطأ في البحث', description: 'فشل الاتصال بالخادم.'});
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [customNames.teams, customNames.leagues, toast]);


  useEffect(() => {
    if (debouncedSearchTerm && isOpen) {
      handleSearch(debouncedSearchTerm);
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm, handleSearch, isOpen]);

  const handleFavorite = (item: Item, type: ItemType) => {
    if (!user || !db) return;

    const favRef = doc(db, 'users', user.uid, 'favorites', 'data');
    const fieldPath = `${type}.${item.id}`;
    const isFavorited = !!favorites?.[type]?.[item.id];

    const currentFavorites = { ...favorites };
    if (!currentFavorites[type]) {
      (currentFavorites as any)[type] = {};
    }

    if (isFavorited) {
      delete (currentFavorites[type] as any)[item.id];
    } else {
      const idKey = type === 'teams' ? 'teamId' : 'leagueId';
       (currentFavorites[type] as any)[item.id] = { 
          [idKey]: item.id, 
          name: item.name, 
          logo: item.logo,
      };
      if (type === 'teams' && 'national' in item) {
         (currentFavorites.teams as any)[item.id].type = (item as any).national ? 'National' : 'Club'
      }
    }
    setFavorites(currentFavorites);
    
    let dataToSave: any = { 
      name: item.name, 
      logo: item.logo || '' 
    };

    if (type === 'teams') {
        dataToSave.teamId = item.id;
        dataToSave.type = 'national' in item && item.national ? 'National' : 'Club';
    } else {
        dataToSave.leagueId = item.id;
    }


    const operation = isFavorited
      ? updateDoc(favRef, { [fieldPath]: deleteField() })
      : setDoc(favRef, { [type]: { [item.id]: dataToSave } }, { merge: true });

    operation.catch(serverError => {
      setFavorites(favorites);
      const permissionError = new FirestorePermissionError({ path: favRef.path, operation: 'update' });
      errorEmitter.emit('permission-error', permissionError);
    });
  };

  const handleResultClick = (result: SearchResult) => {
    const item = result.type === 'team' ? result.team : result.league;
    const displayName = getDisplayName(result.type, item.id, item.name);
    if (result.type === 'team') {
      navigate('TeamDetails', { teamId: result.team.id });
    } else {
      navigate('CompetitionDetails', { leagueId: result.league.id, title: displayName, logo: result.league.logo });
    }
    handleOpenChange(false);
  }

  const handleOpenRename = (type: RenameType, id: string | number, name: string) => {
    setRenameItem({ id, name, type });
    setRenameOpen(true);
  };
  
  const handleSaveRename = (newName: string) => {
    if (!renameItem || !db) return;
    const { id, type } = renameItem;
    let collectionName = type === 'league' ? 'leagueCustomizations' : 'teamCustomizations';
    const docRef = doc(db, collectionName, String(id));
    const data = { customName: newName };
    setDoc(docRef, data)
        .then(() => fetchAllCustomNames())
        .catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'create',
                requestResourceData: data,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  };
  
  const handleOpenNote = (team: {id: number, name: string, logo: string}) => {
    setNoteTeam(team);
    setIsNoteOpen(true);
  }

  const handleSaveNote = (note: string) => {
    if (!noteTeam || !db) return;
    const docRef = doc(db, "adminFavorites", String(noteTeam.id));
    const data = {
      teamId: noteTeam.id,
      name: noteTeam.name,
      logo: noteTeam.logo,
      note: note
    };
    setDoc(docRef, data)
        .catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'create',
                requestResourceData: data,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  }
  
  const popularItems = itemType === 'teams' ? POPULAR_TEAMS : POPULAR_LEAGUES;
  const popularItemsToShow = showAllPopular ? popularItems : popularItems.slice(0, 6);

  const renderContent = () => {
    if (loading) {
      return <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }
    
    if (debouncedSearchTerm) {
      return searchResults.length > 0 ? (
        searchResults.map(result => {
          const item = result.type === 'team' ? result.team : result.league;
          const displayName = getDisplayName(result.type, item.id, item.name);
          const isFavorited = !!favorites?.[result.type]?.[item.id];
          return <ItemRow key={`${result.type}-${item.id}`} item={{...item, name: displayName}} itemType={result.type} isFavorited={isFavorited} onFavoriteToggle={(i) => handleFavorite(i, result.type)} onResultClick={() => handleResultClick(result)} isAdmin={isAdmin} onRename={() => handleOpenRename(result.type, item.id, displayName)} onAddNote={() => handleOpenNote(item as TeamResult['team'])} />;
        })
      ) : <p className="text-muted-foreground text-center pt-8">لا توجد نتائج بحث.</p>;
    }

    return (
      <div className="space-y-2">
        <h3 className="font-bold text-md text-center text-muted-foreground">{itemType === 'teams' ? 'الفرق الأكثر شعبية' : 'البطولات الأكثر شعبية'}</h3>
        {popularItemsToShow.map(item => {
          const isFavorited = !!favorites?.[itemType]?.[item.id];
          const displayName = getDisplayName(itemType.slice(0,-1) as 'team' | 'league' , item.id, item.name);
          const resultType = itemType === 'teams' ? 'team' : 'league';
          const result = { [resultType]: item, type: resultType } as SearchResult;

          return <ItemRow key={item.id} item={{...item, name: displayName}} itemType={itemType} isFavorited={isFavorited} onFavoriteToggle={(i) => handleFavorite(i, itemType)} onResultClick={() => handleResultClick(result)} isAdmin={isAdmin} onRename={() => handleOpenRename(resultType, item.id, displayName)} onAddNote={() => handleOpenNote(item as TeamResult['team'])} />;
        })}
        {!showAllPopular && popularItems.length > 6 && (
          <Button variant="ghost" className="w-full" onClick={() => setShowAllPopular(true)}>عرض الكل</Button>
        )}
      </div>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild onClick={(e) => { e.stopPropagation(); setIsOpen(true) }}>{children}</SheetTrigger>
      <SheetContent side="bottom" className="flex flex-col h-[90vh] top-0 rounded-t-none">
        <SheetHeader>
          <SheetTitle>اكتشف</SheetTitle>
        </SheetHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="ابحث عن فريق أو بطولة..."
            className="pl-10 text-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {!debouncedSearchTerm && (
             <div className="flex items-center justify-center pt-2">
                <Button variant={itemType === 'teams' ? 'secondary' : 'ghost'} size="sm" onClick={() => setItemType('teams')}>الفرق</Button>
                <Button variant={itemType === 'leagues' ? 'secondary' : 'ghost'} size="sm" onClick={() => setItemType('leagues')}>البطولات</Button>
            </div>
        )}
        <div className="mt-4 flex-1 overflow-y-auto space-y-1 pr-2">
          {renderContent()}
        </div>
        
        {renameItem && (
          <RenameDialog 
            isOpen={isRenameOpen}
            onOpenChange={setRenameOpen}
            currentName={renameItem.name}
            onSave={handleSaveRename}
            itemType={renameItem.type === 'team' ? 'الفريق' : 'البطولة'}
          />
        )}
        {noteTeam && <NoteDialog
            isOpen={isNoteOpen}
            onOpenChange={setIsNoteOpen}
            onSave={handleSaveNote}
            teamName={noteTeam.name}
        />}

      </SheetContent>
    </Sheet>
  );
}

    